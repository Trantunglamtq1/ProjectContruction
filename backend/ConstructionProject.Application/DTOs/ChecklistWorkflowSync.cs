using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;

namespace ConstructionProject.Application.DTOs;

public static class ChecklistWorkflowSync
{
    // Caller loads WorkflowOperations before invoking.
    public static string GetStatus(Checklist checklist)
    {
        var pending = checklist.WorkflowOperations.FirstOrDefault(x => x.CompletedAt == null);
        if (pending != null) return pending.LastError == null ? "Pending" : "Retrying";
        if (checklist.Status == ChecklistStatus.PendingSupervisor && string.IsNullOrWhiteSpace(checklist.WorkflowInstanceId))
            return "NeedsRecovery";
        return "Synchronized";
    }
}
