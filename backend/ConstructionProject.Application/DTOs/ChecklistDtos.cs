namespace ConstructionProject.Application.DTOs;

public class ChecklistDto
{
    public Guid Id { get; set; }
    public Guid ObjectId { get; set; }
    public string ObjectName { get; set; } = string.Empty;
    public string ObjectCode { get; set; } = string.Empty;
    public Guid DrawingFileId { get; set; }
    public string DrawingFileName { get; set; } = string.Empty;
    public int DrawingPageNumber { get; set; } = 1;

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = "Draft"; // Draft / PendingSupervisor / Approved / Rejected / InProgress / Completed

    public string? WorkflowInstanceId { get; set; }
    public string? RejectReason { get; set; }

    public Guid? CreatedById { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public Guid? ReviewedById { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }

    // Chỉ mở khóa tạo phiếu nghiệm thu hiện trường khi kế hoạch đã được Giám sát Approved
    public bool CanFillInspection => Status == "Approved" || Status == "InProgress";

    public int ItemsCount { get; set; }
    public int RequiredItemsCount { get; set; }
    public int DoneItemsCount { get; set; }
    public int ItemsCompletedCount => DoneItemsCount;
    public double ProgressPercentage => ItemsCount > 0 ? Math.Round((double)DoneItemsCount / ItemsCount * 100, 1) : 0;

    public List<ChecklistItemDto> Items { get; set; } = new();
    public List<ChecklistAuditHistoryDto> AuditHistories { get; set; } = new();
}

public class ChecklistItemDto
{
    public Guid Id { get; set; }
    public Guid ChecklistId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public bool IsRequired { get; set; } = true;
    public string FormSchemaJson { get; set; } = "{}";

    public Guid? LinkedInspectionId { get; set; }
    public string? LinkedInspectionStatus { get; set; }
    public string Status { get; set; } = "Pending"; // Pending / Done
}

public class ChecklistAuditHistoryDto
{
    public Guid Id { get; set; }
    public Guid ChecklistId { get; set; }
    public string FromStatus { get; set; } = string.Empty;
    public string ToStatus { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public Guid? ActorId { get; set; }
    public string? ActorName { get; set; }
    public string? ActorRole { get; set; }
    public string? Comment { get; set; }
    public string? DetailsJson { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ChecklistSummaryDto
{
    public Guid ObjectId { get; set; }
    public string ObjectName { get; set; } = string.Empty;
    public string ObjectCode { get; set; } = string.Empty;
    public int TotalChecklists { get; set; }
    public int CompletedChecklists { get; set; }
    public int ApprovedChecklists => CompletedChecklists;
    public int InProgressChecklists { get; set; }
    public int TotalItems { get; set; }
    public int DoneItems { get; set; }
    public int CompletedItems => DoneItems;
    public double OverallProgressPercentage => TotalItems > 0 ? Math.Round((double)DoneItems / TotalItems * 100, 1) : 0;

    public List<ChecklistDto> Checklists { get; set; } = new();
}

// Request Models
public record CreateChecklistRequest(
    Guid ObjectId,
    string Name,
    string? Description,
    List<CreateChecklistItemRequest>? Items = null
);

public record CreateChecklistItemRequest(
    string Name,
    int OrderIndex = 0,
    bool IsRequired = true,
    string? FormSchemaJson = "{}"
);

public record UpdateChecklistRequest(
    string Name,
    string? Description
);

public record AddChecklistItemRequest(
    string Name,
    int OrderIndex = 0,
    bool IsRequired = true,
    string? FormSchemaJson = "{}"
);

public record UpdateChecklistItemRequest(
    string Name,
    int OrderIndex = 0,
    bool IsRequired = true,
    string? FormSchemaJson = "{}",
    string? Status = null
);

public record SupervisorModifyChecklistRequest(
    string? Name,
    string? Description,
    List<SupervisorModifyItemDto>? Items,
    string? Comment
);

public record SupervisorModifyItemDto(
    Guid? Id,
    string Name,
    int OrderIndex = 0,
    bool IsRequired = true,
    string? FormSchemaJson = "{}",
    bool IsDeleted = false
);

public record SupervisorDecisionRequest(
    string? Comment,
    string? RejectReason
);

public record LinkInspectionToChecklistItemRequest(
    Guid InspectionId
);
