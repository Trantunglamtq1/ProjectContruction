using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace ConstructionProject.Infrastructure.Services;

public class SignalRNotificationService : INotificationService
{
    private readonly IHubContext<NotificationHub> _hubContext;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<SignalRNotificationService> _logger;

    public SignalRNotificationService(
        IHubContext<NotificationHub> hubContext,
        IServiceScopeFactory scopeFactory,
        ILogger<SignalRNotificationService> logger)
    {
        _hubContext = hubContext;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task SendNotificationToUserAsync(string userId, NotificationMessage notification, CancellationToken cancellationToken = default)
    {
        Guid? parsedUserId = Guid.TryParse(userId, out var uid) ? uid : null;
        Guid notifId = Guid.TryParse(notification.Id, out var nid) ? nid : Guid.NewGuid();
        notification.Id = notifId.ToString();

        // 1. Lưu thông báo vào cơ sở dữ liệu để bảo đảm người nhận xem lại được ngay cả khi offline
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

            var entity = new Notification
            {
                Id = notifId,
                UserId = parsedUserId,
                RoleName = null,
                Title = notification.Title,
                Content = notification.Content,
                Type = notification.Type ?? "info",
                TargetUrl = notification.TargetUrl,
                ReferenceId = notification.ReferenceId,
                ReferenceType = notification.ReferenceType,
                IsRead = false,
                CreatedAt = notification.CreatedAt != default ? notification.CreatedAt : DateTime.UtcNow
            };

            dbContext.Notifications.Add(entity);
            await dbContext.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Persisted notification {NotifId} for User_{UserId}", notifId, userId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist notification for User_{UserId}", userId);
        }

        // 2. Bắn thông báo Realtime SignalR qua WebSocket
        try
        {
            _logger.LogInformation("Sending realtime notification to User_{UserId}: {Title}", userId, notification.Title);
            await _hubContext.Clients.Group($"User_{userId}").SendAsync("ReceiveNotification", notification, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send SignalR notification to User_{UserId}", userId);
        }
    }

    public async Task SendNotificationToRoleAsync(string roleName, NotificationMessage notification, CancellationToken cancellationToken = default)
    {
        Guid notifId = Guid.TryParse(notification.Id, out var nid) ? nid : Guid.NewGuid();
        notification.Id = notifId.ToString();

        // 1. Lưu thông báo vào cơ sở dữ liệu theo RoleName
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

            var entity = new Notification
            {
                Id = notifId,
                UserId = null,
                RoleName = roleName,
                Title = notification.Title,
                Content = notification.Content,
                Type = notification.Type ?? "info",
                TargetUrl = notification.TargetUrl,
                ReferenceId = notification.ReferenceId,
                ReferenceType = notification.ReferenceType,
                IsRead = false,
                CreatedAt = notification.CreatedAt != default ? notification.CreatedAt : DateTime.UtcNow
            };

            dbContext.Notifications.Add(entity);
            await dbContext.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Persisted notification {NotifId} for Role_{RoleName}", notifId, roleName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist notification for Role_{RoleName}", roleName);
        }

        // 2. Bắn thông báo Realtime SignalR qua WebSocket
        try
        {
            _logger.LogInformation("Sending realtime notification to Role_{RoleName}: {Title}", roleName, notification.Title);
            await _hubContext.Clients.Group($"Role_{roleName}").SendAsync("ReceiveNotification", notification, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send SignalR notification to Role_{RoleName}", roleName);
        }
    }

    public async Task SendNotificationToAllAsync(NotificationMessage notification, CancellationToken cancellationToken = default)
    {
        Guid notifId = Guid.TryParse(notification.Id, out var nid) ? nid : Guid.NewGuid();
        notification.Id = notifId.ToString();

        // 1. Lưu thông báo vào cơ sở dữ liệu Broadcast
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();

            var entity = new Notification
            {
                Id = notifId,
                UserId = null,
                RoleName = null,
                Title = notification.Title,
                Content = notification.Content,
                Type = notification.Type ?? "info",
                TargetUrl = notification.TargetUrl,
                ReferenceId = notification.ReferenceId,
                ReferenceType = notification.ReferenceType,
                IsRead = false,
                CreatedAt = notification.CreatedAt != default ? notification.CreatedAt : DateTime.UtcNow
            };

            dbContext.Notifications.Add(entity);
            await dbContext.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Persisted broadcast notification {NotifId}", notifId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist broadcast notification");
        }

        // 2. Bắn thông báo Realtime SignalR
        try
        {
            _logger.LogInformation("Broadcasting realtime notification to all clients: {Title}", notification.Title);
            await _hubContext.Clients.All.SendAsync("ReceiveNotification", notification, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to broadcast SignalR notification");
        }
    }
}
