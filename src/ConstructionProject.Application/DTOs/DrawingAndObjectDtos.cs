namespace ConstructionProject.Application.DTOs;

public class DrawingFileDto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FileType { get; set; } = "pdf";
    public string FileUrl { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string UploadedBy { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
    public int ObjectCount { get; set; }
}

public class DrawingFileDetailDto
{
    public Guid Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string FileType { get; set; } = "pdf";
    public string FileUrl { get; set; } = string.Empty;
    public long FileSizeBytes { get; set; }
    public string UploadedBy { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
    public List<ObjectDto> Objects { get; set; } = new();
}

public class ObjectDto
{
    public Guid Id { get; set; }
    public Guid DrawingFileId { get; set; }
    public string DrawingFileName { get; set; } = string.Empty;
    public int PageNumber { get; set; }
    public string MarkerCoordinates { get; set; } = "{}";
    public string Name { get; set; } = string.Empty;
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int InspectionCount { get; set; }
    public int ChecklistCount { get; set; }
}

public class MarkerCoordinatesDto
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
}
