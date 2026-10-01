using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Drawings.Queries;

public record GetDrawingFilesQuery(string? Search = null) : IRequest<List<DrawingFileDto>>;

public class GetDrawingFilesQueryHandler : IRequestHandler<GetDrawingFilesQuery, List<DrawingFileDto>>
{
    private readonly IApplicationDbContext _context;

    public GetDrawingFilesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<DrawingFileDto>> Handle(GetDrawingFilesQuery request, CancellationToken cancellationToken)
    {
        var query = _context.DrawingFiles.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim().ToLower();
            query = query.Where(d => d.FileName.ToLower().Contains(term) || d.StoredFileName.ToLower().Contains(term));
        }

        return await query
            .OrderByDescending(d => d.UploadedAt)
            .Select(d => new DrawingFileDto
            {
                Id = d.Id,
                FileName = d.FileName,
                FileType = d.FileType,
                FileUrl = d.FileUrl,
                FileSizeBytes = d.FileSizeBytes,
                UploadedBy = d.UploadedBy,
                UploadedAt = d.UploadedAt,
                ObjectCount = d.Objects.Count
            })
            .ToListAsync(cancellationToken);
    }
}

public record GetDrawingFileByIdQuery(Guid Id) : IRequest<DrawingFileDetailDto?>;

public class GetDrawingFileByIdQueryHandler : IRequestHandler<GetDrawingFileByIdQuery, DrawingFileDetailDto?>
{
    private readonly IApplicationDbContext _context;

    public GetDrawingFileByIdQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<DrawingFileDetailDto?> Handle(GetDrawingFileByIdQuery request, CancellationToken cancellationToken)
    {
        var drawing = await _context.DrawingFiles
            .AsNoTracking()
            .Include(d => d.Objects)
                .ThenInclude(o => o.FormInspections)
            .Include(d => d.Objects)
                .ThenInclude(o => o.Checklists)
            .FirstOrDefaultAsync(d => d.Id == request.Id, cancellationToken);

        if (drawing == null) return null;

        return new DrawingFileDetailDto
        {
            Id = drawing.Id,
            FileName = drawing.FileName,
            FileType = drawing.FileType,
            FileUrl = drawing.FileUrl,
            FileSizeBytes = drawing.FileSizeBytes,
            UploadedBy = drawing.UploadedBy,
            UploadedAt = drawing.UploadedAt,
            Objects = drawing.Objects
                .OrderBy(o => o.PageNumber)
                .ThenBy(o => o.CreatedAt)
                .Select(o => new ObjectDto
                {
                    Id = o.Id,
                    DrawingFileId = o.DrawingFileId,
                    DrawingFileName = drawing.FileName,
                    PageNumber = o.PageNumber,
                    MarkerCoordinates = o.MarkerCoordinates,
                    Name = o.Name,
                    CreatedBy = o.CreatedBy,
                    CreatedAt = o.CreatedAt,
                    InspectionCount = o.FormInspections.Count,
                    ChecklistCount = o.Checklists.Count
                })
                .ToList()
        };
    }
}

public record GetDrawingFileByNameQuery(string FileName) : IRequest<DrawingFileDetailDto?>;

public class GetDrawingFileByNameQueryHandler : IRequestHandler<GetDrawingFileByNameQuery, DrawingFileDetailDto?>
{
    private readonly IApplicationDbContext _context;

    public GetDrawingFileByNameQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<DrawingFileDetailDto?> Handle(GetDrawingFileByNameQuery request, CancellationToken cancellationToken)
    {
        var targetName = request.FileName.Trim();
        var safeTargetName = Path.GetFileName(targetName);

        var drawing = await _context.DrawingFiles
            .AsNoTracking()
            .Include(d => d.Objects)
                .ThenInclude(o => o.FormInspections)
            .Include(d => d.Objects)
                .ThenInclude(o => o.Checklists)
            .Where(d => d.FileName.ToLower() == safeTargetName.ToLower() ||
                        d.StoredFileName.ToLower() == safeTargetName.ToLower())
            .OrderByDescending(d => d.UploadedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (drawing == null) return null;

        return new DrawingFileDetailDto
        {
            Id = drawing.Id,
            FileName = drawing.FileName,
            FileType = drawing.FileType,
            FileUrl = drawing.FileUrl,
            FileSizeBytes = drawing.FileSizeBytes,
            UploadedBy = drawing.UploadedBy,
            UploadedAt = drawing.UploadedAt,
            Objects = drawing.Objects
                .OrderBy(o => o.PageNumber)
                .ThenBy(o => o.CreatedAt)
                .Select(o => new ObjectDto
                {
                    Id = o.Id,
                    DrawingFileId = o.DrawingFileId,
                    DrawingFileName = drawing.FileName,
                    PageNumber = o.PageNumber,
                    MarkerCoordinates = o.MarkerCoordinates,
                    Name = o.Name,
                    CreatedBy = o.CreatedBy,
                    CreatedAt = o.CreatedAt,
                    InspectionCount = o.FormInspections.Count,
                    ChecklistCount = o.Checklists.Count
                })
                .ToList()
        };
    }
}
