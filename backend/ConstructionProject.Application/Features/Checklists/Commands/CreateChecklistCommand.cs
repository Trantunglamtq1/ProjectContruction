using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Commands;

public record CreateChecklistCommand(
    Guid ObjectId,
    string Name,
    string? Description,
    List<CreateChecklistItemRequest>? InitialItems,
    Guid? CreatedById,
    string CreatedBy
) : IRequest<ChecklistDto>;

public class CreateChecklistCommandValidator : AbstractValidator<CreateChecklistCommand>
{
    public CreateChecklistCommandValidator()
    {
        RuleFor(x => x.ObjectId)
            .NotEmpty().WithMessage("ObjectId là bắt buộc. Checklist phải luôn gắn với một đối tượng cấu kiện cụ thể.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tên Checklist không được để trống.")
            .MaximumLength(255).WithMessage("Tên Checklist tối đa 255 ký tự.");

        RuleFor(x => x.Description)
            .MaximumLength(1000).WithMessage("Mô tả Checklist tối đa 1000 ký tự.");
    }
}

public class CreateChecklistCommandHandler : IRequestHandler<CreateChecklistCommand, ChecklistDto>
{
    private readonly IApplicationDbContext _context;

    public CreateChecklistCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ChecklistDto> Handle(CreateChecklistCommand request, CancellationToken cancellationToken)
    {
        var obj = await _context.Objects
            .Include(o => o.DrawingFile)
            .FirstOrDefaultAsync(o => o.Id == request.ObjectId, cancellationToken);

        if (obj == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy cấu kiện với Id = {request.ObjectId}.");
        }

        var checklist = new Checklist
        {
            Id = Guid.NewGuid(),
            ObjectId = request.ObjectId,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            Status = ChecklistStatus.Draft,
            CreatedById = request.CreatedById,
            CreatedBy = string.IsNullOrWhiteSpace(request.CreatedBy) ? "Submitter" : request.CreatedBy.Trim(),
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };

        if (request.InitialItems != null && request.InitialItems.Count > 0)
        {
            int index = 1;
            foreach (var itemReq in request.InitialItems)
            {
                if (string.IsNullOrWhiteSpace(itemReq.Name)) continue;
                checklist.Items.Add(new ChecklistItem
                {
                    Id = Guid.NewGuid(),
                    ChecklistId = checklist.Id,
                    Name = itemReq.Name.Trim(),
                    OrderIndex = itemReq.OrderIndex > 0 ? itemReq.OrderIndex : index++,
                    IsRequired = itemReq.IsRequired,
                    FormSchemaJson = !string.IsNullOrWhiteSpace(itemReq.FormSchemaJson) ? itemReq.FormSchemaJson : "{}",
                    Status = ChecklistItemStatus.Pending,
                    IsDeleted = false
                });
            }
        }

        // Ghi Audit Trail (FR-10)
        checklist.AuditHistories.Add(new ChecklistAuditHistory
        {
            Id = Guid.NewGuid(),
            ChecklistId = checklist.Id,
            FromStatus = "None",
            ToStatus = ChecklistStatus.Draft.ToString(),
            Action = "CreateDraft",
            ActorId = request.CreatedById,
            ActorName = checklist.CreatedBy,
            ActorRole = "Submitter",
            Comment = $"Kỹ sư khởi tạo Kế hoạch Checklist '{checklist.Name}' với {checklist.Items.Count} tiêu chí ban đầu.",
            CreatedAt = DateTime.UtcNow
        });

        _context.Checklists.Add(checklist);
        await _context.SaveChangesAsync(cancellationToken);

        return new ChecklistDto
        {
            Id = checklist.Id,
            ObjectId = checklist.ObjectId,
            ObjectName = obj.Name,
            DrawingFileId = obj.DrawingFileId,
            DrawingFileName = obj.DrawingFile?.FileName ?? string.Empty,
            DrawingPageNumber = obj.PageNumber,
            Name = checklist.Name,
            Description = checklist.Description,
            Status = checklist.Status.ToString(),
            CreatedById = checklist.CreatedById,
            CreatedBy = checklist.CreatedBy,
            CreatedAt = checklist.CreatedAt,
            ItemsCount = checklist.Items.Count,
            RequiredItemsCount = checklist.Items.Count(i => i.IsRequired),
            DoneItemsCount = 0,
            Items = checklist.Items.OrderBy(i => i.OrderIndex).Select(i => new ChecklistItemDto
            {
                Id = i.Id,
                ChecklistId = i.ChecklistId,
                Name = i.Name,
                OrderIndex = i.OrderIndex,
                IsRequired = i.IsRequired,
                FormSchemaJson = i.FormSchemaJson,
                Status = i.Status.ToString()
            }).ToList(),
            AuditHistories = checklist.AuditHistories.Select(a => new ChecklistAuditHistoryDto
            {
                Id = a.Id,
                ChecklistId = a.ChecklistId,
                FromStatus = a.FromStatus,
                ToStatus = a.ToStatus,
                Action = a.Action,
                ActorId = a.ActorId,
                ActorName = a.ActorName,
                ActorRole = a.ActorRole,
                Comment = a.Comment,
                CreatedAt = a.CreatedAt
            }).ToList()
        };
    }
}
