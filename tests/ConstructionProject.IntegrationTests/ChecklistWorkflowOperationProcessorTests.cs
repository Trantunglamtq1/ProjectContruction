using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using ConstructionProject.Infrastructure.Services;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.DependencyInjection;

namespace ConstructionProject.IntegrationTests;

public class ChecklistWorkflowOperationProcessorTests
{
    [ChecklistWorkflowSqlFact]
    public async Task Worker_ProcessesDueOperations_AndDoesNotRepeatCompletedWork()
    {
        var (options, operationId) = await CreateOperationAsync();
        var reconciler = new CountingReconciler();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddScoped(_ => new ApplicationDbContext(options));
        services.AddSingleton<IChecklistWorkflowReconciler>(reconciler);
        services.AddScoped<ChecklistWorkflowOperationProcessor>();
        await using var provider = services.BuildServiceProvider();
        var worker = new ChecklistWorkflowWorker(provider.GetRequiredService<IServiceScopeFactory>(), NullLogger<ChecklistWorkflowWorker>.Instance);

        await worker.ProcessDueAsync();
        await worker.ProcessDueAsync();

        await using var check = new ApplicationDbContext(options);
        Assert.NotNull((await check.ChecklistWorkflowOperations.SingleAsync(x => x.Id == operationId)).CompletedAt);
        Assert.Equal(1, reconciler.Calls);
    }

    [ChecklistWorkflowSqlFact]
    public async Task CompetingProcessors_OnlyOneEntersElsaAndAcknowledges()
    {
        var (options, operationId) = await CreateOperationAsync();
        var reconciler = new BlockingReconciler();
        await using var firstDb = new ApplicationDbContext(options);
        await using var secondDb = new ApplicationDbContext(options);
        var first = new ChecklistWorkflowOperationProcessor(firstDb, reconciler, NullLogger<ChecklistWorkflowOperationProcessor>.Instance);
        var second = new ChecklistWorkflowOperationProcessor(secondDb, reconciler, NullLogger<ChecklistWorkflowOperationProcessor>.Instance);
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
        var operation = await check.ChecklistWorkflowOperations.Include(x => x.Checklist).SingleAsync(x => x.Id == operationId);
        Assert.NotNull(operation.CompletedAt);
        Assert.Equal(operation.InstanceId, operation.Checklist!.WorkflowInstanceId);
        Assert.Equal(1, reconciler.Calls);
    }

    [ChecklistWorkflowSqlFact]
    public async Task FailedAttempt_RemainsPendingAndCanBeRetried()
    {
        var (options, operationId) = await CreateOperationAsync();
        await using (var db = new ApplicationDbContext(options))
        {
            var processor = new ChecklistWorkflowOperationProcessor(db, new FailingReconciler(), NullLogger<ChecklistWorkflowOperationProcessor>.Instance);
            Assert.False(await processor.ProcessAsync(operationId));
        }
        await using (var db = new ApplicationDbContext(options))
        {
            var operation = await db.ChecklistWorkflowOperations.SingleAsync(x => x.Id == operationId);
            Assert.Null(operation.CompletedAt);
            Assert.Equal(1, operation.AttemptCount);
            Assert.NotNull(operation.LastError);
            operation.NextAttemptAt = DateTime.UtcNow.AddSeconds(-1);
            await db.SaveChangesAsync();
        }
        await using (var db = new ApplicationDbContext(options))
        {
            var processor = new ChecklistWorkflowOperationProcessor(db, new SucceedingReconciler(), NullLogger<ChecklistWorkflowOperationProcessor>.Instance);
            Assert.True(await processor.ProcessAsync(operationId));
        }
        await using var check = new ApplicationDbContext(options);
        var completed = await check.ChecklistWorkflowOperations.SingleAsync(x => x.Id == operationId);
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
        var checklist = new Checklist { Object = obj, Name = "Checklist", CreatedBy = "test" };
        var operation = new ChecklistWorkflowOperation { Checklist = checklist, InstanceId = Guid.NewGuid().ToString("N"), Action = "Start" };
        db.ChecklistWorkflowOperations.Add(operation);
        await db.SaveChangesAsync();
        return (options, operation.Id);
    }

    private sealed class BlockingReconciler : IChecklistWorkflowReconciler
    {
        public TaskCompletionSource Entered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource Release { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public int Calls { get; private set; }
        public async Task ReconcileAsync(ChecklistWorkflowOperation operation, CancellationToken cancellationToken = default)
        {
            Calls++;
            Entered.TrySetResult();
            await Release.Task.WaitAsync(cancellationToken);
        }
    }
    private sealed class FailingReconciler : IChecklistWorkflowReconciler
    {
        public Task ReconcileAsync(ChecklistWorkflowOperation operation, CancellationToken cancellationToken = default) => throw new InvalidOperationException("simulated error");
    }
    private sealed class SucceedingReconciler : IChecklistWorkflowReconciler
    {
        public Task ReconcileAsync(ChecklistWorkflowOperation operation, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
    private sealed class CountingReconciler : IChecklistWorkflowReconciler
    {
        public int Calls { get; private set; }
        public Task ReconcileAsync(ChecklistWorkflowOperation operation, CancellationToken cancellationToken = default)
        {
            Calls++;
            return Task.CompletedTask;
        }
    }
}
