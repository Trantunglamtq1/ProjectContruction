using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Drawings.Queries;

public record GetDrawingFilesQuery : IRequest<List<DrawingFileDto>>;

public class GetDrawingFilesQueryHandler : IRequestHandler<GetDrawingFilesQuery, List<DrawingFileDto>>
{
    private readonly IApplicationDbContext _context;

    public GetDrawingFilesQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<DrawingFileDto>> Handle(GetDrawingFilesQuery request, CancellationToken cancellationToken)
    {
        return await _context.DrawingFiles
            .AsNoTracking()
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
