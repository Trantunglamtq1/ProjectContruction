using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Commands;

public record SubmitChecklistForApprovalCommand(
    Guid Id,
    Guid? SubmitterId,
    string? SubmitterName
) : IRequest<ChecklistDto>;

public class SubmitChecklistForApprovalCommandHandler : IRequestHandler<SubmitChecklistForApprovalCommand, ChecklistDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IChecklistWorkflowService _workflowService;
    private readonly INotificationService _notificationService;

    public SubmitChecklistForApprovalCommandHandler(
        IApplicationDbContext context, 
        IChecklistWorkflowService workflowService,
        INotificationService notificationService)
    {
        _context = context;
        _workflowService = workflowService;
        _notificationService = notificationService;
    }

    public async Task<ChecklistDto> Handle(SubmitChecklistForApprovalCommand request, CancellationToken cancellationToken)
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

        if (checklist.Status != ChecklistStatus.Draft && checklist.Status != ChecklistStatus.Rejected)
        {
            throw new InvalidOperationException($"Chỉ có thể trình duyệt Kế hoạch Checklist đang ở trạng thái 'Draft' hoặc 'Rejected'. Trạng thái hiện tại: '{checklist.Status}'.");
        }

        if (checklist.Items.Count == 0)
        {
            throw new InvalidOperationException("Kế hoạch Checklist phải có ít nhất 1 tiêu chí kiểm tra (ChecklistItem) trước khi trình duyệt.");
        }

        var oldStatus = checklist.Status;
        checklist.Status = ChecklistStatus.PendingSupervisor;
        checklist.RejectReason = null; // Clear previous rejection reason if any

        var submitter = !string.IsNullOrWhiteSpace(request.SubmitterName) ? request.SubmitterName : "Submitter";

        // Kích hoạt Elsa Workflow #1
        var workflowInstanceId = await _workflowService.StartChecklistWorkflowAsync(
            checklist.Id,
            checklist.Name,
            submitter,
            cancellationToken);

        checklist.WorkflowInstanceId = workflowInstanceId;

        // Ghi Audit Log (FR-10) trực tiếp qua DbSet để bảo đảm EntityState.Added
        var auditHistory = new ChecklistAuditHistory
        {
            Id = Guid.NewGuid(),
            ChecklistId = checklist.Id,
            FromStatus = oldStatus.ToString(),
            ToStatus = checklist.Status.ToString(),
            Action = "SubmitForApproval",
            ActorId = request.SubmitterId,
            ActorName = submitter,
            ActorRole = "Submitter",
            Comment = $"Kỹ sư trình duyệt Kế hoạch Checklist sang Giám sát thẩm duyệt (Elsa Instance: {workflowInstanceId}).",
            CreatedAt = DateTime.UtcNow
        };
        _context.ChecklistAuditHistories.Add(auditHistory);

        await _context.SaveChangesAsync(cancellationToken);

        // Bắn thông báo Realtime SignalR cho Reviewers (Tư vấn giám sát)
        await _notificationService.SendNotificationToRoleAsync("Reviewer", new NotificationMessage
        {
            Title = "Kế hoạch Checklist mới chờ thẩm định",
            Content = $"Kỹ sư {submitter} đã trình duyệt kế hoạch Checklist '{checklist.Name}'. Vui lòng thẩm định cấu trúc và biểu mẫu.",
            Type = "info",
            ReferenceId = checklist.Id.ToString(),
            ReferenceType = "Checklist",
            TargetUrl = "/reviewer/checklists"
        }, cancellationToken);

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
