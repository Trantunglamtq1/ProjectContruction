using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Checklists.Commands;

internal static class ChecklistWorkflowQueue
{
    public static async Task EnsureReadyAsync(IApplicationDbContext db, Guid checklistId, CancellationToken cancellationToken)
    {
        if (await db.ChecklistWorkflowOperations.AnyAsync(x => x.ChecklistId == checklistId && x.CompletedAt == null, cancellationToken))
            throw new InvalidOperationException("Hồ sơ đang đồng bộ quy trình duyệt. Vui lòng tải lại sau.");
        if (await db.Checklists.AnyAsync(x => x.Id == checklistId && x.Status == ChecklistStatus.PendingSupervisor && (x.WorkflowInstanceId == null || x.WorkflowInstanceId == ""), cancellationToken))
            throw new InvalidOperationException("Không tìm thấy quy trình checklist; vui lòng liên hệ quản trị viên để khôi phục.");
    }

    public static void EnqueueStart(IApplicationDbContext db, Checklist checklist, string? actorName)
    {
        // Candidate id remains internal until Elsa confirms the instance exists.
        var previousInstanceId = checklist.WorkflowInstanceId;
        checklist.WorkflowInstanceId = null;
        db.ChecklistWorkflowOperations.Add(new ChecklistWorkflowOperation
        {
            ChecklistId = checklist.Id,
            InstanceId = Guid.NewGuid().ToString("N"),
            PreviousInstanceId = previousInstanceId,
            Action = "Start",
            ActorName = actorName
        });
    }

    public static void EnqueueDecision(IApplicationDbContext db, Checklist checklist, string action, string? actorName, string? comment)
    {
        if (string.IsNullOrWhiteSpace(checklist.WorkflowInstanceId))
            throw new InvalidOperationException("Không tìm thấy quy trình duyệt. Vui lòng liên hệ quản trị viên để khôi phục.");
        db.ChecklistWorkflowOperations.Add(new ChecklistWorkflowOperation
        {
            ChecklistId = checklist.Id,
            InstanceId = checklist.WorkflowInstanceId,
            Action = action,
            ActorName = actorName,
            Comment = comment
        });
    }
}
