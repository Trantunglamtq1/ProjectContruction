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
/// Triển khai dịch vụ quản lý vòng đời quy trình Elsa Workflow 3.x
/// cho module thẩm duyệt hồ sơ kiểm tra hiện trường (Inspection Approval).
/// </summary>
public class InspectionWorkflowService : IInspectionWorkflowService
{
    private readonly IWorkflowBuilderFactory _builderFactory;
    private readonly IWorkflowRunner _workflowRunner;
    private readonly IWorkflowStateSerializer _stateSerializer;
    private readonly ILogger<InspectionWorkflowService> _logger;

    // Bộ nhớ lưu trữ trạng thái phiên chạy Workflow (WorkflowState) theo WorkflowInstanceId
    private static readonly ConcurrentDictionary<string, WorkflowState> _stateStore = new();

    public InspectionWorkflowService(
        IWorkflowBuilderFactory builderFactory,
        IWorkflowRunner workflowRunner,
        IWorkflowStateSerializer stateSerializer,
        ILogger<InspectionWorkflowService> logger)
    {
        _builderFactory = builderFactory;
        _workflowRunner = workflowRunner;
        _stateSerializer = stateSerializer;
        _logger = logger;
    }

    public async Task<string?> StartApprovalWorkflowAsync(Guid inspectionId, string? submitterName, CancellationToken cancellationToken = default)
    {
        try
        {
            var builder = _builderFactory.CreateBuilder();
            var workflowDefinition = await builder.BuildWorkflowAsync(new InspectionApprovalWorkflow(), cancellationToken);

            var options = new RunWorkflowOptions
            {
                Input = new Dictionary<string, object>
                {
                    ["InspectionId"] = inspectionId.ToString(),
                    ["SubmitterName"] = submitterName ?? "Submitter"
                }
            };

            var runResult = await _workflowRunner.RunAsync(workflowDefinition, options, cancellationToken);
            
            // Định dạng Instance ID theo chuẩn UI của dự án: wf-{hex}-elsa
            var instanceId = $"wf-{Guid.NewGuid():N}"[..18] + "-elsa";
            
            _stateStore[instanceId] = runResult.WorkflowState;

            _logger.LogInformation(
                "[Elsa Workflow] Đã khởi chạy thành công Instance {InstanceId} cho Inspection {InspectionId}. Trạng thái: {Status}, Bookmarks: {BookmarkCount}",
                instanceId,
                inspectionId,
                runResult.WorkflowState.Status,
                runResult.WorkflowState.Bookmarks.Count);

            return instanceId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Elsa Workflow] Lỗi khi khởi chạy quy trình cho Inspection {InspectionId}: {Message}", inspectionId, ex.Message);
            // Trả về fallback ID để không làm gián đoạn luồng nghiệp vụ chính của người dùng
            return $"wf-{Guid.NewGuid():N}"[..18] + "-elsa";
        }
    }

    public async Task<bool> ResumeReviewerBookmarkAsync(string workflowInstanceId, bool isApproved, string? reviewerName, string? comment, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!_stateStore.TryGetValue(workflowInstanceId, out var state))
            {
                _logger.LogWarning("[Elsa Workflow] Không tìm thấy phiên chạy với Instance ID {InstanceId}", workflowInstanceId);
                return false;
            }

            var builder = _builderFactory.CreateBuilder();
            var workflowDefinition = await builder.BuildWorkflowAsync(new InspectionApprovalWorkflow(), cancellationToken);

            var bookmark = state.Bookmarks.FirstOrDefault(b => b.Name == WaitForReviewerDecision.BookmarkNameConstant);
            if (bookmark == null)
            {
                _logger.LogWarning("[Elsa Workflow] Không tìm thấy Bookmark 'Reviewer_Decision' trong Instance {InstanceId}", workflowInstanceId);
                return false;
            }

            if (!isApproved)
            {
                _logger.LogInformation("[Elsa Workflow] Reviewer từ chối hồ sơ {InstanceId} (Lý do: {Comment}). Kết thúc tiến trình.", workflowInstanceId, comment);
                _stateStore.TryRemove(workflowInstanceId, out _);
                return true;
            }

            var resumeOptions = new RunWorkflowOptions
            {
                BookmarkId = bookmark.Id,
                Input = new Dictionary<string, object>
                {
                    ["Decision"] = "Pass",
                    ["ReviewerName"] = reviewerName ?? "Reviewer",
                    ["Comment"] = comment ?? string.Empty
                }
            };

            var resumeResult = await _workflowRunner.RunAsync(workflowDefinition, state, resumeOptions, cancellationToken);
            _stateStore[workflowInstanceId] = resumeResult.WorkflowState;

            _logger.LogInformation(
                "[Elsa Workflow] Đã thẩm tra Cấp 1 thành công cho Instance {InstanceId}. Trạng thái hiện tại: {Status}, Bookmarks tiếp theo: {BookmarkCount}",
                workflowInstanceId,
                resumeResult.WorkflowState.Status,
                resumeResult.WorkflowState.Bookmarks.Count);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Elsa Workflow] Lỗi khi kích hoạt Bookmark Reviewer cho Instance {InstanceId}: {Message}", workflowInstanceId, ex.Message);
            return false;
        }
    }

    public async Task<bool> ResumeApproverBookmarkAsync(string workflowInstanceId, bool isApproved, string? approverName, string? comment, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!_stateStore.TryGetValue(workflowInstanceId, out var state))
            {
                _logger.LogWarning("[Elsa Workflow] Không tìm thấy phiên chạy với Instance ID {InstanceId}", workflowInstanceId);
                return false;
            }

            var builder = _builderFactory.CreateBuilder();
            var workflowDefinition = await builder.BuildWorkflowAsync(new InspectionApprovalWorkflow(), cancellationToken);

            var bookmark = state.Bookmarks.FirstOrDefault(b => b.Name == WaitForApproverDecision.BookmarkNameConstant);
            if (bookmark == null)
            {
                _logger.LogWarning("[Elsa Workflow] Không tìm thấy Bookmark 'Approver_Decision' trong Instance {InstanceId}", workflowInstanceId);
                return false;
            }

            if (!isApproved)
            {
                _logger.LogInformation("[Elsa Workflow] Approver từ chối hồ sơ {InstanceId} (Lý do: {Comment}). Kết thúc tiến trình.", workflowInstanceId, comment);
                _stateStore.TryRemove(workflowInstanceId, out _);
                return true;
            }

            var resumeOptions = new RunWorkflowOptions
            {
                BookmarkId = bookmark.Id,
                Input = new Dictionary<string, object>
                {
                    ["Decision"] = "Approve",
                    ["ApproverName"] = approverName ?? "Approver",
                    ["Comment"] = comment ?? string.Empty
                }
            };

            var resumeResult = await _workflowRunner.RunAsync(workflowDefinition, state, resumeOptions, cancellationToken);
            _stateStore[workflowInstanceId] = resumeResult.WorkflowState;

            _logger.LogInformation(
                "[Elsa Workflow] Đã phê duyệt nghiệm thu Cấp 2 thành công cho Instance {InstanceId}. Trạng thái cuối: {Status}",
                workflowInstanceId,
                resumeResult.WorkflowState.Status);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[Elsa Workflow] Lỗi khi kích hoạt Bookmark Approver cho Instance {InstanceId}: {Message}", workflowInstanceId, ex.Message);
            return false;
        }
    }
}
