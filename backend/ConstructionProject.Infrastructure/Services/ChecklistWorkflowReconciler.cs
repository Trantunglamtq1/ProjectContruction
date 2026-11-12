using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Workflows;
using ConstructionProject.Infrastructure.Workflows.Activities;
using Elsa.Workflows;
using Elsa.Workflows.Runtime.Contracts;
using Elsa.Workflows.Runtime.Parameters;
using Elsa.Workflows.State;

namespace ConstructionProject.Infrastructure.Services;

public interface IChecklistWorkflowReconciler
{
    Task ReconcileAsync(ChecklistWorkflowOperation operation, CancellationToken cancellationToken = default);
}

public sealed class ChecklistWorkflowReconciler(IWorkflowRuntime runtime) : IChecklistWorkflowReconciler
{
    public async Task ReconcileAsync(ChecklistWorkflowOperation operation, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(operation.InstanceId);
        var state = await runtime.ExportWorkflowStateAsync(operation.InstanceId, cancellationToken);
        switch (operation.Action)
        {
            case "Start":
            case "Recover":
                if (state == null)
                {
                    await runtime.StartWorkflowAsync(ChecklistApprovalWorkflow.WorkflowDefinitionId,
                        new StartWorkflowRuntimeParams { InstanceId = operation.InstanceId, CorrelationId = operation.ChecklistId.ToString() });
                    state = await runtime.ExportWorkflowStateAsync(operation.InstanceId, cancellationToken);
                }
                RequireBookmark(state);
                return;
            case "Approve":
                if (state?.SubStatus == WorkflowSubStatus.Finished) return;
                await runtime.ResumeWorkflowAsync(operation.InstanceId, new ResumeWorkflowRuntimeParams { BookmarkId = RequireBookmark(state) });
                state = await runtime.ExportWorkflowStateAsync(operation.InstanceId, cancellationToken);
                if (state?.SubStatus != WorkflowSubStatus.Finished)
                    throw new InvalidOperationException("Workflow chưa hoàn tất sau khi phê duyệt.");
                return;
            case "Reject":
                if (state?.SubStatus == WorkflowSubStatus.Cancelled) return;
                RequireBookmark(state);
                await runtime.CancelWorkflowAsync(operation.InstanceId, cancellationToken);
                state = await runtime.ExportWorkflowStateAsync(operation.InstanceId, cancellationToken);
                if (state?.SubStatus != WorkflowSubStatus.Cancelled)
                    throw new InvalidOperationException("Workflow chưa kết thúc sau khi từ chối.");
                return;
            default:
                throw new InvalidOperationException("Lệnh đồng bộ workflow không hợp lệ.");
        }
    }

    private static string RequireBookmark(WorkflowState? state)
    {
        if (state?.SubStatus != WorkflowSubStatus.Suspended)
            throw new InvalidOperationException("Trạng thái workflow không khớp; cần đối soát.");
        return state.Bookmarks.Single(x => x.Name == WaitForSupervisorChecklistDecision.BookmarkNameConstant).Id;
    }
}
