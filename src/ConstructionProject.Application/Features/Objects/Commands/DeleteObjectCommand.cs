using ConstructionProject.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Objects.Commands;

public record DeleteObjectCommand(Guid Id) : IRequest<bool>;

public class DeleteObjectCommandHandler : IRequestHandler<DeleteObjectCommand, bool>
{
    private readonly IApplicationDbContext _context;

    public DeleteObjectCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteObjectCommand request, CancellationToken cancellationToken)
    {
        var entity = await _context.Objects
            .Include(o => o.FormInspections)
            .Include(o => o.Checklists)
            .FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);

        if (entity == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy cấu kiện với Id = {request.Id}.");
        }

        if (entity.FormInspections.Any() || entity.Checklists.Any())
        {
            throw new InvalidOperationException("Không thể xóa cấu kiện đã có đợt nghiệm thu hoặc biên bản kiểm tra liên kết.");
        }

        _context.Objects.Remove(entity);
        await _context.SaveChangesAsync(cancellationToken);

        return true;
    }
}
