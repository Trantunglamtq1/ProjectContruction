using ConstructionProject.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace ConstructionProject.Infrastructure.Services;

/// <summary>Retries durable inspection workflow operations without blocking request threads.</summary>
public sealed class InspectionWorkflowWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<InspectionWorkflowWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(2));
        do
        {
            try
            {
                await ProcessDueAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Do not log connection strings or request data from provider exceptions.
                logger.LogError("Không thể xử lý hàng đợi workflow; loại lỗi {ErrorType}", ex.GetType().Name);
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public async Task ProcessDueAsync(CancellationToken cancellationToken = default)
    {
        List<Guid> operationIds;
        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var now = DateTime.UtcNow;
            operationIds = await db.InspectionWorkflowOperations.AsNoTracking()
                .Where(x => x.CompletedAt == null && x.NextAttemptAt <= now)
                .OrderBy(x => x.NextAttemptAt).ThenBy(x => x.CreatedAt)
                .Select(x => x.Id).Take(32).ToListAsync(cancellationToken);
        }

        foreach (var operationId in operationIds)
        {
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                using var scope = scopeFactory.CreateScope();
                var processor = scope.ServiceProvider.GetRequiredService<InspectionWorkflowOperationProcessor>();
                await processor.ProcessAsync(operationId, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                // A failed acknowledgement remains pending for the next pass.
                logger.LogError("Không thể xử lý lệnh workflow {OperationId}; loại lỗi {ErrorType}", operationId, ex.GetType().Name);
            }
        }
    }
}
