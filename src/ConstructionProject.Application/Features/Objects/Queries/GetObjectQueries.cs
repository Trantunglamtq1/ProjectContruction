using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Objects.Queries;

public record GetObjectsQuery(Guid? DrawingFileId = null) : IRequest<List<ObjectDto>>;

public class GetObjectsQueryHandler : IRequestHandler<GetObjectsQuery, List<ObjectDto>>
{
    private readonly IApplicationDbContext _context;

    public GetObjectsQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<ObjectDto>> Handle(GetObjectsQuery request, CancellationToken cancellationToken)
    {
        var query = _context.Objects
            .AsNoTracking()
            .Include(o => o.DrawingFile)
            .Include(o => o.FormInspections)
            .Include(o => o.Checklists)
            .AsQueryable();

        if (request.DrawingFileId.HasValue && request.DrawingFileId.Value != Guid.Empty)
        {
            query = query.Where(o => o.DrawingFileId == request.DrawingFileId.Value);
        }

        return await query
            .OrderBy(o => o.PageNumber)
            .ThenByDescending(o => o.CreatedAt)
            .Select(o => new ObjectDto
            {
                Id = o.Id,
                DrawingFileId = o.DrawingFileId,
                DrawingFileName = o.DrawingFile != null ? o.DrawingFile.FileName : string.Empty,
                PageNumber = o.PageNumber,
                MarkerCoordinates = o.MarkerCoordinates,
                Name = o.Name,
                CreatedBy = o.CreatedBy,
                CreatedAt = o.CreatedAt,
                InspectionCount = o.FormInspections.Count,
                ChecklistCount = o.Checklists.Count
            })
            .ToListAsync(cancellationToken);
    }
}

public record GetObjectByIdQuery(Guid Id) : IRequest<ObjectDto?>;

public class GetObjectByIdQueryHandler : IRequestHandler<GetObjectByIdQuery, ObjectDto?>
{
    private readonly IApplicationDbContext _context;

    public GetObjectByIdQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ObjectDto?> Handle(GetObjectByIdQuery request, CancellationToken cancellationToken)
    {
        var o = await _context.Objects
            .AsNoTracking()
            .Include(x => x.DrawingFile)
            .Include(x => x.FormInspections)
            .Include(x => x.Checklists)
            .FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken);

        if (o == null) return null;

        return new ObjectDto
        {
            Id = o.Id,
            DrawingFileId = o.DrawingFileId,
            DrawingFileName = o.DrawingFile != null ? o.DrawingFile.FileName : string.Empty,
            PageNumber = o.PageNumber,
            MarkerCoordinates = o.MarkerCoordinates,
            Name = o.Name,
            CreatedBy = o.CreatedBy,
            CreatedAt = o.CreatedAt,
            InspectionCount = o.FormInspections.Count,
            ChecklistCount = o.Checklists.Count
        };
    }
}
