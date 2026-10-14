using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Commands;

public record ReceiveInspectionCommand(
    Guid Id,
    Guid? ReviewerId = null,
    string? ReviewerName = null,
    string? Comment = null
) : IRequest<InspectionDto>;

public class ReceiveInspectionCommandHandler : IRequestHandler<ReceiveInspectionCommand, InspectionDto>
{
    private readonly IApplicationDbContext _context;

    public ReceiveInspectionCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<InspectionDto> Handle(ReceiveInspectionCommand request, CancellationToken cancellationToken)
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

        // Quy tắc State Transition: Chỉ tiếp nhận hồ sơ đang ở trạng thái 'Submitted'
        if (inspection.Status != InspectionStatus.Submitted)
        {
            throw new InvalidOperationException($"Chỉ có thể tiếp nhận thẩm tra hồ sơ khi đang ở trạng thái 'Submitted' (Chờ thẩm tra). Trạng thái hiện tại: '{inspection.Status}'.");
        }

        var oldStatus = inspection.Status;
        inspection.Status = InspectionStatus.UnderReview;
        inspection.ReviewedById = request.ReviewerId;
        inspection.ReviewedBy = !string.IsNullOrWhiteSpace(request.ReviewerName) ? request.ReviewerName : "Reviewer";
        inspection.ReviewedAt = DateTime.UtcNow;
        inspection.UpdatedAt = DateTime.UtcNow;

        // Lưu vết lịch sử Audit
        var history = new InspectionAuditHistory
        {
            Id = Guid.NewGuid(),
            InspectionId = inspection.Id,
            FromStatus = oldStatus,
            ToStatus = inspection.Status,
            Action = "Receive",
            ActorId = request.ReviewerId,
            ActorName = inspection.ReviewedBy,
            ActorRole = "Reviewer",
            Comment = request.Comment ?? "Tư vấn giám sát đã tiếp nhận hồ sơ kiểm tra để thẩm tra hiện trường.",
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
