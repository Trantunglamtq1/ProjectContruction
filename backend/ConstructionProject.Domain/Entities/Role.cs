namespace ConstructionProject.Domain.Entities;

/// <summary>
/// Đại diện cho vai trò nghiệp vụ (Admin, Submitter, Reviewer, Approver).
/// </summary>
public class Role
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    // Navigation
    public ICollection<User> Users { get; set; } = new List<User>();
}
