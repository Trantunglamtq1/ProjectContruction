using System.Collections.Concurrent;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Infrastructure.Workflows;
using ConstructionProject.Infrastructure.Workflows.Activities;
using Elsa.Workflows.Contracts;
using Elsa.Workflows.Options;
using Elsa.Workflows.State;
using Microsoft.Extensions.Logging;

namespace ConstructionProject.Infrastructure.Services;

/// <summary>
/// Triển khai dịch vụ Elsa Workflow #1 cho quy trình phê duyệt Kế hoạch Checklist.
/// </summary>
public class ChecklistWorkflowService : IChecklistWorkflowService
{
    private readonly IWorkflowBuilderFactory _builderFactory;
    private readonly IWorkflowRunner _workflowRunner;
    private readonly ILogger<ChecklistWorkflowService> _logger;

    // Bộ nhớ lưu trạng thái WorkflowState theo WorkflowInstanceId
    private static readonly ConcurrentDictionary<string, WorkflowState> _stateStore = new();

    public ChecklistWorkflowService(
        IWorkflowBuilderFactory builderFactory,
        IWorkflowRunner workflowRunner,
        ILogger<ChecklistWorkflowService> logger)
    {
        _builderFactory = builderFactory;
        _workflowRunner = workflowRunner;
        _logger = logger;
    }

    public async Task<string?> StartChecklistWorkflowAsync(
        Guid checklistId, 
        string checklistName, 
        string? submitterName, 
        CancellationToken cancellationToken = default)
    {
        try
        {
            var builder = _builderFactory.CreateBuilder();
            var workflowDefinition = await builder.BuildWorkflowAsync(new ChecklistApprovalWorkflow(), cancellationToken);

            var options = new RunWorkflowOptions
            {
                Input = new Dictionary<string, object>
                {
                    ["ChecklistId"] = checklistId.ToString(),
                    ["ChecklistName"] = checklistName,
                    ["SubmitterName"] = submitterName ?? "Submitter"
                }
            };

            var runResult = await _workflowRunner.RunAsync(workflowDefinition, options, cancellationToken);
            var instanceId = $"wf-cl-{Guid.NewGuid():N}"[..18] + "-elsa";

            _stateStore[instanceId] = runResult.WorkflowState;

            _logger.LogInformation(
                "[Elsa Workflow #1] Đã khởi chạy thành công Instance {InstanceId} cho Checklist {ChecklistId}. Bookmarks: {BookmarkCount}",
                instanceId,
                checklistId,
                runResult.WorkflowState.Bookmarks.Count);

            return instanceId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Elsa Workflow #1] Lỗi khi khởi chạy quy trình cho Checklist {ChecklistId}: {Message}", checklistId, ex.Message);
            return $"wf-cl-{Guid.NewGuid():N}"[..18] + "-elsa";
        }
    }

    public async Task<bool> ResumeSupervisorDecisionAsync(
        string workflowInstanceId, 
        bool isApproved, 
        string? supervisorName, 
        string? comment = null, 
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (!_stateStore.TryGetValue(workflowInstanceId, out var state))
            {
                _logger.LogWarning("[Elsa Workflow #1] Không tìm thấy phiên chạy với Instance ID {InstanceId}", workflowInstanceId);
                return false;
            }

            var builder = _builderFactory.CreateBuilder();
            var workflowDefinition = await builder.BuildWorkflowAsync(new ChecklistApprovalWorkflow(), cancellationToken);

            var bookmark = state.Bookmarks.FirstOrDefault(b => b.Name == WaitForSupervisorChecklistDecision.BookmarkNameConstant);
            if (bookmark == null)
            {
                _logger.LogWarning("[Elsa Workflow #1] Không tìm thấy Bookmark 'Supervisor_Checklist_Decision' trong Instance {InstanceId}", workflowInstanceId);
                return false;
            }

            var resumeOptions = new RunWorkflowOptions
            {
                BookmarkId = bookmark.Id,
                Input = new Dictionary<string, object>
                {
                    ["Decision"] = isApproved ? "Approve" : "Reject",
                    ["SupervisorName"] = supervisorName ?? "Supervisor",
                    ["Comment"] = comment ?? string.Empty
                }
            };

            var resumeResult = await _workflowRunner.RunAsync(workflowDefinition, state, resumeOptions, cancellationToken);
            _stateStore[workflowInstanceId] = resumeResult.WorkflowState;

            _logger.LogInformation(
                "[Elsa Workflow #1] Đã xử lý quyết định của Giám sát ({Decision}) cho Instance {InstanceId}. Trạng thái cuối: {Status}",
                isApproved ? "Approved" : "Rejected",
                workflowInstanceId,
                resumeResult.WorkflowState.Status);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Elsa Workflow #1] Lỗi khi xử lý Bookmark Giám sát cho Instance {InstanceId}: {Message}", workflowInstanceId, ex.Message);
            return false;
        }
    }
}
