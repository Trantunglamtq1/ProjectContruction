using ConstructionProject.Domain.Enums;

namespace ConstructionProject.Domain.Entities;

/// <summary>
/// Biểu mẫu kiểm tra hiện trường được định nghĩa động qua FormIO (schema JSON),
/// gắn với 1 Object đã được xác định từ bản vẽ.
/// </summary>
public class FormInspection
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // FK tới Object (đã được xác định từ bản vẽ) mà Inspection này thuộc về
    public Guid ObjectId { get; set; }
    
    // FK/định danh schema FormIO được dùng để render form
    public string FormSchemaId { get; set; } = "default-inspection-schema";
    
    // Dữ liệu đã submit, lưu dạng JSON theo đúng cấu trúc schema
    public string FormDataJson { get; set; } = "{}";
    
    // Trạng thái hiện tại (Draft/Submitted/UnderReview/Approved/Rejected), đồng bộ với Elsa Workflow
    public InspectionStatus Status { get; set; } = InspectionStatus.Draft;
    
    // UserId submit (từ JWT) và thời điểm submit
    public Guid? SubmittedById { get; set; }
    public string? SubmittedBy { get; set; }
    public DateTime? SubmittedAt { get; set; }
    
    // UserId review (từ JWT) và thời điểm chuyển UnderReview
    public Guid? ReviewedById { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }
    
    // UserId duyệt cuối (từ JWT) và thời điểm Approve
    public Guid? ApprovedById { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    
    // Bắt buộc khi Status = Rejected
    public string? RejectReason { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation Properties
    public ConstructionObject? Object { get; set; }
    public User? Submitter { get; set; }
    public User? Reviewer { get; set; }
    public User? Approver { get; set; }
    public ICollection<ChecklistItem> LinkedChecklistItems { get; set; } = new List<ChecklistItem>();
}
