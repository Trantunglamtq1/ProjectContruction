using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Application.Features.Inspections.Commands;

internal static class InspectionWorkflowQueue
{
    public static async Task EnsureReadyAsync(IApplicationDbContext db, Guid inspectionId, CancellationToken cancellationToken)
    {
        if (await db.InspectionWorkflowOperations.AnyAsync(x => x.InspectionId == inspectionId && x.CompletedAt == null, cancellationToken))
            throw new InvalidOperationException("Hồ sơ đang đồng bộ quy trình duyệt. Vui lòng tải lại sau.");
    }

    public static void EnqueueStart(IApplicationDbContext db, FormInspection inspection, string? actorName)
    {
        // Candidate id remains internal until Elsa confirms the instance exists.
        var previousInstanceId = inspection.WorkflowInstanceId;
        inspection.WorkflowInstanceId = null;
        db.InspectionWorkflowOperations.Add(new InspectionWorkflowOperation
        {
            InspectionId = inspection.Id,
            InstanceId = Guid.NewGuid().ToString("N"),
            PreviousInstanceId = previousInstanceId,
            Action = "Start",
            ActorName = actorName
        });
    }

    public static void EnqueueDecision(IApplicationDbContext db, FormInspection inspection, string action, string? actorName, string? comment)
    {
        if (string.IsNullOrWhiteSpace(inspection.WorkflowInstanceId))
            throw new InvalidOperationException("Không tìm thấy quy trình duyệt. Vui lòng liên hệ quản trị viên để khôi phục.");
        db.InspectionWorkflowOperations.Add(new InspectionWorkflowOperation
        {
            InspectionId = inspection.Id,
            InstanceId = inspection.WorkflowInstanceId,
            Action = action,
            ActorName = actorName,
            Comment = comment
        });
    }
}
