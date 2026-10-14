namespace ConstructionProject.Domain.Entities;

/// <summary>
/// Đại diện cho file bản vẽ xây dựng (PDF) được tải lên hệ thống.
/// </summary>
public class DrawingFile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string FileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string FileType { get; set; } = "pdf";
    public string FileUrl { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    
    // UserId người upload (lấy từ JWT)
    public Guid? UploadedById { get; set; }
    public string UploadedBy { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User? Uploader { get; set; }
    public ICollection<ConstructionObject> Objects { get; set; } = new List<ConstructionObject>();
}
