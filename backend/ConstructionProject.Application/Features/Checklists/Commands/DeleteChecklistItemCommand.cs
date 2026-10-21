using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Commands;

public record DeleteChecklistItemCommand(
    Guid Id,
    Guid? ActorId,
    string? ActorName,
    string? ActorRole
) : IRequest<bool>;

public class DeleteChecklistItemCommandHandler : IRequestHandler<DeleteChecklistItemCommand, bool>
{
    private readonly IApplicationDbContext _context;

    public DeleteChecklistItemCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteChecklistItemCommand request, CancellationToken cancellationToken)
    {
        var item = await _context.ChecklistItems
            .Include(i => i.Checklist)
                .ThenInclude(c => c!.AuditHistories)
            .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy ChecklistItem với Id = {request.Id}.");
        }

        // Ràng buộc Khóa (NFR-1 Locking): Không được xóa nếu đã có phiếu nghiệm thu phát sinh
        if (item.LinkedInspectionId.HasValue)
        {
            throw new InvalidOperationException($"Không thể xóa tiêu chí '{item.Name}' vì đã có phiếu nghiệm thu phát sinh ({item.LinkedInspectionId.Value}).");
        }

        var checklist = item.Checklist;
        if (checklist != null)
        {
            if (checklist.Status == ChecklistStatus.Approved || checklist.Status == ChecklistStatus.InProgress || checklist.Status == ChecklistStatus.Completed)
            {
                throw new InvalidOperationException($"Cấu trúc Checklist đã được phê duyệt và khóa cứng ('{checklist.Status}'). Không thể xóa tiêu chí.");
            }
        }

        // Thực hiện Xóa mềm (Soft Delete - NFR-1)
        item.IsDeleted = true;

        if (checklist != null)
        {
            _context.ChecklistAuditHistories.Add(new Domain.Entities.ChecklistAuditHistory
            {
                Id = Guid.NewGuid(),
                ChecklistId = checklist.Id,
                FromStatus = checklist.Status.ToString(),
                ToStatus = checklist.Status.ToString(),
                Action = "DeleteItem",
                ActorId = request.ActorId,
                ActorName = request.ActorName ?? "User",
                ActorRole = request.ActorRole ?? "Submitter",
                Comment = $"Xóa tiêu chí kiểm tra '{item.Name}'.",
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
