using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Commands;

public record ReviewInspectionCommand(
    Guid Id,
    Guid? ReviewerId = null,
    string? ReviewerName = null,
    string? Comment = null,
    byte[]? RowVersion = null
) : IRequest<InspectionDto>;

public class ReviewInspectionCommandHandler : IRequestHandler<ReviewInspectionCommand, InspectionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly INotificationService _notificationService;

    public ReviewInspectionCommandHandler(
        IApplicationDbContext context, 
        INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<InspectionDto> Handle(ReviewInspectionCommand request, CancellationToken cancellationToken)
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

        // Hồ sơ phải được tiếp nhận trước khi thẩm tra.
        if (inspection.Status != InspectionStatus.UnderReview)
        {
            throw new InvalidOperationException($"Chỉ có thể thẩm tra hồ sơ đã được tiếp nhận ('UnderReview'). Trạng thái hiện tại: '{inspection.Status}'.");
        }

        var oldStatus = inspection.Status;
        inspection.Status = InspectionStatus.Reviewed;
        inspection.ReviewedById = request.ReviewerId ?? inspection.ReviewedById;
        inspection.ReviewedBy = !string.IsNullOrWhiteSpace(request.ReviewerName) ? request.ReviewerName : (inspection.ReviewedBy ?? "Reviewer");
        inspection.ReviewedAt = DateTime.UtcNow;
        inspection.UpdatedAt = DateTime.UtcNow;

        // Tiếp tục tiến trình Elsa Workflow sang cấp duyệt tiếp theo
        InspectionWorkflowQueue.EnqueueDecision(_context, inspection, "Review", inspection.ReviewedBy, request.Comment);

        // Lưu vết lịch sử Audit
        var history = new InspectionAuditHistory
        {
            Id = Guid.NewGuid(),
            InspectionId = inspection.Id,
            FromStatus = oldStatus,
            ToStatus = inspection.Status,
            Action = "Review",
            ActorId = request.ReviewerId,
            ActorName = inspection.ReviewedBy,
            ActorRole = "Reviewer",
            Comment = request.Comment ?? "Tư vấn giám sát đã thẩm tra đạt tiêu chuẩn kỹ thuật (Phê duyệt Cấp 1). Hồ sơ chuyển tiếp tới Chủ đầu tư / Quản lý dự án để phê duyệt nghiệm thu chính thức.",
            CreatedAt = DateTime.UtcNow
        };

        _context.InspectionAuditHistories.Add(history);
        await _context.SaveChangesAsync(cancellationToken);

        // Bắn thông báo cho Role Approver (Chủ đầu tư)
        await _notificationService.SendNotificationToRoleAsync("Approver", new NotificationMessage
        {
            Title = "Đã ghi nhận thẩm tra cấp 1",
            Content = $"Đã ghi nhận thẩm tra hồ sơ '{inspection.Object?.Name ?? inspection.Id.ToString()}'. Quy trình đang được đồng bộ.",
            Type = "info",
            ReferenceId = inspection.Id.ToString(),
            ReferenceType = "Inspection",
            TargetUrl = "/approver/checklists"
        }, cancellationToken);

        // Bắn thông báo cho Submitter (Kỹ sư nộp đơn)
        if (inspection.SubmittedById.HasValue)
        {
            await _notificationService.SendNotificationToUserAsync(inspection.SubmittedById.Value.ToString(), new NotificationMessage
            {
                Title = "Đã ghi nhận thẩm tra cấp 1",
                Content = $"Đã ghi nhận thẩm tra hồ sơ cấu kiện '{inspection.Object?.Name ?? "cấu kiện"}'. Quy trình đang được đồng bộ.",
                Type = "success",
                ReferenceId = inspection.Id.ToString(),
                ReferenceType = "Inspection",
                TargetUrl = "/submitter/inspections"
            }, cancellationToken);
        }

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
