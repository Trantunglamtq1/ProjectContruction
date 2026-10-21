using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Commands;

public record UpdateChecklistItemCommand(
    Guid Id,
    string Name,
    int OrderIndex,
    bool IsRequired,
    string? FormSchemaJson,
    Guid? ActorId,
    string? ActorName,
    string? ActorRole
) : IRequest<ChecklistItemDto>;

public class UpdateChecklistItemCommandValidator : AbstractValidator<UpdateChecklistItemCommand>
{
    public UpdateChecklistItemCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(255);
    }
}

public class UpdateChecklistItemCommandHandler : IRequestHandler<UpdateChecklistItemCommand, ChecklistItemDto>
{
    private readonly IApplicationDbContext _context;

    public UpdateChecklistItemCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ChecklistItemDto> Handle(UpdateChecklistItemCommand request, CancellationToken cancellationToken)
    {
        var item = await _context.ChecklistItems
            .Include(i => i.Checklist)
                .ThenInclude(c => c!.AuditHistories)
            .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy ChecklistItem với Id = {request.Id}.");
        }

        var checklist = item.Checklist;
        if (checklist != null)
        {
            // Kiểm tra State Locking (NFR-1)
            if (checklist.Status == ChecklistStatus.Approved || checklist.Status == ChecklistStatus.InProgress || checklist.Status == ChecklistStatus.Completed)
            {
                throw new InvalidOperationException($"Cấu trúc Checklist đã được phê duyệt và khóa cứng ('{checklist.Status}'). Không thể chỉnh sửa tiêu chí.");
            }
        }

        item.Name = request.Name.Trim();
        item.OrderIndex = request.OrderIndex;
        item.IsRequired = request.IsRequired;
        if (!string.IsNullOrWhiteSpace(request.FormSchemaJson))
        {
            item.FormSchemaJson = request.FormSchemaJson;
        }

        if (checklist != null)
        {
            _context.ChecklistAuditHistories.Add(new Domain.Entities.ChecklistAuditHistory
            {
                Id = Guid.NewGuid(),
                ChecklistId = checklist.Id,
                FromStatus = checklist.Status.ToString(),
                ToStatus = checklist.Status.ToString(),
                Action = "UpdateItem",
                ActorId = request.ActorId,
                ActorName = request.ActorName ?? "User",
                ActorRole = request.ActorRole ?? "Submitter",
                Comment = $"Cập nhật tiêu chí '{item.Name}' và điều chỉnh Form.io JSON Schema.",
                CreatedAt = DateTime.UtcNow
            });
        }

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
