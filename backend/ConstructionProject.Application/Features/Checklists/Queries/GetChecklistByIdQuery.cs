using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Queries;

public record GetChecklistByIdQuery(Guid Id) : IRequest<ChecklistDto?>;

public class GetChecklistByIdQueryHandler : IRequestHandler<GetChecklistByIdQuery, ChecklistDto?>
{
    private readonly IApplicationDbContext _context;

    public GetChecklistByIdQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ChecklistDto?> Handle(GetChecklistByIdQuery request, CancellationToken cancellationToken)
    {
        var checklist = await _context.Checklists
            .Include(c => c.Object)
                .ThenInclude(o => o!.DrawingFile)
            .Include(c => c.Items)
                .ThenInclude(i => i.LinkedInspection)
            .Include(c => c.AuditHistories)
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);

        if (checklist == null) return null;

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
                LinkedInspectionStatus = i.LinkedInspection?.Status.ToString(),
                Status = i.Status.ToString()
            }).ToList(),
            AuditHistories = checklist.AuditHistories.OrderByDescending(a => a.CreatedAt).Select(a => new ChecklistAuditHistoryDto
            {
                Id = a.Id,
                ChecklistId = a.ChecklistId,
                FromStatus = a.FromStatus,
                ToStatus = a.ToStatus,
                Action = a.Action,
                ActorId = a.ActorId,
                ActorName = a.ActorName,
                ActorRole = a.ActorRole,
                Comment = a.Comment,
                DetailsJson = a.DetailsJson,
                CreatedAt = a.CreatedAt
            }).ToList()
        };
    }
}
