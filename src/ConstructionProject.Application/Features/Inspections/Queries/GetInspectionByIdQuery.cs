using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Queries;

public record GetInspectionByIdQuery(Guid Id) : IRequest<InspectionDto?>;

public class GetInspectionByIdQueryHandler : IRequestHandler<GetInspectionByIdQuery, InspectionDto?>
{
    private readonly IApplicationDbContext _context;

    public GetInspectionByIdQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<InspectionDto?> Handle(GetInspectionByIdQuery request, CancellationToken cancellationToken)
    {
        var entity = await _context.FormInspections
            .AsNoTracking()
            .Include(i => i.Object)
                .ThenInclude(o => o!.DrawingFile)
            .Include(i => i.LinkedChecklistItems)
            .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

        if (entity == null)
        {
            return null;
        }

        return new InspectionDto
        {
            Id = entity.Id,
            ObjectId = entity.ObjectId,
            ObjectName = entity.Object?.Name ?? string.Empty,
            DrawingFileId = entity.Object?.DrawingFileId ?? Guid.Empty,
            DrawingFileName = entity.Object?.DrawingFile?.FileName ?? string.Empty,
            DrawingPageNumber = entity.Object?.PageNumber ?? 1,
            FormSchemaId = entity.FormSchemaId,
            FormDataJson = entity.FormDataJson,
            Status = entity.Status.ToString(),
            WorkflowInstanceId = entity.WorkflowInstanceId,
            SubmittedById = entity.SubmittedById,
            SubmittedBy = entity.SubmittedBy,
            SubmittedAt = entity.SubmittedAt,
            ReviewedById = entity.ReviewedById,
            ReviewedBy = entity.ReviewedBy,
            ReviewedAt = entity.ReviewedAt,
            ApprovedById = entity.ApprovedById,
            ApprovedBy = entity.ApprovedBy,
            ApprovedAt = entity.ApprovedAt,
            RejectReason = entity.RejectReason,
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            LinkedChecklistItemsCount = entity.LinkedChecklistItems?.Count ?? 0
        };
    }
}
