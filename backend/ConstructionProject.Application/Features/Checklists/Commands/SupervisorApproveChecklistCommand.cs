using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Commands;

public record SupervisorApproveChecklistCommand(
    Guid Id,
    Guid? SupervisorId,
    string? SupervisorName,
    string? Comment = null
) : IRequest<ChecklistDto>;

public class SupervisorApproveChecklistCommandHandler : IRequestHandler<SupervisorApproveChecklistCommand, ChecklistDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IChecklistWorkflowService _workflowService;
    private readonly INotificationService _notificationService;

    public SupervisorApproveChecklistCommandHandler(
        IApplicationDbContext context, 
        IChecklistWorkflowService workflowService,
        INotificationService notificationService)
    {
        _context = context;
        _workflowService = workflowService;
        _notificationService = notificationService;
    }

    public async Task<ChecklistDto> Handle(SupervisorApproveChecklistCommand request, CancellationToken cancellationToken)
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
            throw new InvalidOperationException($"Chỉ có thể phê duyệt Kế hoạch Checklist đang ở trạng thái 'PendingSupervisor'. Trạng thái hiện tại: '{checklist.Status}'.");
        }

        var oldStatus = checklist.Status;
        checklist.Status = ChecklistStatus.Approved;
        checklist.ReviewedById = request.SupervisorId;
        checklist.ReviewedBy = !string.IsNullOrWhiteSpace(request.SupervisorName) ? request.SupervisorName : "Supervisor";
        checklist.ReviewedAt = DateTime.UtcNow;

        // Resume Elsa Workflow #1
        if (!string.IsNullOrWhiteSpace(checklist.WorkflowInstanceId))
        {
            await _workflowService.ResumeSupervisorDecisionAsync(
                checklist.WorkflowInstanceId,
                isApproved: true,
                checklist.ReviewedBy,
                request.Comment,
                cancellationToken);
        }

        // Ghi Audit Log (FR-10) trực tiếp qua DbSet
        _context.ChecklistAuditHistories.Add(new ChecklistAuditHistory
        {
            Id = Guid.NewGuid(),
            ChecklistId = checklist.Id,
            FromStatus = oldStatus.ToString(),
            ToStatus = checklist.Status.ToString(),
            Action = "SupervisorApprove",
            ActorId = request.SupervisorId,
            ActorName = checklist.ReviewedBy,
            ActorRole = "Reviewer",
            Comment = request.Comment ?? "Giám sát đã thẩm định và phê duyệt Kế hoạch Checklist. Khóa cứng cấu trúc và mở khóa chức năng điền phiếu nghiệm thu hiện trường.",
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(cancellationToken);

        // Bắn thông báo Realtime SignalR cho Submitter (Kỹ sư nộp checklist)
        if (checklist.CreatedById.HasValue)
        {
            await _notificationService.SendNotificationToUserAsync(checklist.CreatedById.Value.ToString(), new NotificationMessage
            {
                Title = "Kế hoạch Checklist đã được phê duyệt",
                Content = $"Giám sát {checklist.ReviewedBy} đã phê duyệt kế hoạch Checklist '{checklist.Name}'. Bạn có thể bắt đầu nghiệm thu hiện trường.",
                Type = "success",
                ReferenceId = checklist.Id.ToString(),
                ReferenceType = "Checklist",
                TargetUrl = "/submitter/checklists"
            }, cancellationToken);
        }

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
            ReviewedById = checklist.ReviewedById,
            ReviewedBy = checklist.ReviewedBy,
            ReviewedAt = checklist.ReviewedAt,
            ItemsCount = checklist.Items.Count,
            RequiredItemsCount = checklist.Items.Count(i => i.IsRequired),
            DoneItemsCount = checklist.Items.Count(i => i.Status == ChecklistItemStatus.Done),
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
            AuditHistories = auditList
        };
    }
}
