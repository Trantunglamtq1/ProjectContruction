namespace ConstructionProject.Domain.Entities;

/// <summary>
/// Đại diện cho cấu kiện/hạng mục được khoanh vùng (marker) trực tiếp trên bản vẽ xây dựng.
/// Bắt buộc phải gắn với đúng 1 DrawingFileId + PageNumber + MarkerCoordinates.
/// </summary>
public class ConstructionObject
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    // FK bắt buộc tới DrawingFile - Object luôn phải có nguồn gốc từ 1 bản vẽ
    public Guid DrawingFileId { get; set; }
    public int PageNumber { get; set; } = 1;
    
    // Toạ độ vùng khoanh trên trang (x, y, width, height) lưu dạng JSON
    public string MarkerCoordinates { get; set; } = "{}";
    
    // Tên Object do người dùng đặt khi khoanh vùng (vd: "Cột C12 - Tầng 3")
    public string Name { get; set; } = string.Empty;
    
    // UserId người tạo Object (lấy từ JWT)
    public Guid? CreatedById { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public DrawingFile? DrawingFile { get; set; }
    public User? Creator { get; set; }
    public ICollection<FormInspection> FormInspections { get; set; } = new List<FormInspection>();
    public ICollection<Checklist> Checklists { get; set; } = new List<Checklist>();
}
