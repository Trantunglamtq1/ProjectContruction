using System.Text.Json;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Commands;

public record SupervisorModifyChecklistCommand(
    Guid Id,
    string? Name,
    string? Description,
    List<SupervisorModifyItemDto>? Items,
    Guid? SupervisorId,
    string? SupervisorName,
    string? Comment = null
) : IRequest<ChecklistDto>;

public class SupervisorModifyChecklistCommandHandler : IRequestHandler<SupervisorModifyChecklistCommand, ChecklistDto>
{
    private readonly IApplicationDbContext _context;

    public SupervisorModifyChecklistCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ChecklistDto> Handle(SupervisorModifyChecklistCommand request, CancellationToken cancellationToken)
    {
        var checklist = await _context.Checklists
            .Include(c => c.Object)
                .ThenInclude(o => o!.DrawingFile)
            .Include(c => c.Items)
            .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);

        if (checklist == null)
        {
            throw new KeyNotFoundException($"Không tìm thấy Checklist với Id = {request.Id}.");
        }

        if (checklist.Status != ChecklistStatus.PendingSupervisor)
        {
            throw new InvalidOperationException($"Chỉ có thể can thiệp chỉnh sửa kế hoạch khi Checklist đang ở trạng thái chờ thẩm duyệt 'PendingSupervisor'. Trạng thái hiện tại: '{checklist.Status}'.");
        }

        var modifications = new List<string>();

        // Cập nhật thông tin Header nếu có thay đổi
        if (!string.IsNullOrWhiteSpace(request.Name) && request.Name.Trim() != checklist.Name)
        {
            modifications.Add($"Đổi tên checklist từ '{checklist.Name}' -> '{request.Name.Trim()}'");
            checklist.Name = request.Name.Trim();
        }

        if (request.Description != null && request.Description.Trim() != checklist.Description)
        {
            modifications.Add("Cập nhật mô tả checklist");
            checklist.Description = request.Description.Trim();
        }

        // Can thiệp danh sách Items
        if (request.Items != null && request.Items.Count > 0)
        {
            foreach (var itemDto in request.Items)
            {
                if (itemDto.Id.HasValue && itemDto.Id.Value != Guid.Empty)
                {
                    var existingItem = checklist.Items.FirstOrDefault(i => i.Id == itemDto.Id.Value);
                    if (existingItem != null)
                    {
                        if (itemDto.IsDeleted)
                        {
                            if (existingItem.LinkedInspectionId.HasValue)
                            {
                                throw new InvalidOperationException($"Không thể xóa tiêu chí '{existingItem.Name}' vì đã có phiếu nghiệm thu phát sinh.");
                            }
                            existingItem.IsDeleted = true;
                            modifications.Add($"Giám sát xóa tiêu chí: '{existingItem.Name}'");
                        }
                        else
                        {
                            if (existingItem.Name != itemDto.Name.Trim())
                            {
                                modifications.Add($"Sửa tên tiêu chí từ '{existingItem.Name}' -> '{itemDto.Name.Trim()}'");
                                existingItem.Name = itemDto.Name.Trim();
                            }
                            if (existingItem.IsRequired != itemDto.IsRequired)
                            {
                                modifications.Add($"Đổi tính bắt buộc tiêu chí '{existingItem.Name}': {itemDto.IsRequired}");
                                existingItem.IsRequired = itemDto.IsRequired;
                            }
                            if (existingItem.OrderIndex != itemDto.OrderIndex)
                            {
                                existingItem.OrderIndex = itemDto.OrderIndex;
                            }
                            if (!string.IsNullOrWhiteSpace(itemDto.FormSchemaJson) && existingItem.FormSchemaJson != itemDto.FormSchemaJson)
                            {
                                modifications.Add($"Giám sát điều chỉnh Form.io JSON Schema cho tiêu chí '{existingItem.Name}'");
                                existingItem.FormSchemaJson = itemDto.FormSchemaJson;
                            }
                        }
                    }
                }
                else
                {
                    // Thêm mới tiêu chí
                    if (!string.IsNullOrWhiteSpace(itemDto.Name) && !itemDto.IsDeleted)
                    {
                        var newItem = new ChecklistItem
                        {
                            Id = Guid.NewGuid(),
                            ChecklistId = checklist.Id,
                            Name = itemDto.Name.Trim(),
                            OrderIndex = itemDto.OrderIndex > 0 ? itemDto.OrderIndex : checklist.Items.Count + 1,
                            IsRequired = itemDto.IsRequired,
                            FormSchemaJson = !string.IsNullOrWhiteSpace(itemDto.FormSchemaJson) ? itemDto.FormSchemaJson : "{}",
                            Status = ChecklistItemStatus.Pending,
                            IsDeleted = false
                        };
                        _context.ChecklistItems.Add(newItem);
                        modifications.Add($"Giám sát bổ sung tiêu chí mới: '{newItem.Name}'");
                    }
                }
            }
        }

        var supervisorName = !string.IsNullOrWhiteSpace(request.SupervisorName) ? request.SupervisorName : "Supervisor";

        // Ghi Audit Trail chi tiết qua DbSet (FR-10)
        _context.ChecklistAuditHistories.Add(new ChecklistAuditHistory
        {
            Id = Guid.NewGuid(),
            ChecklistId = checklist.Id,
            FromStatus = checklist.Status.ToString(),
            ToStatus = checklist.Status.ToString(),
            Action = "SupervisorModify",
            ActorId = request.SupervisorId,
            ActorName = supervisorName,
            ActorRole = "Reviewer",
            Comment = request.Comment ?? $"Giám sát can thiệp trực tiếp cấu trúc Checklist ({modifications.Count} thay đổi).",
            DetailsJson = JsonSerializer.Serialize(modifications),
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);

        var activeItems = checklist.Items.Where(i => !i.IsDeleted).ToList();

        var auditList = await _context.ChecklistAuditHistories
            .Where(a => a.ChecklistId == checklist.Id)
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new ChecklistAuditHistoryDto
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
                DetailsJson = a.DetailsJson,
                CreatedAt = a.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return new ChecklistDto
        {
            Id = checklist.Id,
            ObjectId = checklist.ObjectId,
            ObjectName = checklist.Object?.Name ?? string.Empty,
            DrawingFileId = checklist.Object?.DrawingFileId ?? Guid.Empty,
            DrawingFileName = checklist.Object?.DrawingFile?.FileName ?? string.Empty,
            DrawingPageNumber = checklist.Object?.PageNumber ?? 1,
            Name = checklist.Name,
            Description = checklist.Description,
            Status = checklist.Status.ToString(),
            WorkflowInstanceId = checklist.WorkflowInstanceId,
            CreatedById = checklist.CreatedById,
            CreatedBy = checklist.CreatedBy,
            CreatedAt = checklist.CreatedAt,
            ItemsCount = activeItems.Count,
            RequiredItemsCount = activeItems.Count(i => i.IsRequired),
            DoneItemsCount = activeItems.Count(i => i.Status == ChecklistItemStatus.Done),
            Items = activeItems.OrderBy(i => i.OrderIndex).Select(i => new ChecklistItemDto
            {
                Id = i.Id,
                ChecklistId = i.ChecklistId,
                Name = i.Name,
                OrderIndex = i.OrderIndex,
                IsRequired = i.IsRequired,
                FormSchemaJson = i.FormSchemaJson,
                Status = i.Status.ToString()
            }).ToList(),
            AuditHistories = auditList
        };
    }
}
