using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Common.Exceptions;
using ConstructionProject.Domain.Constants;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Commands;

public record RejectInspectionCommand(
    Guid Id,
    string Reason,
    Guid? ActorId = null,
    string? ActorName = null,
    string? ActorRole = null,
    byte[]? RowVersion = null
) : IRequest<InspectionDto>;

public class RejectInspectionCommandValidator : AbstractValidator<RejectInspectionCommand>
{
    public RejectInspectionCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Id hồ sơ là bắt buộc.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Lý do từ chối không được để trống khi Reject hồ sơ.")
            .MinimumLength(3).WithMessage("Lý do từ chối phải có ít nhất 3 ký tự.");
    }
}

public class RejectInspectionCommandHandler : IRequestHandler<RejectInspectionCommand, InspectionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly INotificationService _notificationService;

    public RejectInspectionCommandHandler(
        IApplicationDbContext context, 
        INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<InspectionDto> Handle(RejectInspectionCommand request, CancellationToken cancellationToken)
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

        // Quy tắc State Transition: Chỉ từ chối khi hồ sơ đang trong luồng xét duyệt ('Submitted', 'UnderReview', 'Reviewed')
        if (inspection.Status != InspectionStatus.UnderReview && 
            inspection.Status != InspectionStatus.Reviewed &&
            inspection.Status != InspectionStatus.Submitted)
        {
            throw new InvalidOperationException($"Không thể từ chối hồ sơ đang ở trạng thái '{inspection.Status}'. Chỉ có thể từ chối khi đang trong luồng thẩm tra/phê duyệt.");
        }

        var requiredRole = inspection.Status == InspectionStatus.Reviewed ? RoleConstants.Approver : RoleConstants.Reviewer;
        if (!string.Equals(request.ActorRole, requiredRole, StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenAccessException("Bạn không có quyền từ chối hồ sơ ở cấp duyệt này.");

        var oldStatus = inspection.Status;
        inspection.Status = InspectionStatus.Rejected;
        inspection.RejectReason = request.Reason.Trim();
        inspection.UpdatedAt = DateTime.UtcNow;

        // Bắn tín hiệu từ chối đến Elsa Workflow
        InspectionWorkflowQueue.EnqueueDecision(_context, inspection,
            oldStatus == InspectionStatus.Reviewed ? "RejectApprover" : "RejectReviewer",
            request.ActorName, inspection.RejectReason);

        // Lưu vết lịch sử Audit
        var history = new InspectionAuditHistory
        {
            Id = Guid.NewGuid(),
            InspectionId = inspection.Id,
            FromStatus = oldStatus,
            ToStatus = inspection.Status,
            Action = "Reject",
            ActorId = request.ActorId,
            ActorName = request.ActorName ?? "Reviewer/Approver",
            ActorRole = request.ActorRole ?? "Reviewer",
            Comment = inspection.RejectReason,
            CreatedAt = DateTime.UtcNow
        };

        _context.InspectionAuditHistories.Add(history);
        await _context.SaveChangesAsync(cancellationToken);

        // Bắn thông báo cho Submitter (Kỹ sư nộp đơn) để họ biết lý do và khắc phục
        if (inspection.SubmittedById.HasValue)
        {
            await _notificationService.SendNotificationToUserAsync(inspection.SubmittedById.Value.ToString(), new NotificationMessage
            {
                Title = "Hồ sơ bị từ chối / Yêu cầu sửa đổi",
                Content = $"Đã ghi nhận yêu cầu sửa hồ sơ cấu kiện '{inspection.Object?.Name ?? "cấu kiện"}'. Lý do: \"{request.Reason}\". Quy trình đang được đồng bộ.",
                Type = "error",
                ReferenceId = inspection.Id.ToString(),
                ReferenceType = "Inspection",
                TargetUrl = "/submitter/inspections"
            }, cancellationToken);
        }

        // Nếu người từ chối là Approver (Chủ đầu tư), báo cho cả Reviewer (Tư vấn giám sát)
        if (string.Equals(request.ActorRole, "Approver", StringComparison.OrdinalIgnoreCase))
        {
            await _notificationService.SendNotificationToRoleAsync("Reviewer", new NotificationMessage
            {
                Title = "Chủ đầu tư đã từ chối hồ sơ",
                Content = $"Đã ghi nhận yêu cầu sửa hồ sơ '{inspection.Object?.Name ?? inspection.Id.ToString()}'. Lý do: \"{request.Reason}\". Quy trình đang được đồng bộ.",
                Type = "warning",
                ReferenceId = inspection.Id.ToString(),
                ReferenceType = "Inspection",
                TargetUrl = "/reviewer/checklists"
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
