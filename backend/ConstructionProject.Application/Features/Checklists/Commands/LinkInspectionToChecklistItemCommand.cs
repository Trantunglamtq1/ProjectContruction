using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Commands;

public record LinkInspectionToChecklistItemCommand(
    Guid ChecklistId,
    Guid ItemId,
    Guid InspectionId,
    Guid? ActorId,
    string? ActorName,
    string? ActorRole
) : IRequest<ChecklistItemDto>;

public class LinkInspectionToChecklistItemCommandHandler : IRequestHandler<LinkInspectionToChecklistItemCommand, ChecklistItemDto>
{
    private readonly IApplicationDbContext _context;

    public LinkInspectionToChecklistItemCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ChecklistItemDto> Handle(LinkInspectionToChecklistItemCommand request, CancellationToken cancellationToken)
    {
        var checklist = await _context.Checklists
            .Include(c => c.Items)
            .Include(c => c.AuditHistories)
            .FirstOrDefaultAsync(c => c.Id == request.ChecklistId, cancellationToken);

        if (checklist == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy Checklist với Id = {request.ChecklistId}.");
        }

        // RÀNG BUỘC KHÓA NGHIỆP VỤ (NFR-1):
        // Khi Checklist chưa được Giám sát duyệt -> Khóa hoàn toàn chức năng lập/gán phiếu nghiệm thu
        if (checklist.Status != ChecklistStatus.Approved && checklist.Status != ChecklistStatus.InProgress)
        {
            throw new InvalidOperationException($"Không thể gán phiếu nghiệm thu vào tiêu chí khi Kế hoạch Checklist chưa được Giám sát phê duyệt (Trạng thái hiện tại: '{checklist.Status}').");
        }

        var item = checklist.Items.FirstOrDefault(i => i.Id == request.ItemId);
        if (item == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy ChecklistItem với Id = {request.ItemId} trong Checklist.");
        }

        var inspection = await _context.FormInspections
            .FirstOrDefaultAsync(f => f.Id == request.InspectionId, cancellationToken);

        if (inspection == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy Form Inspection với Id = {request.InspectionId}.");
        }

        item.LinkedInspectionId = inspection.Id;

        // Nếu FormInspection đã được Approve từ trước -> Đổi trạng thái Item sang Done ngay
        if (inspection.Status == InspectionStatus.Approved)
        {
            item.Status = ChecklistItemStatus.Done;
        }

        // Cập nhật trạng thái Checklist
        if (checklist.Status == ChecklistStatus.Approved)
        {
            checklist.Status = ChecklistStatus.InProgress;
        }

        // Kiểm tra xem đã hoàn thành toàn bộ Checklist chưa
        var allRequiredDone = checklist.Items
            .Where(x => x.IsRequired)
            .All(x => x.Status == ChecklistItemStatus.Done);

        if (allRequiredDone && checklist.Items.Any(x => x.IsRequired))
        {
            checklist.Status = ChecklistStatus.Completed;
        }

        // Ghi Audit Trail qua DbSet
        _context.ChecklistAuditHistories.Add(new ChecklistAuditHistory
        {
            Id = Guid.NewGuid(),
            ChecklistId = checklist.Id,
            FromStatus = checklist.Status.ToString(),
            ToStatus = checklist.Status.ToString(),
            Action = "LinkInspection",
            ActorId = request.ActorId,
            ActorName = request.ActorName ?? "User",
            ActorRole = request.ActorRole ?? "Submitter",
            Comment = $"Liên kết phiếu nghiệm thu {inspection.Id} vào tiêu chí '{item.Name}'. Trạng thái tiêu chí: {item.Status}.",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);

        return new ChecklistItemDto
        {
            Id = item.Id,
            ChecklistId = item.ChecklistId,
            Name = item.Name,
            OrderIndex = item.OrderIndex,
            IsRequired = item.IsRequired,
            FormSchemaJson = item.FormSchemaJson,
            LinkedInspectionId = item.LinkedInspectionId,
            LinkedInspectionStatus = inspection.Status.ToString(),
            Status = item.Status.ToString()
        };
    }
}
