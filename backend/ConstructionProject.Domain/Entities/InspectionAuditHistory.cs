using ConstructionProject.Domain.Enums;

namespace ConstructionProject.Domain.Entities;

/// <summary>
/// Ghi nhận nhật ký vết chuyển đổi trạng thái và phê duyệt trong workflow của Form Inspection.
/// </summary>
public class InspectionAuditHistory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // FK tới FormInspection
    public Guid InspectionId { get; set; }
    
    // Trạng thái trước và sau khi thực hiện hành động
    public InspectionStatus FromStatus { get; set; }
    public InspectionStatus ToStatus { get; set; }
    
    // Tên hành động: CreateDraft / Submit / Receive / ReviewPass / Approve / Reject / Resubmit
    public string Action { get; set; } = string.Empty;
    
    // Thông tin người thực hiện (lấy từ JWT)
    public Guid? ActorId { get; set; }
    public string? ActorName { get; set; }
    public string? ActorRole { get; set; }
    
    // Ghi chú hoặc lý do từ chối
    public string? Comment { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public FormInspection? Inspection { get; set; }
}
