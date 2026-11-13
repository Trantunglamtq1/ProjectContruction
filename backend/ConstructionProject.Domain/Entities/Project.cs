namespace ConstructionProject.Domain.Entities;

public class Project
{
    public static readonly Guid LegacyId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    // Persisted with drawing/object changes; never use this as an authorization or workflow token.
    public Guid DrawingListCacheVersion { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<ProjectMember> Members { get; set; } = new List<ProjectMember>();
}
