using ConstructionProject.Application.Common.Interfaces;
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
    string? ActorRole = null
) : IRequest<InspectionDto>;

public class RejectInspectionCommandValidator : AbstractValidator<RejectInspectionCommand>
{
    public RejectInspectionCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Id hồ sơ là bắt buộc.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Lý do từ chối không được để trống khi Reject hồ sơ.")
            .MinimumLength(5).WithMessage("Lý do từ chối phải có ít nhất 5 ký tự để đảm bảo tính minh bạch.");
    }
}

public class RejectInspectionCommandHandler : IRequestHandler<RejectInspectionCommand, InspectionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IInspectionWorkflowService _workflowService;

    public RejectInspectionCommandHandler(IApplicationDbContext context, IInspectionWorkflowService workflowService)
    {
        _context = context;
        _workflowService = workflowService;
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

        // Quy tắc State Transition: Chỉ từ chối khi hồ sơ đang trong luồng xét duyệt ('Submitted', 'UnderReview', 'Reviewed')
        if (inspection.Status != InspectionStatus.UnderReview && 
            inspection.Status != InspectionStatus.Reviewed &&
            inspection.Status != InspectionStatus.Submitted)
        {
            throw new InvalidOperationException($"Không thể từ chối hồ sơ đang ở trạng thái '{inspection.Status}'. Chỉ có thể từ chối khi đang trong luồng thẩm tra/phê duyệt.");
        }

        var oldStatus = inspection.Status;
        inspection.Status = InspectionStatus.Rejected;
        inspection.RejectReason = request.Reason.Trim();
        inspection.UpdatedAt = DateTime.UtcNow;

        // Bắn tín hiệu từ chối đến Elsa Workflow
        if (!string.IsNullOrWhiteSpace(inspection.WorkflowInstanceId))
        {
            if (oldStatus == InspectionStatus.Reviewed)
            {
                await _workflowService.ResumeApproverBookmarkAsync(
                    inspection.WorkflowInstanceId,
                    isApproved: false,
                    request.ActorName,
                    inspection.RejectReason,
                    cancellationToken);
            }
            else
            {
                await _workflowService.ResumeReviewerBookmarkAsync(
                    inspection.WorkflowInstanceId,
                    isApproved: false,
                    request.ActorName,
                    inspection.RejectReason,
                    cancellationToken);
            }
        }

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
