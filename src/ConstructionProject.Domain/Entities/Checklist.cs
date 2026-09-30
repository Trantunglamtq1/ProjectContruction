using ConstructionProject.Domain.Enums;

namespace ConstructionProject.Domain.Entities;

/// <summary>
/// Danh sách các đầu việc/tiêu chí cần kiểm tra và xác nhận trên 1 Object.
/// </summary>
public class Checklist
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // FK tới Object (từ bản vẽ) mà Checklist thuộc về
    public Guid ObjectId { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    
    // Trạng thái Checklist: Open / InProgress / Completed
    public ChecklistStatus Status { get; set; } = ChecklistStatus.Open;

    // UserId người tạo Checklist (Reviewer) từ JWT
    public Guid? CreatedById { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation Properties
    public ConstructionObject? Object { get; set; }
    public User? Creator { get; set; }
    public ICollection<ChecklistItem> Items { get; set; } = new List<ChecklistItem>();
}
