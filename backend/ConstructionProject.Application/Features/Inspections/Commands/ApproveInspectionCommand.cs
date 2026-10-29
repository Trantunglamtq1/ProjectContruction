using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Commands;

public record ApproveInspectionCommand(
    Guid Id,
    Guid? ApproverId = null,
    string? ApproverName = null,
    string? Comment = null
) : IRequest<InspectionDto>;

public class ApproveInspectionCommandHandler : IRequestHandler<ApproveInspectionCommand, InspectionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IInspectionWorkflowService _workflowService;
    private readonly INotificationService _notificationService;

    public ApproveInspectionCommandHandler(
        IApplicationDbContext context, 
        IInspectionWorkflowService workflowService,
        INotificationService notificationService)
    {
        _context = context;
        _workflowService = workflowService;
        _notificationService = notificationService;
    }

    public async Task<InspectionDto> Handle(ApproveInspectionCommand request, CancellationToken cancellationToken)
    {
        var inspection = await _context.FormInspections
            .Include(i => i.Object)
                .ThenInclude(o => o!.DrawingFile)
            .Include(i => i.LinkedChecklistItems)
            .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

        if (inspection == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy Form Inspection với Id = {request.Id}.");
        }

        // Quy tắc State Transition: Phải qua thẩm tra Reviewer ('Reviewed') hoặc 'UnderReview'
        if (inspection.Status != InspectionStatus.Reviewed && inspection.Status != InspectionStatus.UnderReview)
        {
            throw new InvalidOperationException($"Chỉ có thể phê duyệt nghiệm thu chính thức đối với hồ sơ đã qua thẩm tra ('Reviewed' hoặc 'UnderReview'). Trạng thái hiện tại: '{inspection.Status}'.");
        }

        var oldStatus = inspection.Status;
        inspection.Status = InspectionStatus.Approved;
        inspection.ApprovedById = request.ApproverId;
        inspection.ApprovedBy = !string.IsNullOrWhiteSpace(request.ApproverName) ? request.ApproverName : "Approver";
        inspection.ApprovedAt = DateTime.UtcNow;
        inspection.UpdatedAt = DateTime.UtcNow;

        // Tiếp tục và hoàn tất tiến trình Elsa Workflow
        if (!string.IsNullOrWhiteSpace(inspection.WorkflowInstanceId))
        {
            await _workflowService.ResumeApproverBookmarkAsync(
                inspection.WorkflowInstanceId,
                isApproved: true,
                inspection.ApprovedBy,
                request.Comment,
                cancellationToken);
        }

        // SIDE-EFFECT QUAN TRỌNG: Tự động chuyển toàn bộ các ChecklistItem liên kết sang 'Done'
        var linkedItems = await _context.ChecklistItems
            .Include(ci => ci.Checklist)
                .ThenInclude(c => c!.Items)
            .Where(ci => ci.LinkedInspectionId == inspection.Id)
            .ToListAsync(cancellationToken);

        var affectedChecklists = new HashSet<Checklist>();

        foreach (var item in linkedItems)
        {
            item.Status = ChecklistItemStatus.Done;
            if (item.Checklist != null)
            {
                affectedChecklists.Add(item.Checklist);
            }
        }

        // Tự động kiểm tra hoàn tất Checklist nếu tất cả các tiêu chí bắt buộc (IsRequired = true) đã 'Done'
        foreach (var checklist in affectedChecklists)
        {
            var allRequiredDone = checklist.Items
                .Where(x => x.IsRequired)
                .All(x => x.Status == ChecklistItemStatus.Done || (x.LinkedInspectionId == inspection.Id));

            if (allRequiredDone && checklist.Items.Any(x => x.IsRequired))
            {
                checklist.Status = ChecklistStatus.Completed;
            }
            else if (checklist.Status == ChecklistStatus.Approved || checklist.Status == ChecklistStatus.Draft)
            {
                checklist.Status = ChecklistStatus.InProgress;
            }
        }

        // Lưu vết lịch sử Audit
        var history = new InspectionAuditHistory
        {
            Id = Guid.NewGuid(),
            InspectionId = inspection.Id,
            FromStatus = oldStatus,
            ToStatus = inspection.Status,
            Action = "Approve",
            ActorId = request.ApproverId,
            ActorName = inspection.ApprovedBy,
            ActorRole = "Approver",
            Comment = request.Comment ?? $"Chủ đầu tư / Quản lý dự án đã phê duyệt nghiệm thu chính thức Cấp 2. Tự động đồng bộ {linkedItems.Count} tiêu chí Checklist liên kết sang 'Done'.",
            CreatedAt = DateTime.UtcNow
        };

        _context.InspectionAuditHistories.Add(history);
        await _context.SaveChangesAsync(cancellationToken);

        // Bắn thông báo cho Submitter (Kỹ sư nộp đơn)
        if (inspection.SubmittedById.HasValue)
        {
            await _notificationService.SendNotificationToUserAsync(inspection.SubmittedById.Value.ToString(), new NotificationMessage
            {
                Title = "Nghiệm thu chính thức thành công (Cấp 2)",
                Content = $"Chủ đầu tư đã phê duyệt nghiệm thu hồ sơ cấu kiện '{inspection.Object?.Name ?? "cấu kiện"}' (Mã: {inspection.Id.ToString()[..8]}). Các tiêu chí Checklist đã hoàn tất.",
                Type = "success",
                ReferenceId = inspection.Id.ToString(),
                ReferenceType = "Inspection",
                TargetUrl = "/submitter/inspections"
            }, cancellationToken);
        }

        // Bắn thông báo cho Role Reviewer
        await _notificationService.SendNotificationToRoleAsync("Reviewer", new NotificationMessage
        {
            Title = "Hồ sơ đã được Chủ đầu tư nghiệm thu",
            Content = $"Chủ đầu tư {inspection.ApprovedBy} đã phê duyệt nghiệm thu hồ sơ '{inspection.Object?.Name ?? inspection.Id.ToString()}'.",
            Type = "success",
            ReferenceId = inspection.Id.ToString(),
            ReferenceType = "Inspection",
            TargetUrl = "/reviewer/checklists"
        }, cancellationToken);

        return new InspectionDto
        {
            Id = inspection.Id,
            ObjectId = inspection.ObjectId,
            ObjectName = inspection.Object?.Name ?? string.Empty,
            DrawingFileId = inspection.Object?.DrawingFileId ?? Guid.Empty,
            DrawingFileName = inspection.Object?.DrawingFile?.FileName ?? string.Empty,
            DrawingPageNumber = inspection.Object?.PageNumber ?? 1,
            FormSchemaId = inspection.FormSchemaId,
            FormDataJson = inspection.FormDataJson,
            Status = inspection.Status.ToString(),
            WorkflowInstanceId = inspection.WorkflowInstanceId,
            SubmittedById = inspection.SubmittedById,
            SubmittedBy = inspection.SubmittedBy,
            SubmittedAt = inspection.SubmittedAt,
            ReviewedById = inspection.ReviewedById,
            ReviewedBy = inspection.ReviewedBy,
            ReviewedAt = inspection.ReviewedAt,
            ApprovedById = inspection.ApprovedById,
            ApprovedBy = inspection.ApprovedBy,
            ApprovedAt = inspection.ApprovedAt,
            RejectReason = inspection.RejectReason,
            CreatedAt = inspection.CreatedAt,
            UpdatedAt = inspection.UpdatedAt,
            LinkedChecklistItemsCount = inspection.LinkedChecklistItems?.Count ?? 0
        };
    }
}
