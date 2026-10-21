using ConstructionProject.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Commands;

public record DeleteChecklistCommand(
    Guid Id,
    Guid? ActorId,
    string? ActorName,
    string? ActorRole
) : IRequest<bool>;

public class DeleteChecklistCommandHandler : IRequestHandler<DeleteChecklistCommand, bool>
{
    private readonly IApplicationDbContext _context;

    public DeleteChecklistCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> Handle(DeleteChecklistCommand request, CancellationToken cancellationToken)
    {
        var checklist = await _context.Checklists
            .Include(c => c.Items)
            .Include(c => c.AuditHistories)
            .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);

        if (checklist == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy Checklist với Id = {request.Id}.");
        }

        // Ràng buộc Khóa: Nếu bất kỳ tiêu chí nào đã phát sinh phiếu nghiệm thu -> Cấm xóa
        var hasInspection = checklist.Items.Any(i => i.LinkedInspectionId.HasValue);
        if (hasInspection)
        {
            throw new InvalidOperationException("Không thể xóa Checklist này vì đã có phiếu nghiệm thu phát sinh trên các tiêu chí.");
        }

        // Thực hiện Xóa mềm (Soft Delete - NFR-1)
        checklist.IsDeleted = true;
        foreach (var item in checklist.Items)
        {
            item.IsDeleted = true;
        }

        _context.ChecklistAuditHistories.Add(new Domain.Entities.ChecklistAuditHistory
        {
            Id = Guid.NewGuid(),
            ChecklistId = checklist.Id,
            FromStatus = checklist.Status.ToString(),
            ToStatus = "Deleted",
            Action = "DeleteChecklist",
            ActorId = request.ActorId,
            ActorName = request.ActorName ?? "User",
            ActorRole = request.ActorRole ?? "Submitter",
            Comment = $"Xóa mềm Kế hoạch Checklist '{checklist.Name}' cùng toàn bộ {checklist.Items.Count} tiêu chí.",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);
        return true;
    }
}
