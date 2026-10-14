namespace ConstructionProject.Application.Common.Interfaces;

/// <summary>
/// Quản lý vòng đời quy trình phê duyệt hồ sơ kiểm tra hiện trường (Inspection Approval)
/// sử dụng Elsa Workflow 3.x Engine.
/// </summary>
public interface IInspectionWorkflowService
{
    /// <summary>
    /// Khởi chạy instance quy trình Elsa Workflow khi Submitter nộp hồ sơ.
    /// </summary>
    Task<string?> StartApprovalWorkflowAsync(Guid inspectionId, string? submitterName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Tiếp tục tiến trình khi Reviewer thẩm tra Cấp 1 (Đạt hoặc Từ chối).
    /// </summary>
    Task<bool> ResumeReviewerBookmarkAsync(string workflowInstanceId, bool isApproved, string? reviewerName, string? comment, CancellationToken cancellationToken = default);

    /// <summary>
    /// Tiếp tục tiến trình khi Approver phê duyệt nghiệm thu Cấp 2 (Nghiệm thu hoặc Từ chối).
    /// </summary>
    Task<bool> ResumeApproverBookmarkAsync(string workflowInstanceId, bool isApproved, string? approverName, string? comment, CancellationToken cancellationToken = default);
}
