namespace ConstructionProject.Domain.Entities;

public class ProjectMember
{
    public Guid ProjectId { get; set; }
    public Guid UserId { get; set; }
    public DateTime AssignedAt { get; set; } = DateTime.UtcNow;
    public Guid? AssignedById { get; set; }
    public Project Project { get; set; } = null!;
    public User User { get; set; } = null!;
}
