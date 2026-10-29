namespace ConstructionProject.Domain.Entities;

/// <summary>
/// Lưu trữ thông báo hệ thống và lịch sử gửi tới người dùng hoặc nhóm vai trò.
/// </summary>
public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();

    // Id người nhận cụ thể (nếu gửi đích danh)
    public Guid? UserId { get; set; }

    // Tên vai trò nhận (nếu thông báo theo nhóm vai trò: Reviewer, Approver, Submitter)
    public string? RoleName { get; set; }

    // Tiêu đề & nội dung thông báo
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;

    // Phân loại: info / success / warning / error
    public string Type { get; set; } = "info";

    // Đường dẫn điều hướng khi click vào thông báo
    public string? TargetUrl { get; set; }

    // Tham chiếu đối tượng liên quan (Id của Inspection, Checklist)
    public string? ReferenceId { get; set; }
    public string? ReferenceType { get; set; }

    // Trạng thái đã đọc hay chưa
    public bool IsRead { get; set; } = false;

    // Thời gian tạo
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
