using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;

namespace ConstructionProject.Application.Common.Helpers;

public static class ObjectStatusCalculator
{
    public static string ComputeStatus(ConstructionObject o)
    {
        if (o.FormInspections != null && o.FormInspections.Any(fi => fi.Status == InspectionStatus.Approved))
        {
            return "PASS";
        }
        if (o.FormInspections != null && o.FormInspections.Any(fi => fi.Status == InspectionStatus.Rejected))
        {
            return "FAIL";
        }
        if ((o.FormInspections != null && o.FormInspections.Any(fi => 
                fi.Status == InspectionStatus.Submitted || 
                fi.Status == InspectionStatus.UnderReview || 
                fi.Status == InspectionStatus.Reviewed)) ||
            (o.Checklists != null && o.Checklists.Any(c => c.Status == ChecklistStatus.InProgress)))
        {
            return "IN_PROGRESS";
        }
        return "PENDING";
    }
}
