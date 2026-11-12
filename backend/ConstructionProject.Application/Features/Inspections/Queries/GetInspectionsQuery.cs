using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Queries;

public record GetInspectionsQuery(
    Guid? ObjectId = null,
    Guid? DrawingFileId = null,
    Guid? ChecklistId = null,
    Guid? ChecklistItemId = null,
    InspectionStatus? Status = null,
    string? Search = null,
    int PageNumber = 1,
    int PageSize = 10
) : IRequest<InspectionListResult>;

public class GetInspectionsQueryHandler : IRequestHandler<GetInspectionsQuery, InspectionListResult>
{
    private readonly IApplicationDbContext _context;

    public GetInspectionsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<InspectionListResult> Handle(GetInspectionsQuery request, CancellationToken cancellationToken)
    {
        var pageNumber = Math.Max(1, request.PageNumber);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var query = _context.FormInspections
            .AsNoTracking()
            .Include(i => i.Object)
                .ThenInclude(o => o!.DrawingFile)
            .Include(i => i.Checklist)
            .Include(i => i.ChecklistItem)
            .Include(i => i.LinkedChecklistItems)
            .Include(i => i.WorkflowOperations)
            .AsQueryable();

        // Lọc theo ChecklistId
        if (request.ChecklistId.HasValue && request.ChecklistId.Value != Guid.Empty)
        {
            query = query.Where(i => i.ChecklistId == request.ChecklistId.Value);
        }

        // Lọc theo ChecklistItemId
        if (request.ChecklistItemId.HasValue && request.ChecklistItemId.Value != Guid.Empty)
        {
            query = query.Where(i => i.ChecklistItemId == request.ChecklistItemId.Value);
        }

        // Lọc theo ObjectId
        if (request.ObjectId.HasValue && request.ObjectId.Value != Guid.Empty)
        {
            query = query.Where(i => i.ObjectId == request.ObjectId.Value);
        }

        // Lọc theo DrawingFileId (thông qua Object)
        if (request.DrawingFileId.HasValue && request.DrawingFileId.Value != Guid.Empty)
        {
            query = query.Where(i => i.Object != null && i.Object.DrawingFileId == request.DrawingFileId.Value);
        }

        // Lọc theo Status
        if (request.Status.HasValue)
        {
            query = query.Where(i => i.Status == request.Status.Value);
        }

        // Support the displayed eight-character code (# optional) and full GUID,
        // alongside the existing text search. Short codes are not unique IDs.
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLowerInvariant();
            var code = search.StartsWith('#') ? search[1..] : search;
            var isFullId = Guid.TryParse(code, out var inspectionId);
            var isShortCode = code.Length == 8 && code.All(Uri.IsHexDigit);
            query = query.Where(i =>
                (isFullId && i.Id == inspectionId) ||
                (isShortCode && i.Id.ToString().ToLower().StartsWith(code)) ||
                (i.Object != null && i.Object.Name.ToLower().Contains(search)) ||
                (i.SubmittedBy != null && i.SubmittedBy.ToLower().Contains(search)) ||
                (i.Object != null && i.Object.DrawingFile != null && i.Object.DrawingFile.FileName.ToLower().Contains(search))
            );
        }

        var groupedCounts = await query
            .GroupBy(i => i.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() })
            .ToDictionaryAsync(group => group.Status, group => group.Count, cancellationToken);
        var statusCounts = Enum.GetValues<InspectionStatus>()
            .ToDictionary(status => status.ToString(), status => groupedCounts.GetValueOrDefault(status));
        var totalCount = statusCounts.Values.Sum();

        var entities = await query
            .OrderByDescending(i => i.CreatedAt)
            .ThenByDescending(i => i.Id)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = entities.Select(entity => new InspectionDto
        {
            Id = entity.Id,
            ObjectId = entity.ObjectId,
            ObjectName = entity.Object?.Name ?? string.Empty,
            DrawingFileId = entity.Object?.DrawingFileId ?? Guid.Empty,
            DrawingFileName = entity.Object?.DrawingFile?.FileName ?? string.Empty,
            DrawingPageNumber = entity.Object?.PageNumber ?? 1,
            ChecklistId = entity.ChecklistId,
            ChecklistName = entity.Checklist?.Name,
            ChecklistItemId = entity.ChecklistItemId,
            ChecklistItemName = entity.ChecklistItem?.Name,
            FormSchemaId = entity.FormSchemaId,
            FormSchemaJson = entity.ChecklistItem?.FormSchemaJson,
            FormDataJson = entity.FormDataJson,
            Status = entity.Status.ToString(),
            WorkflowInstanceId = entity.WorkflowInstanceId,
            RowVersion = entity.RowVersion,
            WorkflowSyncStatus = InspectionWorkflowSync.GetStatus(entity),
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
        }).ToList();

        return new InspectionListResult
        {
            Items = dtos,
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize,
            StatusCounts = statusCounts,
        };
    }
}
