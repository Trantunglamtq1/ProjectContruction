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
    string? Comment = null,
    byte[]? RowVersion = null
) : IRequest<InspectionDto>;

public class ApproveInspectionCommandHandler : IRequestHandler<ApproveInspectionCommand, InspectionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly INotificationService _notificationService;

    public ApproveInspectionCommandHandler(
        IApplicationDbContext context, 
        INotificationService notificationService)
    {
        _context = context;
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

        InspectionVersionGuard.EnsureCurrent(request.RowVersion, inspection.RowVersion);
        await InspectionWorkflowQueue.EnsureReadyAsync(_context, inspection.Id, cancellationToken);

        // Phải qua thẩm tra Reviewer trước khi phê duyệt.
        if (inspection.Status != InspectionStatus.Reviewed)
        {
            throw new InvalidOperationException($"Chỉ có thể phê duyệt hồ sơ đã qua thẩm tra ('Reviewed'). Trạng thái hiện tại: '{inspection.Status}'.");
        }

        var oldStatus = inspection.Status;
        inspection.Status = InspectionStatus.Approved;
        inspection.ApprovedById = request.ApproverId;
        inspection.ApprovedBy = !string.IsNullOrWhiteSpace(request.ApproverName) ? request.ApproverName : "Approver";
        inspection.ApprovedAt = DateTime.UtcNow;
        inspection.UpdatedAt = DateTime.UtcNow;

        // Tiếp tục và hoàn tất tiến trình Elsa Workflow
        InspectionWorkflowQueue.EnqueueDecision(_context, inspection, "Approve", inspection.ApprovedBy, request.Comment);

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
                Title = "Đã ghi nhận phê duyệt cấp 2",
                Content = $"Đã ghi nhận phê duyệt hồ sơ cấu kiện '{inspection.Object?.Name ?? "cấu kiện"}'. Quy trình đang được đồng bộ.",
                Type = "success",
                ReferenceId = inspection.Id.ToString(),
                ReferenceType = "Inspection",
                TargetUrl = "/submitter/inspections"
            }, cancellationToken);
        }

        // Bắn thông báo cho Role Reviewer
        await _notificationService.SendNotificationToRoleAsync("Reviewer", new NotificationMessage
        {
            Title = "Đã ghi nhận phê duyệt cấp 2",
            Content = $"Đã ghi nhận phê duyệt hồ sơ '{inspection.Object?.Name ?? inspection.Id.ToString()}'. Quy trình đang được đồng bộ.",
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
            RowVersion = inspection.RowVersion,
            WorkflowSyncStatus = "Pending",
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
