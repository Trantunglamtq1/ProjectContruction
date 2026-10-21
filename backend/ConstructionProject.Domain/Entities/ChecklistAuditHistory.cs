namespace ConstructionProject.Domain.Entities;

/// <summary>
/// Ghi nhận 100% nhật ký kiểm toán (Audit Trail) của Checklist và ChecklistItems (FR-10).
/// Lưu vết: Ai làm, vai trò, hành động (Thêm/Sửa/Xóa/Trình duyệt/Duyệt/Từ chối), chi tiết thay đổi và thời gian.
/// </summary>
public class ChecklistAuditHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // FK tới Checklist
    public Guid ChecklistId { get; set; }
    
    // Trạng thái Checklist trước và sau hành động
    public string FromStatus { get; set; } = string.Empty;
    public string ToStatus { get; set; } = string.Empty;
    
    // Hành động: CreateDraft / SubmitForApproval / SupervisorModify / SupervisorApprove / SupervisorReject / AddItem / UpdateItem / DeleteItem
    public string Action { get; set; } = string.Empty;
    
    // Thông tin người thực hiện (từ JWT)
    public Guid? ActorId { get; set; }
    public string? ActorName { get; set; }
    public string? ActorRole { get; set; }
    
    // Lý do hoặc ghi chú
    public string? Comment { get; set; }
    
    // Dữ liệu chi tiết trước/sau hoặc danh sách các trường bị can thiệp
    public string? DetailsJson { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Checklist? Checklist { get; set; }
}
