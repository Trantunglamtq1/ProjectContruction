using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Commands;

public record AddChecklistItemCommand(
    Guid ChecklistId,
    string Name,
    int OrderIndex,
    bool IsRequired,
    string? FormSchemaJson,
    Guid? ActorId,
    string? ActorName,
    string? ActorRole
) : IRequest<ChecklistItemDto>;

public class AddChecklistItemCommandValidator : AbstractValidator<AddChecklistItemCommand>
{
    public AddChecklistItemCommandValidator()
    {
        RuleFor(x => x.ChecklistId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(255);
    }
}

public class AddChecklistItemCommandHandler : IRequestHandler<AddChecklistItemCommand, ChecklistItemDto>
{
    private readonly IApplicationDbContext _context;

    public AddChecklistItemCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ChecklistItemDto> Handle(AddChecklistItemCommand request, CancellationToken cancellationToken)
    {
        var checklist = await _context.Checklists
            .Include(c => c.Items)
            .Include(c => c.AuditHistories)
            .FirstOrDefaultAsync(c => c.Id == request.ChecklistId, cancellationToken);

        if (checklist == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy Checklist với Id = {request.ChecklistId}.");
        }

        // Kiểm tra State Locking (NFR-1)
        if (checklist.Status == ChecklistStatus.Approved || checklist.Status == ChecklistStatus.InProgress || checklist.Status == ChecklistStatus.Completed)
        {
            throw new InvalidOperationException($"Cấu trúc Checklist đã được phê duyệt và khóa cứng ('{checklist.Status}'). Không thể thêm tiêu chí mới.");
        }

        var orderIndex = request.OrderIndex > 0 ? request.OrderIndex : checklist.Items.Count + 1;
        var item = new ChecklistItem
        {
            Id = Guid.NewGuid(),
            ChecklistId = checklist.Id,
            Name = request.Name.Trim(),
            OrderIndex = orderIndex,
            IsRequired = request.IsRequired,
            FormSchemaJson = !string.IsNullOrWhiteSpace(request.FormSchemaJson) ? request.FormSchemaJson : "{}",
            Status = ChecklistItemStatus.Pending,
            IsDeleted = false
        };

        _context.ChecklistItems.Add(item);

        // Ghi Audit Trail qua DbSet
        _context.ChecklistAuditHistories.Add(new ChecklistAuditHistory
        {
            Id = Guid.NewGuid(),
            ChecklistId = checklist.Id,
            FromStatus = checklist.Status.ToString(),
            ToStatus = checklist.Status.ToString(),
            Action = "AddItem",
            ActorId = request.ActorId,
            ActorName = request.ActorName ?? "User",
            ActorRole = request.ActorRole ?? "Submitter",
            Comment = $"Thêm tiêu chí kiểm tra '{item.Name}' (Bắt buộc: {item.IsRequired}).",
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
            Status = item.Status.ToString()
        };
    }
}
