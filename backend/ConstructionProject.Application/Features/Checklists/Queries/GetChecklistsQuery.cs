using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Queries;

public record GetChecklistsQuery(
    Guid? ObjectId = null,
    string? Status = null
) : IRequest<List<ChecklistDto>>;

public class GetChecklistsQueryHandler : IRequestHandler<GetChecklistsQuery, List<ChecklistDto>>
{
    private readonly IApplicationDbContext _context;

    public GetChecklistsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ChecklistDto>> Handle(GetChecklistsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Checklists
            .Include(c => c.Object)
                .ThenInclude(o => o!.DrawingFile)
            .Include(c => c.Items)
            .AsNoTracking()
            .AsQueryable();

        if (request.ObjectId.HasValue && request.ObjectId.Value != Guid.Empty)
        {
            query = query.Where(c => c.ObjectId == request.ObjectId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Status) && Enum.TryParse<ChecklistStatus>(request.Status, true, out var statusEnum))
        {
            query = query.Where(c => c.Status == statusEnum);
        }

        var list = await query
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

        return list.Select(checklist =>
        {
            var activeItems = checklist.Items.Where(i => !i.IsDeleted).ToList();
            return new ChecklistDto
            {
                Id = checklist.Id,
                ObjectId = checklist.ObjectId,
                ObjectName = checklist.Object?.Name ?? string.Empty,
                DrawingFileId = checklist.Object?.DrawingFileId ?? Guid.Empty,
                DrawingFileName = checklist.Object?.DrawingFile?.FileName ?? string.Empty,
                DrawingPageNumber = checklist.Object?.PageNumber ?? 1,
                Name = checklist.Name,
                Description = checklist.Description,
                Status = checklist.Status.ToString(),
                WorkflowInstanceId = checklist.WorkflowInstanceId,
                RejectReason = checklist.RejectReason,
                CreatedById = checklist.CreatedById,
                CreatedBy = checklist.CreatedBy,
                CreatedAt = checklist.CreatedAt,
                ReviewedById = checklist.ReviewedById,
                ReviewedBy = checklist.ReviewedBy,
                ReviewedAt = checklist.ReviewedAt,
                ItemsCount = activeItems.Count,
                RequiredItemsCount = activeItems.Count(i => i.IsRequired),
                DoneItemsCount = activeItems.Count(i => i.Status == ChecklistItemStatus.Done),
                Items = activeItems.OrderBy(i => i.OrderIndex).Select(i => new ChecklistItemDto
                {
                    Id = i.Id,
                    ChecklistId = i.ChecklistId,
                    Name = i.Name,
                    OrderIndex = i.OrderIndex,
                    IsRequired = i.IsRequired,
                    FormSchemaJson = i.FormSchemaJson,
                    LinkedInspectionId = i.LinkedInspectionId,
                    Status = i.Status.ToString()
                }).ToList()
            };
        }).ToList();
    }
}
