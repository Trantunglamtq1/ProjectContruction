using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;

namespace ConstructionProject.Application.DTOs;

public static class InspectionWorkflowSync
{
    // Call only when WorkflowOperations has been loaded.
    public static string GetStatus(FormInspection inspection)
    {
        var pending = inspection.WorkflowOperations.FirstOrDefault(x => x.CompletedAt == null);
        if (pending != null) return pending.LastError == null ? "Pending" : "Retrying";
        if (inspection.Status is InspectionStatus.Submitted or InspectionStatus.UnderReview or InspectionStatus.Reviewed
            && string.IsNullOrWhiteSpace(inspection.WorkflowInstanceId)) return "NeedsRecovery";
        return "Synchronized";
    }
}
