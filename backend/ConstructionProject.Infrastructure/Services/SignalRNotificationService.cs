using System.Security.Cryptography;
using System.Text;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Domain.Constants;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace ConstructionProject.Infrastructure.Services;

public class SignalRNotificationService(
    IHubContext<NotificationHub> hubContext,
    IServiceScopeFactory scopeFactory,
    ILogger<SignalRNotificationService> logger) : INotificationService
{
    public Task SendNotificationToUserAsync(string userId, NotificationMessage notification, CancellationToken cancellationToken = default) =>
        Guid.TryParse(userId, out var id) ? DispatchAsync(notification, id, null, cancellationToken) : Task.CompletedTask;

    public Task SendNotificationToRoleAsync(string roleName, NotificationMessage notification, CancellationToken cancellationToken = default) =>
        DispatchAsync(notification, null, roleName, cancellationToken);

    public Task SendNotificationToAllAsync(NotificationMessage notification, CancellationToken cancellationToken = default) =>
        DispatchAsync(notification, null, null, cancellationToken);

    private async Task DispatchAsync(NotificationMessage message, Guid? recipient, string? role, CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        Guid? project = null;
        // Business messages must resolve an actual resource. Never fall back to a global broadcast.
        if (!string.IsNullOrEmpty(message.ReferenceType) || !string.IsNullOrEmpty(message.ReferenceId))
        {
            if (!Guid.TryParse(message.ReferenceId, out var resource)) return;
            project = message.ReferenceType switch
            {
                "Inspection" => await db.FormInspections.Where(i => i.Id == resource).Select(i => (Guid?)i.Object!.DrawingFile!.ProjectId).SingleOrDefaultAsync(ct),
                "Checklist" => await db.Checklists.Where(c => c.Id == resource).Select(c => (Guid?)c.Object!.DrawingFile!.ProjectId).SingleOrDefaultAsync(ct),
                _ => null
            };
            if (!project.HasValue || (message.ProjectId.HasValue && message.ProjectId != project)) return;
        }
        else if (message.ProjectId.HasValue || !string.IsNullOrEmpty(message.TargetUrl)) return;

        var users = db.Users.AsNoTracking().Where(u => u.IsActive && u.RoleId != null);
        if (recipient.HasValue) users = users.Where(u => u.Id == recipient);
        if (role != null) users = users.Where(u => u.Role != null && u.Role.Name == role);
        if (project.HasValue) users = users.Where(u => u.RoleId == RoleConstants.AdminRoleId || db.ProjectMembers.Any(m => m.ProjectId == project && m.UserId == u.Id));
        var recipients = await users.Select(u => u.Id).ToListAsync(ct);
        var eventId = Guid.TryParse(message.Id, out var parsed) ? parsed : Guid.NewGuid();
        foreach (var userId in recipients)
        {
            // Re-evaluate membership for each recipient, including already-connected users.
            if (!await db.Users.AsNoTracking().AnyAsync(u => u.Id == userId && u.IsActive &&
                (role == null || (u.Role != null && u.Role.Name == role)) &&
                (!project.HasValue || u.RoleId == RoleConstants.AdminRoleId || db.ProjectMembers.Any(m => m.UserId == u.Id && m.ProjectId == project)), ct)) continue;
            var id = new Guid(SHA256.HashData(Encoding.UTF8.GetBytes($"{eventId:D}:{userId:D}"))[..16]);
            var entity = await db.Notifications.SingleOrDefaultAsync(n => n.Id == id, ct);
            if (entity == null)
            {
                entity = new Notification { Id = id, UserId = userId, ProjectId = project, Title = message.Title, Content = message.Content,
                    Type = message.Type, TargetUrl = message.TargetUrl, ReferenceId = message.ReferenceId, ReferenceType = message.ReferenceType,
                    CreatedAt = message.CreatedAt == default ? DateTime.UtcNow : message.CreatedAt };
                db.Notifications.Add(entity);
                await db.SaveChangesAsync(ct);
            }
            if (!await db.Users.AnyAsync(u => u.Id == userId && u.IsActive &&
                (!project.HasValue || u.RoleId == RoleConstants.AdminRoleId || db.ProjectMembers.Any(m => m.UserId == userId && m.ProjectId == project)), ct)) continue;
            try
            {
                await hubContext.Clients.Group($"User_{userId:D}").SendAsync("ReceiveNotification", new NotificationMessage {
                    Id = id.ToString(), ProjectId = project, Title = entity.Title, Content = entity.Content, Type = entity.Type,
                    TargetUrl = entity.TargetUrl, ReferenceId = entity.ReferenceId, ReferenceType = entity.ReferenceType, CreatedAt = entity.CreatedAt
                }, ct);
            }
            catch (Exception ex) when (!ct.IsCancellationRequested) { logger.LogWarning(ex, "Realtime notification delivery failed for {NotificationId}", id); }
        }
    }
}
