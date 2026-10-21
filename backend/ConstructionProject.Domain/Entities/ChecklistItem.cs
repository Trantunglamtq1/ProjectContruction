using ConstructionProject.Domain.Enums;

namespace ConstructionProject.Domain.Entities;

/// <summary>
/// Từng đầu việc/tiêu chí trong Checklist. 
/// Mỗi ChecklistItem lưu cấu trúc FormSchemaJson (từ Form.io Builder)
/// và có thể liên kết tới đúng 1 FormInspection cụ thể khi nghiệm thu hiện trường.
/// </summary>
public class ChecklistItem
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ChecklistId { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public int OrderIndex { get; set; } = 0;
    public bool IsRequired { get; set; } = true;

    // Cấu trúc Form.io JSON Schema được thiết lập ở Giai đoạn 1 (Planning Phase)
    public string FormSchemaJson { get; set; } = "{}";
    
    // FK tới FormInspection liên kết (nullable — chỉ gán ở Giai đoạn 2 khi Checklist đã Approved)
    public Guid? LinkedInspectionId { get; set; }
    
    // Pending / Done — Done chỉ khi Inspection liên kết đã Approved
    public ChecklistItemStatus Status { get; set; } = ChecklistItemStatus.Pending;

    // Xóa mềm (Soft Delete - NFR-1)
    public bool IsDeleted { get; set; } = false;

    // Optimistic Concurrency Control (NFR-2)
    public byte[]? RowVersion { get; set; }

    // Navigation Properties
    public Checklist? Checklist { get; set; }
    public FormInspection? LinkedInspection { get; set; }
}
