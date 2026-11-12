using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using ConstructionProject.Infrastructure.Services;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.DependencyInjection;

namespace ConstructionProject.IntegrationTests;

public class InspectionWorkflowOperationProcessorTests
{
    [SqlServerFact]
    public async Task Worker_ProcessesDueOperations_AndDoesNotRepeatCompletedWork()
    {
        var (options, operationId) = await CreateOperationAsync();
        var reconciler = new CountingReconciler();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddScoped(_ => new ApplicationDbContext(options));
        services.AddSingleton<IInspectionWorkflowReconciler>(reconciler);
        services.AddScoped<InspectionWorkflowOperationProcessor>();
        await using var provider = services.BuildServiceProvider();
        var worker = new InspectionWorkflowWorker(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<InspectionWorkflowWorker>.Instance);

        await worker.ProcessDueAsync();
        await worker.ProcessDueAsync();

        await using var check = new ApplicationDbContext(options);
        Assert.NotNull((await check.InspectionWorkflowOperations.SingleAsync(x => x.Id == operationId)).CompletedAt);
        Assert.Equal(1, reconciler.Calls);
    }

    [SqlServerFact]
    public async Task CompetingProcessors_OnlyOneEntersElsaAndAcknowledges()
    {
        var (options, operationId) = await CreateOperationAsync();
        var reconciler = new BlockingReconciler();
        await using var firstDb = new ApplicationDbContext(options);
        await using var secondDb = new ApplicationDbContext(options);
        var first = new InspectionWorkflowOperationProcessor(firstDb, reconciler, NullLogger<InspectionWorkflowOperationProcessor>.Instance);
        var second = new InspectionWorkflowOperationProcessor(secondDb, reconciler, NullLogger<InspectionWorkflowOperationProcessor>.Instance);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        var running = first.ProcessAsync(operationId, timeout.Token);
        try
        {
            await reconciler.Entered.Task.WaitAsync(timeout.Token);
            Assert.False(await second.ProcessAsync(operationId, timeout.Token));
        }
        finally { reconciler.Release.TrySetResult(); }
        Assert.True(await running);
        await using var check = new ApplicationDbContext(options);
        var operation = await check.InspectionWorkflowOperations.Include(x => x.Inspection).SingleAsync(x => x.Id == operationId);
        Assert.NotNull(operation.CompletedAt);
        Assert.Equal(operation.InstanceId, operation.Inspection!.WorkflowInstanceId);
        Assert.Equal(1, reconciler.Calls);
    }

    [SqlServerFact]
    public async Task FailedAttempt_RemainsPendingAndCanBeRetried()
    {
        var (options, operationId) = await CreateOperationAsync();
        await using (var db = new ApplicationDbContext(options))
        {
            var processor = new InspectionWorkflowOperationProcessor(db, new FailingReconciler(), NullLogger<InspectionWorkflowOperationProcessor>.Instance);
            Assert.False(await processor.ProcessAsync(operationId));
        }
        await using (var db = new ApplicationDbContext(options))
        {
            var operation = await db.InspectionWorkflowOperations.SingleAsync(x => x.Id == operationId);
            Assert.Null(operation.CompletedAt);
            Assert.Equal(1, operation.AttemptCount);
            Assert.NotNull(operation.LastError);
            operation.NextAttemptAt = DateTime.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        }
        await using (var db = new ApplicationDbContext(options))
        {
            var processor = new InspectionWorkflowOperationProcessor(db, new SucceedingReconciler(), NullLogger<InspectionWorkflowOperationProcessor>.Instance);
            Assert.True(await processor.ProcessAsync(operationId));
        }
        await using var check = new ApplicationDbContext(options);
        var completed = await check.InspectionWorkflowOperations.SingleAsync(x => x.Id == operationId);
        Assert.NotNull(completed.CompletedAt);
        Assert.Null(completed.LastError);
    }

    private static async Task<(DbContextOptions<ApplicationDbContext>, Guid)> CreateOperationAsync()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
        };
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer(connection.ConnectionString, sql => sql.EnableRetryOnFailure()).Options;
        await using var db = new ApplicationDbContext(options);
        await db.Database.MigrateAsync();
        var drawing = new DrawingFile { FileName = "test.pdf", StoredFileName = "test.pdf", FileType = "pdf", FileUrl = "/test.pdf", FileSizeBytes = 1, UploadedBy = "test" };
        var obj = new ConstructionObject { DrawingFile = drawing, PageNumber = 1, MarkerCoordinates = "{}", Name = "C01", CreatedBy = "test" };
        var inspection = new FormInspection { Object = obj };
        var operation = new InspectionWorkflowOperation { Inspection = inspection, InstanceId = Guid.NewGuid().ToString("N"), Action = "Start" };
        db.InspectionWorkflowOperations.Add(operation);
        await db.SaveChangesAsync();
        return (options, operation.Id);
    }

    private sealed class BlockingReconciler : IInspectionWorkflowReconciler
    {
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public int Calls { get; private set; }
        public async Task ReconcileAsync(InspectionWorkflowOperation operation, CancellationToken cancellationToken = default)
        {
            Calls++;
            Entered.TrySetResult();
            await Release.Task.WaitAsync(cancellationToken);
        }
    }
    private sealed class FailingReconciler : IInspectionWorkflowReconciler
    {
        public Task ReconcileAsync(InspectionWorkflowOperation operation, CancellationToken cancellationToken = default) => throw new InvalidOperationException("simulated error");
    }
    private sealed class SucceedingReconciler : IInspectionWorkflowReconciler
    {
        public Task ReconcileAsync(InspectionWorkflowOperation operation, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
    private sealed class CountingReconciler : IInspectionWorkflowReconciler
    {
        public int Calls { get; private set; }
        public Task ReconcileAsync(InspectionWorkflowOperation operation, CancellationToken cancellationToken = default)
        {
            Calls++;
            return Task.CompletedTask;
        }
    }
}
