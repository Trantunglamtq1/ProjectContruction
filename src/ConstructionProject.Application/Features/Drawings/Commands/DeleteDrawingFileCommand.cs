using ConstructionProject.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Drawings.Commands;

public record DeleteDrawingFileCommand(Guid Id) : IRequest<bool>;

public class DeleteDrawingFileCommandHandler : IRequestHandler<DeleteDrawingFileCommand, bool>
{
    private readonly IApplicationDbContext _context;
    private readonly IFileStorageService _fileStorage;

    public DeleteDrawingFileCommandHandler(
        IApplicationDbContext context,
        IFileStorageService fileStorage)
    {
        _context = context;
        _fileStorage = fileStorage;
    }

    public async Task<bool> Handle(DeleteDrawingFileCommand request, CancellationToken cancellationToken)
    {
        var drawing = await _context.DrawingFiles
            .Include(d => d.Objects)
            .FirstOrDefaultAsync(d => d.Id == request.Id, cancellationToken);

        if (drawing == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy bản vẽ với Id = {request.Id}.");
        }

        // Kiểm tra xem các cấu kiện trong bản vẽ này có hồ sơ nghiệm thu nào đang liên kết không
        var hasInspections = await _context.FormInspections
            .AnyAsync(i => i.Object != null && i.Object.DrawingFileId == request.Id, cancellationToken);

        if (hasInspections)
        {
            throw new InvalidOperationException("Không thể xóa bản vẽ này vì đã có hồ sơ nghiệm thu (Inspection) liên kết với cấu kiện trong bản vẽ.");
        }

        // Xóa các Objects thuộc bản vẽ nếu có
        if (drawing.Objects.Any())
        {
            _context.Objects.RemoveRange(drawing.Objects);
        }

        // Xóa bản ghi DrawingFile
        _context.DrawingFiles.Remove(drawing);
        await _context.SaveChangesAsync(cancellationToken);

        // Xóa file vật lý trên ổ cứng
        if (!string.IsNullOrEmpty(drawing.StoredFileName))
        {
            await _fileStorage.DeleteFileAsync(drawing.StoredFileName, cancellationToken);
        }

        return true;
    }
}
