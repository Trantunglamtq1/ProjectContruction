namespace ConstructionProject.Domain.Entities;

public class ProjectAttachment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProjectId { get; set; }
    public string StoredFileName { get; set; } = string.Empty;
    public string OriginalName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long Size { get; set; }
    public Guid? UploadedById { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public Project Project { get; set; } = null!;
}
