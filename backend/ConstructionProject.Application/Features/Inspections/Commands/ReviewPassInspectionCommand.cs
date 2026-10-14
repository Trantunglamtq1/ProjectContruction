using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Commands;

public record ReviewPassInspectionCommand(
    Guid Id,
    Guid? ReviewerId = null,
    string? ReviewerName = null,
    string? Comment = null
) : IRequest<InspectionDto>;

public class ReviewPassInspectionCommandHandler : IRequestHandler<ReviewPassInspectionCommand, InspectionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IInspectionWorkflowService _workflowService;

    public ReviewPassInspectionCommandHandler(IApplicationDbContext context, IInspectionWorkflowService workflowService)
    {
        _context = context;
        _workflowService = workflowService;
    }

    public async Task<InspectionDto> Handle(ReviewPassInspectionCommand request, CancellationToken cancellationToken)
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

        // Quy tắc State Transition: Phải đang ở trạng thái 'UnderReview'
        if (inspection.Status != InspectionStatus.UnderReview)
        {
            throw new InvalidOperationException($"Chỉ có thể duyệt thẩm tra Cấp 1 khi hồ sơ đang ở trạng thái 'UnderReview' (Đang thẩm tra). Trạng thái hiện tại: '{inspection.Status}'.");
        }

        var oldStatus = inspection.Status;
        inspection.Status = InspectionStatus.Reviewed;
        inspection.ReviewedById = request.ReviewerId ?? inspection.ReviewedById;
        inspection.ReviewedBy = !string.IsNullOrWhiteSpace(request.ReviewerName) ? request.ReviewerName : (inspection.ReviewedBy ?? "Reviewer");
        inspection.ReviewedAt = DateTime.UtcNow;
        inspection.UpdatedAt = DateTime.UtcNow;

        // Tiếp tục tiến trình Elsa Workflow sang cấp duyệt tiếp theo
        if (!string.IsNullOrWhiteSpace(inspection.WorkflowInstanceId))
        {
            await _workflowService.ResumeReviewerBookmarkAsync(
                inspection.WorkflowInstanceId,
                isApproved: true,
                inspection.ReviewedBy,
                request.Comment,
                cancellationToken);
        }

        // Lưu vết lịch sử Audit
        var history = new InspectionAuditHistory
        {
            Id = Guid.NewGuid(),
            InspectionId = inspection.Id,
            FromStatus = oldStatus,
            ToStatus = inspection.Status,
            Action = "ReviewPass",
            ActorId = request.ReviewerId,
            ActorName = inspection.ReviewedBy,
            ActorRole = "Reviewer",
            Comment = request.Comment ?? "Tư vấn giám sát đã thẩm tra đạt tiêu chuẩn kỹ thuật (Phê duyệt Cấp 1). Hồ sơ chuyển tiếp tới Chủ đầu tư / Quản lý dự án để phê duyệt nghiệm thu chính thức.",
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
