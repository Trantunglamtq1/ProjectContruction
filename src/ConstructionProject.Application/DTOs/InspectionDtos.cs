namespace ConstructionProject.Application.DTOs;

public class PaginatedResult<T>
{
    public List<T> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)Math.Max(1, PageSize));
    public bool HasPreviousPage => PageNumber > 1;
    public bool HasNextPage => PageNumber < TotalPages;

    public PaginatedResult() { }

    public PaginatedResult(List<T> items, int totalCount, int pageNumber, int pageSize)
    {
        Items = items;
        TotalCount = totalCount;
        PageNumber = pageNumber;
        PageSize = pageSize;
    }
}

public class InspectionDto
{
    public Guid Id { get; set; }
    public Guid ObjectId { get; set; }
    public string ObjectName { get; set; } = string.Empty;
    public Guid DrawingFileId { get; set; }
    public string DrawingFileName { get; set; } = string.Empty;
    public int DrawingPageNumber { get; set; }
    public string FormSchemaId { get; set; } = string.Empty;
    public string FormDataJson { get; set; } = "{}";
    public string Status { get; set; } = "Draft";
    public string? WorkflowInstanceId { get; set; }
    
    public Guid? SubmittedById { get; set; }
    public string? SubmittedBy { get; set; }
    public DateTime? SubmittedAt { get; set; }
    
    public Guid? ReviewedById { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    
    public Guid? ApprovedById { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    
    public string? RejectReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int LinkedChecklistItemsCount { get; set; }
}

public class InspectionAuditHistoryDto
{
    public Guid Id { get; set; }
    public Guid InspectionId { get; set; }
    public string FromStatus { get; set; } = string.Empty;
    public string ToStatus { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public Guid? ActorId { get; set; }
    public string? ActorName { get; set; }
    public string? ActorRole { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class FormSchemaItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public int ComponentsCount { get; set; }
}
