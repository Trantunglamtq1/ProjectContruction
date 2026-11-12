using ConstructionProject.Infrastructure.Workflows;
using ConstructionProject.Infrastructure.Workflows.Activities;
using ConstructionProject.Infrastructure.Services;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using Elsa.EntityFrameworkCore.Extensions;
using Elsa.EntityFrameworkCore.Modules.Management;
using Elsa.EntityFrameworkCore.Modules.Runtime;
using Elsa.Extensions;
using Elsa.Workflows.Runtime.Contracts;
using Elsa.Workflows.Runtime.Parameters;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ConstructionProject.IntegrationTests;

public class ElsaPersistenceTests
{
    [SqlServerFact]
    public async Task WorkflowState_SurvivesHostRestart()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_Elsa_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        var instanceId = Guid.NewGuid().ToString("N");

        using (var host = CreateHost(connection))
        {
            await host.StartAsync();
            using var scope = host.Services.CreateScope();
            var runtime = scope.ServiceProvider.GetRequiredService<IWorkflowRuntime>();
            await runtime.StartWorkflowAsync(InspectionApprovalWorkflow.WorkflowDefinitionId,
                new StartWorkflowRuntimeParams { InstanceId = instanceId });
            var state = await runtime.ExportWorkflowStateAsync(instanceId, CancellationToken.None);
            Assert.NotNull(state);
            Assert.Contains(state.Bookmarks, b => b.Name == WaitForReviewerDecision.BookmarkNameConstant);
            await host.StopAsync();
        }

        using (var host = CreateHost(connection))
        {
            await host.StartAsync();
            using var scope = host.Services.CreateScope();
            var runtime = scope.ServiceProvider.GetRequiredService<IWorkflowRuntime>();
            var state = await runtime.ExportWorkflowStateAsync(instanceId, CancellationToken.None);
            Assert.NotNull(state);
            Assert.Contains(state.Bookmarks, b => b.Name == WaitForReviewerDecision.BookmarkNameConstant);
            var bookmark = state.Bookmarks.Single(b => b.Name == WaitForReviewerDecision.BookmarkNameConstant);
            await runtime.ResumeWorkflowAsync(instanceId, new ResumeWorkflowRuntimeParams { BookmarkId = bookmark.Id });
            var resumed = await runtime.ExportWorkflowStateAsync(instanceId, CancellationToken.None);
            Assert.NotNull(resumed);
            Assert.Contains(resumed.Bookmarks, b => b.Name == WaitForApproverDecision.BookmarkNameConstant);
            await host.StopAsync();
        }
    }

    [SqlServerFact]
    public async Task ReviewerResume_RecordedBeforeCrash_CanBeDetectedAfterRestart()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_Elsa_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        var instanceId = Guid.NewGuid().ToString("N");
        using (var host = CreateHost(connection))
        {
            await host.StartAsync();
            using var scope = host.Services.CreateScope();
            var runtime = scope.ServiceProvider.GetRequiredService<IWorkflowRuntime>();
            await runtime.StartWorkflowAsync(InspectionApprovalWorkflow.WorkflowDefinitionId, new StartWorkflowRuntimeParams { InstanceId = instanceId });
            var before = await runtime.ExportWorkflowStateAsync(instanceId, CancellationToken.None);
            Assert.NotNull(before);
            var reviewer = Assert.Single(before.Bookmarks, b => b.Name == WaitForReviewerDecision.BookmarkNameConstant);
            await runtime.ResumeWorkflowAsync(instanceId, new ResumeWorkflowRuntimeParams { BookmarkId = reviewer.Id });
            // Simulate process loss after Elsa committed but before business-side acknowledgement.
            await host.StopAsync();
        }
        using (var host = CreateHost(connection))
        {
            await host.StartAsync();
            using var scope = host.Services.CreateScope();
            var runtime = scope.ServiceProvider.GetRequiredService<IWorkflowRuntime>();
            var after = await runtime.ExportWorkflowStateAsync(instanceId, CancellationToken.None);
            Assert.NotNull(after);
            Assert.DoesNotContain(after.Bookmarks, b => b.Name == WaitForReviewerDecision.BookmarkNameConstant);
            Assert.Single(after.Bookmarks, b => b.Name == WaitForApproverDecision.BookmarkNameConstant);
            await host.StopAsync();
        }
    }
    [SqlServerFact]
    public async Task Reconciler_RetriesWithoutRepeatingDecisions_AndRejectsUnexpectedState()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_Elsa_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        using var host = CreateHost(connection);
        await host.StartAsync();
        using var scope = host.Services.CreateScope();
        var reconciler = new InspectionWorkflowReconciler(scope.ServiceProvider.GetRequiredService<IWorkflowRuntime>());
        var operation = new InspectionWorkflowOperation { InspectionId = Guid.NewGuid(), InstanceId = Guid.NewGuid().ToString("N"), Action = "Start" };
        await reconciler.ReconcileAsync(operation);
        await reconciler.ReconcileAsync(operation);
        operation.Action = "Review";
        await reconciler.ReconcileAsync(operation);
        await reconciler.ReconcileAsync(operation);
        operation.Action = "Approve";
        await reconciler.ReconcileAsync(operation);
        await reconciler.ReconcileAsync(operation);

        var rejected = new InspectionWorkflowOperation { InspectionId = Guid.NewGuid(), InstanceId = Guid.NewGuid().ToString("N"), Action = "Start" };
        await reconciler.ReconcileAsync(rejected);
        rejected.Action = "RejectReviewer";
        await reconciler.ReconcileAsync(rejected);
        await reconciler.ReconcileAsync(rejected);
        rejected.Action = "Approve";
        await Assert.ThrowsAsync<InvalidOperationException>(() => reconciler.ReconcileAsync(rejected));

        var recovery = new InspectionWorkflowOperation { InspectionId = Guid.NewGuid(), InstanceId = Guid.NewGuid().ToString("N"), Action = "RecoverApprover" };
        await reconciler.ReconcileAsync(recovery);
        await reconciler.ReconcileAsync(recovery);
        var recoveredState = await scope.ServiceProvider.GetRequiredService<IWorkflowRuntime>().ExportWorkflowStateAsync(recovery.InstanceId, CancellationToken.None);
        Assert.NotNull(recoveredState);
        Assert.Contains(recoveredState.Bookmarks, b => b.Name == WaitForApproverDecision.BookmarkNameConstant);
        await host.StopAsync();
    }

    [SqlServerFact]
    public async Task Processor_ReconcilesAfterEngineCommitBeforeAcknowledgement_OnSharedDatabase()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_Elsa_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;
        Guid operationId;
        await using (var db = new ApplicationDbContext(options))
        {
            await db.Database.MigrateAsync();
            var drawing = new DrawingFile { FileName = "test.pdf", StoredFileName = "test.pdf", FileType = "pdf", FileUrl = "/test.pdf", FileSizeBytes = 1, UploadedBy = "test" };
            var obj = new ConstructionObject { DrawingFile = drawing, PageNumber = 1, MarkerCoordinates = "{}", Name = "C01", CreatedBy = "test" };
            var inspection = new FormInspection { Object = obj };
            var operation = new InspectionWorkflowOperation { Inspection = inspection, InstanceId = Guid.NewGuid().ToString("N"), Action = "Start" };
            db.InspectionWorkflowOperations.Add(operation);
            await db.SaveChangesAsync();
            operationId = operation.Id;
        }

        using var host = CreateHost(connection);
        await host.StartAsync();
        using var scope = host.Services.CreateScope();
        var reconciler = new InspectionWorkflowReconciler(scope.ServiceProvider.GetRequiredService<IWorkflowRuntime>());
        await using (var db = new ApplicationDbContext(options))
        {
            var operation = await db.InspectionWorkflowOperations.SingleAsync(x => x.Id == operationId);
            await reconciler.ReconcileAsync(operation); // Elsa committed; business acknowledgement is lost.
        }
        await using (var db = new ApplicationDbContext(options))
        {
            var processor = new InspectionWorkflowOperationProcessor(db, reconciler, NullLogger<InspectionWorkflowOperationProcessor>.Instance);
            Assert.True(await processor.ProcessAsync(operationId));
        }

        Guid reviewId;
        await using (var db = new ApplicationDbContext(options))
        {
            var start = await db.InspectionWorkflowOperations.Include(x => x.Inspection).SingleAsync(x => x.Id == operationId);
            Assert.NotNull(start.CompletedAt);
            Assert.Equal(start.InstanceId, start.Inspection!.WorkflowInstanceId);
            var review = new InspectionWorkflowOperation { InspectionId = start.InspectionId, InstanceId = start.InstanceId, Action = "Review" };
            db.InspectionWorkflowOperations.Add(review);
            await db.SaveChangesAsync();
            reviewId = review.Id;
            await reconciler.ReconcileAsync(review); // Elsa advances; the acknowledgement is lost again.
        }
        await using (var db = new ApplicationDbContext(options))
        {
            var processor = new InspectionWorkflowOperationProcessor(db, reconciler, NullLogger<InspectionWorkflowOperationProcessor>.Instance);
            Assert.True(await processor.ProcessAsync(reviewId));
            var completed = await db.InspectionWorkflowOperations.AsNoTracking().SingleAsync(x => x.Id == reviewId);
            Assert.NotNull(completed.CompletedAt);
        }
        await host.StopAsync();
    }

    [SqlServerFact]
    public async Task Worker_OnNewHost_CompletesPreviouslyCommittedStart()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_Elsa_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;
        Guid operationId;
        await using (var db = new ApplicationDbContext(options))
        {
            await db.Database.MigrateAsync();
            var drawing = new DrawingFile { FileName = "test.pdf", StoredFileName = "test.pdf", FileType = "pdf", FileUrl = "/test.pdf", FileSizeBytes = 1, UploadedBy = "test" };
            var obj = new ConstructionObject { DrawingFile = drawing, PageNumber = 1, MarkerCoordinates = "{}", Name = "C01", CreatedBy = "test" };
            var inspection = new FormInspection { Object = obj };
            var operation = new InspectionWorkflowOperation { Inspection = inspection, InstanceId = Guid.NewGuid().ToString("N"), Action = "Start" };
            db.InspectionWorkflowOperations.Add(operation);
            await db.SaveChangesAsync();
            operationId = operation.Id;
        }
        // No worker ran before the committed operation was left behind.
        using var host = CreateHost(connection, enableWorker: true);
        await host.StartAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        while (true)
        {
            timeout.Token.ThrowIfCancellationRequested();
            await using var db = new ApplicationDbContext(options);
            var operation = await db.InspectionWorkflowOperations.AsNoTracking().Include(x => x.Inspection).SingleAsync(x => x.Id == operationId, timeout.Token);
            if (operation.CompletedAt != null)
            {
                Assert.Equal(operation.InstanceId, operation.Inspection!.WorkflowInstanceId);
                break;
            }
            await Task.Delay(200, timeout.Token);
        }
        await host.StopAsync();
    }

    [SqlServerFact]
    public async Task LegacyWaitingInspections_AreRecoveredWithoutNewApprovalHistory()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_Elsa_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;
        var objectId = Guid.NewGuid();
        var drawingId = Guid.NewGuid();
        var submittedId = Guid.NewGuid();
        var underReviewId = Guid.NewGuid();
        var reviewedId = Guid.NewGuid();
        await using (var db = new ApplicationDbContext(options))
        {
            await db.GetService<IMigrator>().MigrateAsync("20261024083332_AddNotificationsTable");
            await db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO DrawingFiles (Id, FileName, StoredFileName, FileType, FileUrl, FileSizeBytes, UploadedBy, UploadedAt)
VALUES ({drawingId}, 'legacy.pdf', 'legacy.pdf', 'pdf', '/legacy.pdf', {1L}, 'test', {DateTime.UtcNow});
INSERT INTO Objects (Id, DrawingFileId, PageNumber, MarkerCoordinates, Name, CreatedBy, CreatedAt)
VALUES ({objectId}, {drawingId}, {1}, '{{}}', 'C01', 'test', {DateTime.UtcNow});
INSERT INTO FormInspections (Id, ObjectId, FormSchemaId, FormDataJson, Status, WorkflowInstanceId, CreatedAt)
VALUES ({submittedId}, {objectId}, 'default', '{{}}', 'Submitted', 'legacy-submitted', {DateTime.UtcNow}),
       ({underReviewId}, {objectId}, 'default', '{{}}', 'UnderReview', 'legacy-under-review', {DateTime.UtcNow}),
       ({reviewedId}, {objectId}, 'default', '{{}}', 'Reviewed', 'legacy-reviewed', {DateTime.UtcNow});");
            await db.Database.MigrateAsync();
            Assert.Equal(3, await db.InspectionWorkflowOperations.CountAsync(x => x.CompletedAt == null));
        }
        using var host = CreateHost(connection, enableWorker: true);
        await host.StartAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(60));
        while (true)
        {
            timeout.Token.ThrowIfCancellationRequested();
            await using var db = new ApplicationDbContext(options);
            if (await db.InspectionWorkflowOperations.CountAsync(x => x.CompletedAt == null, timeout.Token) == 0)
            {
                var operations = await db.InspectionWorkflowOperations.AsNoTracking().ToListAsync(timeout.Token);
                Assert.Contains(operations, x => x.InspectionId == submittedId && x.PreviousInstanceId == "legacy-submitted" && x.Action == "RecoverReviewer");
                Assert.Contains(operations, x => x.InspectionId == underReviewId && x.PreviousInstanceId == "legacy-under-review" && x.Action == "RecoverReviewer");
                Assert.Contains(operations, x => x.InspectionId == reviewedId && x.PreviousInstanceId == "legacy-reviewed" && x.Action == "RecoverApprover");
                Assert.Equal(0, await db.InspectionAuditHistories.CountAsync(timeout.Token));
                using var scope = host.Services.CreateScope();
                var runtime = scope.ServiceProvider.GetRequiredService<IWorkflowRuntime>();
                var reviewOperation = operations.Single(x => x.InspectionId == reviewedId);
                var state = await runtime.ExportWorkflowStateAsync(reviewOperation.InstanceId, timeout.Token);
                Assert.NotNull(state);
                Assert.Contains(state.Bookmarks, b => b.Name == WaitForApproverDecision.BookmarkNameConstant);
                break;
            }
            await Task.Delay(200, timeout.Token);
        }
        await host.StopAsync();
    }

    private static IHost CreateHost(string connectionString, bool enableWorker = false) => new HostBuilder()
        .ConfigureServices(services =>
        {
            services.AddLogging();
            if (enableWorker)
            {
                services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString));
                services.AddScoped<IInspectionWorkflowReconciler, InspectionWorkflowReconciler>();
                services.AddScoped<InspectionWorkflowOperationProcessor>();
                services.AddHostedService<InspectionWorkflowWorker>();
            }
            services.AddElsa(elsa =>
            {
                elsa.UseWorkflowManagement(management => management.UseEntityFrameworkCore(ef => ef.UseSqlServer(connectionString)));
                elsa.UseWorkflowRuntime(runtime =>
                {
                    runtime.UseEntityFrameworkCore(ef => ef.UseSqlServer(connectionString));
                    runtime.AddWorkflow<InspectionApprovalWorkflow>();
                });
            });
        }).Build();
}
