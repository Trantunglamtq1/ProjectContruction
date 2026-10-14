using ConstructionProject.Domain.Enums;

namespace ConstructionProject.Domain.Entities;

/// <summary>
/// Từng đầu việc/tiêu chí trong Checklist. 
/// Mỗi ChecklistItem có thể liên kết tới đúng 1 FormInspection cụ thể.
/// </summary>
public class ChecklistItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChecklistId { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public bool IsRequired { get; set; } = true;
    
    // FK tới FormInspection liên kết (nullable — có thể chưa gắn)
    public Guid? LinkedInspectionId { get; set; }
    
    // Pending / Done — Done chỉ khi Inspection liên kết đã Approved
    public ChecklistItemStatus Status { get; set; } = ChecklistItemStatus.Pending;

    // Navigation Properties
    public Checklist? Checklist { get; set; }
    public FormInspection? LinkedInspection { get; set; }
}
