using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Workflows;
using ConstructionProject.Infrastructure.Workflows.Activities;
using Elsa.Workflows;
using Elsa.Workflows.Runtime.Contracts;
using Elsa.Workflows.Runtime.Parameters;
using Elsa.Workflows.State;

namespace ConstructionProject.Infrastructure.Services;

/// <summary>
/// Applies one durable intent to Elsa, or recognizes that Elsa already applied it.
/// Callers must serialize operations for an inspection across processes.
/// </summary>
public interface IInspectionWorkflowReconciler
{
    Task ReconcileAsync(InspectionWorkflowOperation operation, CancellationToken cancellationToken = default);
}

public sealed class InspectionWorkflowReconciler(IWorkflowRuntime runtime) : IInspectionWorkflowReconciler
{
    public async Task ReconcileAsync(InspectionWorkflowOperation operation, CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(operation.InstanceId);
        var state = await runtime.ExportWorkflowStateAsync(operation.InstanceId, cancellationToken);
        switch (operation.Action)
        {
            case "Start":
            case "RecoverReviewer":
                if (state == null)
                {
                    await runtime.StartWorkflowAsync(InspectionApprovalWorkflow.WorkflowDefinitionId,
                        new StartWorkflowRuntimeParams { InstanceId = operation.InstanceId, CorrelationId = operation.InspectionId.ToString() });
                    state = await runtime.ExportWorkflowStateAsync(operation.InstanceId, cancellationToken);
                }
                RequireBookmark(state, WaitForReviewerDecision.BookmarkNameConstant);
                return;
            case "RecoverApprover":
                if (state == null)
                {
                    await runtime.StartWorkflowAsync(InspectionApprovalWorkflow.WorkflowDefinitionId,
                        new StartWorkflowRuntimeParams { InstanceId = operation.InstanceId, CorrelationId = operation.InspectionId.ToString() });
                    state = await runtime.ExportWorkflowStateAsync(operation.InstanceId, cancellationToken);
                }
                if (HasBookmark(state, WaitForReviewerDecision.BookmarkNameConstant))
                {
                    await ResumeAsync(operation.InstanceId, RequireBookmark(state, WaitForReviewerDecision.BookmarkNameConstant), cancellationToken);
                    state = await runtime.ExportWorkflowStateAsync(operation.InstanceId, cancellationToken);
                }
                RequireBookmark(state, WaitForApproverDecision.BookmarkNameConstant);
                return;
            case "Review":
                if (HasBookmark(state, WaitForApproverDecision.BookmarkNameConstant)) return;
                await ResumeAsync(operation.InstanceId, RequireBookmark(state, WaitForReviewerDecision.BookmarkNameConstant), cancellationToken);
                state = await runtime.ExportWorkflowStateAsync(operation.InstanceId, cancellationToken);
                RequireBookmark(state, WaitForApproverDecision.BookmarkNameConstant);
                return;
            case "Approve":
                if (state?.SubStatus == WorkflowSubStatus.Finished) return;
                await ResumeAsync(operation.InstanceId, RequireBookmark(state, WaitForApproverDecision.BookmarkNameConstant), cancellationToken);
                state = await runtime.ExportWorkflowStateAsync(operation.InstanceId, cancellationToken);
                if (state?.SubStatus != WorkflowSubStatus.Finished)
                    throw new InvalidOperationException("Workflow chưa hoàn tất sau khi phê duyệt.");
                return;
            case "RejectReviewer":
            case "RejectApprover":
                if (state?.SubStatus == WorkflowSubStatus.Cancelled) return;
                RequireBookmark(state, operation.Action == "RejectReviewer" ? WaitForReviewerDecision.BookmarkNameConstant : WaitForApproverDecision.BookmarkNameConstant);
                await runtime.CancelWorkflowAsync(operation.InstanceId, cancellationToken);
                state = await runtime.ExportWorkflowStateAsync(operation.InstanceId, cancellationToken);
                if (state?.SubStatus != WorkflowSubStatus.Cancelled)
                    throw new InvalidOperationException("Workflow chưa được kết thúc sau khi từ chối.");
                return;
            default:
                throw new InvalidOperationException("Lệnh đồng bộ workflow không hợp lệ.");
        }
    }

    private async Task ResumeAsync(string instanceId, string bookmarkId, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        await runtime.ResumeWorkflowAsync(instanceId, new ResumeWorkflowRuntimeParams { BookmarkId = bookmarkId });
    }

    private static bool HasBookmark(WorkflowState? state, string name) =>
        state?.SubStatus == WorkflowSubStatus.Suspended && state.Bookmarks.Any(x => x.Name == name);

    private static string RequireBookmark(WorkflowState? state, string name)
    {
        if (!HasBookmark(state, name))
            throw new InvalidOperationException("Trạng thái workflow không khớp với lệnh đang chờ; cần đối soát.");
        return state!.Bookmarks.Single(x => x.Name == name).Id;
    }
}
