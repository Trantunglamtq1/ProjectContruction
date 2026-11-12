using ConstructionProject.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace ConstructionProject.Infrastructure.Services;

/// <summary>Delivery is best effort after the business transaction has committed.</summary>
public sealed class BestEffortNotificationService(
    INotificationService inner,
    ILogger<BestEffortNotificationService> logger) : INotificationService
{
    public Task SendNotificationToUserAsync(string userId, NotificationMessage notification, CancellationToken cancellationToken = default) =>
        SendAsync(() => inner.SendNotificationToUserAsync(userId, notification, cancellationToken));
    public Task SendNotificationToRoleAsync(string roleName, NotificationMessage notification, CancellationToken cancellationToken = default) =>
        SendAsync(() => inner.SendNotificationToRoleAsync(roleName, notification, cancellationToken));
    public Task SendNotificationToAllAsync(NotificationMessage notification, CancellationToken cancellationToken = default) =>
        SendAsync(() => inner.SendNotificationToAllAsync(notification, cancellationToken));

    private async Task SendAsync(Func<Task> send)
    {
        try { await send(); }
        catch (Exception ex)
        {
            logger.LogError("Không gửi được thông báo sau khi lưu; loại lỗi {ErrorType}", ex.GetType().Name);
        }
    }
}
