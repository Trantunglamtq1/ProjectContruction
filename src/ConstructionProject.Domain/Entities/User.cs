namespace ConstructionProject.Domain.Entities;

/// <summary>
/// Đại diện cho tài khoản người dùng trong hệ thống.
/// </summary>
public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;

    // FK tới Role, nullable - null nghĩa là tài khoản đăng ký xong chưa được Admin gán Role
    public Guid? RoleId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation tới Role
    public Role? Role { get; set; }

    // Navigation quan hệ User (1) — (n) DrawingFile / Object / FormInspection / Checklist
    public ICollection<DrawingFile> UploadedDrawingFiles { get; set; } = new List<DrawingFile>();
    public ICollection<ConstructionObject> CreatedObjects { get; set; } = new List<ConstructionObject>();
    public ICollection<FormInspection> SubmittedInspections { get; set; } = new List<FormInspection>();
    public ICollection<FormInspection> ReviewedInspections { get; set; } = new List<FormInspection>();
    public ICollection<FormInspection> ApprovedInspections { get; set; } = new List<FormInspection>();
    public ICollection<Checklist> CreatedChecklists { get; set; } = new List<Checklist>();
}
