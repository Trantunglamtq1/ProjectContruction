using System.Data;
using ConstructionProject.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ConstructionProject.Infrastructure.Services;

/// <summary>Processes a durable inspection operation under a SQL Server session lock.</summary>
public sealed class InspectionWorkflowOperationProcessor(
    ApplicationDbContext db,
    IInspectionWorkflowReconciler reconciler,
    ILogger<InspectionWorkflowOperationProcessor> logger)
{
    public async Task<bool> ProcessAsync(Guid operationId, CancellationToken cancellationToken = default)
    {
        // The lock is held on this connection throughout the Elsa call. A second process
        // cannot enter even if a retry interval expires while the first call is running.
        var connection = db.Database.GetDbConnection() as SqlConnection
            ?? throw new InvalidOperationException("Đồng bộ workflow yêu cầu SQL Server.");
        await connection.OpenAsync(cancellationToken);
        string? resource = null;
        var lockAcquired = false;
        try
        {
            var inspectionId = await db.InspectionWorkflowOperations.AsNoTracking()
                .Where(x => x.Id == operationId && x.CompletedAt == null)
                .Select(x => (Guid?)x.InspectionId).SingleOrDefaultAsync(cancellationToken);
            if (!inspectionId.HasValue) return false;
            resource = $"inspection-workflow:{inspectionId.Value:N}";
            lockAcquired = await TryLockAsync(connection, resource, cancellationToken);
            if (!lockAcquired) return false;

            var operation = await db.InspectionWorkflowOperations.Include(x => x.Inspection)
                .SingleOrDefaultAsync(x => x.Id == operationId && x.CompletedAt == null, cancellationToken);
            if (operation == null || operation.NextAttemptAt > DateTime.UtcNow) return false;
            try
            {
                if (operation.Inspection == null)
                    throw new InvalidOperationException("Không tìm thấy hồ sơ cho lệnh đồng bộ.");
                if ((operation.Action is "Start" or "RecoverReviewer" or "RecoverApprover") && !string.IsNullOrEmpty(operation.Inspection.WorkflowInstanceId)
                    && operation.Inspection.WorkflowInstanceId != operation.InstanceId)
                    throw new InvalidOperationException("Hồ sơ đã liên kết một workflow khác; cần đối soát.");

                await reconciler.ReconcileAsync(operation, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogError("Không thể đồng bộ workflow cho operation {OperationId}; loại lỗi {ErrorType}", operation.Id, ex.GetType().Name);
                operation.AttemptCount++;
                operation.LastError = "Không thể đồng bộ workflow; cần thử lại hoặc đối soát.";
                operation.NextAttemptAt = DateTime.UtcNow.AddSeconds(Math.Min(300, Math.Pow(2, Math.Min(operation.AttemptCount, 8))));
                await db.SaveChangesAsync(cancellationToken);
                return false;
            }

            if (operation.Action is "Start" or "RecoverReviewer" or "RecoverApprover")
                operation.Inspection!.WorkflowInstanceId = operation.InstanceId;
            operation.CompletedAt = DateTime.UtcNow;
            operation.LastError = null;
            // If acknowledgement fails, the pending operation remains and its next attempt
            // checks Elsa before deciding whether to issue another engine command.
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        finally
        {
            if (lockAcquired && resource != null && connection.State == ConnectionState.Open)
                await ReleaseLockAsync(connection, resource);
            await connection.CloseAsync();
        }
    }

    private static async Task<bool> TryLockAsync(SqlConnection connection, string resource, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "sp_getapplock";
        command.CommandType = CommandType.StoredProcedure;
        command.Parameters.AddWithValue("@Resource", resource);
        command.Parameters.AddWithValue("@LockMode", "Exclusive");
        command.Parameters.AddWithValue("@LockOwner", "Session");
        command.Parameters.AddWithValue("@LockTimeout", 0);
        var result = command.Parameters.Add("@RETURN_VALUE", SqlDbType.Int);
        result.Direction = ParameterDirection.ReturnValue;
        await command.ExecuteNonQueryAsync(cancellationToken);
        return (int)result.Value >= 0;
    }

    private static async Task ReleaseLockAsync(SqlConnection connection, string resource)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "sp_releaseapplock";
        command.CommandType = CommandType.StoredProcedure;
        command.Parameters.AddWithValue("@Resource", resource);
        command.Parameters.AddWithValue("@LockOwner", "Session");
        await command.ExecuteNonQueryAsync(CancellationToken.None);
    }
}
