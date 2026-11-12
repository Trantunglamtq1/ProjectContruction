namespace ConstructionProject.Domain.Entities;

/// <summary>A durable request to synchronize an inspection's committed state with Elsa.</summary>
public sealed class InspectionWorkflowOperation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InspectionId { get; set; }
    public string InstanceId { get; set; } = string.Empty;
    public string? PreviousInstanceId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? ActorName { get; set; }
    public string? Comment { get; set; }
    public int AttemptCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime NextAttemptAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }
    public string? LastError { get; set; }
    public FormInspection? Inspection { get; set; }
}
