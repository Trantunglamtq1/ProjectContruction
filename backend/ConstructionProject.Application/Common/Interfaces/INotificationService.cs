namespace ConstructionProject.Application.Common.Interfaces;

public class NotificationMessage
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Type { get; set; } = "info"; // "info", "success", "warning", "error"
    public string? TargetUrl { get; set; }
    public string? ReferenceId { get; set; }
    public string? ReferenceType { get; set; } // "Inspection", "Checklist"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public interface INotificationService
{
    Task SendNotificationToUserAsync(string userId, NotificationMessage notification, CancellationToken cancellationToken = default);
    Task SendNotificationToRoleAsync(string roleName, NotificationMessage notification, CancellationToken cancellationToken = default);
    Task SendNotificationToAllAsync(NotificationMessage notification, CancellationToken cancellationToken = default);
}
