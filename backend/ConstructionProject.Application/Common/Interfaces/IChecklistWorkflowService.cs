namespace ConstructionProject.Application.Common.Interfaces;

/// <summary>
/// Giao diện điều phối vòng đời Elsa Workflow #1 cho Kế hoạch Checklist.
/// </summary>
public interface IChecklistWorkflowService
{
    /// <summary>
    /// Khởi chạy quy trình thẩm định Kế hoạch Checklist khi Kỹ sư gửi duyệt.
    /// </summary>
    Task<string?> StartChecklistWorkflowAsync(
        Guid checklistId, 
        string checklistName, 
        string? submitterName, 
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Tiếp tục tiến trình khi Giám sát đưa ra quyết định (Duyệt hoặc Từ chối).
    /// </summary>
    Task<bool> ResumeSupervisorDecisionAsync(
        string workflowInstanceId, 
        bool isApproved, 
        string? supervisorName, 
        string? comment = null, 
        CancellationToken cancellationToken = default);
}
