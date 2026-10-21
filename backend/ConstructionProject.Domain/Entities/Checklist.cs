using ConstructionProject.Domain.Enums;

namespace ConstructionProject.Domain.Entities;

/// <summary>
/// Danh sách các đầu việc/tiêu chí cần kiểm tra và xác nhận trên 1 Object.
/// Được điều phối theo 2 giai đoạn: Planning (Kế hoạch) và Execution (Nghiệm thu).
/// </summary>
public class Checklist
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // FK tới Object (từ bản vẽ) mà Checklist thuộc về
    public Guid ObjectId { get; set; }
    
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    
    // Trạng thái Checklist: Draft / PendingSupervisor / Approved / Rejected / InProgress / Completed
    public ChecklistStatus Status { get; set; } = ChecklistStatus.Draft;

    // Id của Elsa Workflow Instance quản lý tiến trình duyệt Checklist (Workflow #1)
    public string? WorkflowInstanceId { get; set; }

    // Lý do từ chối nếu Giám sát yêu cầu lập lại kế hoạch (Status = Rejected)
    public string? RejectReason { get; set; }

    // UserId người tạo Checklist (Kỹ sư / Submitter) từ JWT
    public Guid? CreatedById { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // UserId người thẩm định/phê duyệt Checklist (Giám sát / Reviewer)
    public Guid? ReviewedById { get; set; }
    public string? ReviewedBy { get; set; }
    public DateTime? ReviewedAt { get; set; }

    // Xóa mềm (Soft Delete - NFR-1)
    public bool IsDeleted { get; set; } = false;

    // Optimistic Concurrency Control (NFR-2)
    public byte[]? RowVersion { get; set; }

    // Navigation Properties
    public ConstructionObject? Object { get; set; }
    public User? Creator { get; set; }
    public User? Reviewer { get; set; }
    public ICollection<ChecklistItem> Items { get; set; } = new List<ChecklistItem>();
    public ICollection<ChecklistAuditHistory> AuditHistories { get; set; } = new List<ChecklistAuditHistory>();
}
