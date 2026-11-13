using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.API.Controllers;

public record NotificationItemDto(Guid Id, Guid? UserId, string? RoleName, string Title, string Content, string Type,
    string? TargetUrl, string? ReferenceId, string? ReferenceType, bool IsRead, DateTime CreatedAt, Guid? ProjectId);
public record NotificationsResponseDto(List<NotificationItemDto> Items, int UnreadCount);

[ApiController, Route("api/[controller]"), Authorize]
public class NotificationsController(IApplicationDbContext db, ICurrentUserService current, IProjectAccessService access) : ControllerBase
{
    private IQueryable<Notification> Visible => db.Notifications.Where(n => n.UserId == current.UserId &&
        (n.ProjectId.HasValue ? access.AccessibleProjectIds.Contains(n.ProjectId.Value) : n.ReferenceId == null && n.ReferenceType == null && n.TargetUrl == null));

    [HttpGet]
    public async Task<IActionResult> GetMyNotifications(CancellationToken ct)
    {
        await access.DemandIdentityAsync(ct);
        var query = Visible.AsNoTracking();
        var unread = await query.CountAsync(n => !n.IsRead, ct);
        var items = await query.OrderByDescending(n => n.CreatedAt).Take(50).Select(n => new NotificationItemDto(
            n.Id, n.UserId, n.RoleName, n.Title, n.Content, n.Type, n.TargetUrl, n.ReferenceId, n.ReferenceType, n.IsRead, n.CreatedAt, n.ProjectId)).ToListAsync(ct);
        return Ok(new NotificationsResponseDto(items, unread));
    }

    [HttpPut("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken ct)
    {
        await access.DemandIdentityAsync(ct);
        var item = await Visible.SingleOrDefaultAsync(n => n.Id == id, ct);
        if (item == null) return NotFound();
        item.IsRead = true;
        await db.SaveChangesAsync(ct);
        return Ok(new { success = true });
    }

    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllAsRead(CancellationToken ct)
    {
        await access.DemandIdentityAsync(ct);
        var items = await Visible.Where(n => !n.IsRead).ToListAsync(ct);
        foreach (var item in items) item.IsRead = true;
        await db.SaveChangesAsync(ct);
        return Ok(new { success = true, markedCount = items.Count });
    }

    [HttpDelete]
    public async Task<IActionResult> ClearAll(CancellationToken ct)
    {
        await access.DemandIdentityAsync(ct);
        var items = await Visible.ToListAsync(ct);
        db.Notifications.RemoveRange(items);
        await db.SaveChangesAsync(ct);
        return Ok(new { success = true, deletedCount = items.Count });
    }
}
