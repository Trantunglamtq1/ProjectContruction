using ConstructionProject.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.API.Controllers;

public record NotificationItemDto(
    Guid Id,
    Guid? UserId,
    string? RoleName,
    string Title,
    string Content,
    string Type,
    string? TargetUrl,
    string? ReferenceId,
    string? ReferenceType,
    bool IsRead,
    DateTime CreatedAt
);

public record NotificationsResponseDto(
    List<NotificationItemDto> Items,
    int UnreadCount
);

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly ICurrentUserService _currentUserService;

    public NotificationsController(
        IApplicationDbContext context,
        ICurrentUserService currentUserService)
    {
        _context = context;
        _currentUserService = currentUserService;
    }

    /// <summary>
    /// Lấy danh sách 50 thông báo gần nhất và số lượng chưa đọc của người dùng hiện tại
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(NotificationsResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyNotifications(CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        var currentRole = _currentUserService.Role;

        var query = _context.Notifications.AsNoTracking()
            .Where(n => 
                (currentUserId.HasValue && n.UserId == currentUserId.Value) ||
                (!string.IsNullOrEmpty(currentRole) && n.RoleName == currentRole) ||
                (n.UserId == null && n.RoleName == null)
            );

        var unreadCount = await query.CountAsync(n => !n.IsRead, cancellationToken);

        var items = await query
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Select(n => new NotificationItemDto(
                n.Id,
                n.UserId,
                n.RoleName,
                n.Title,
                n.Content,
                n.Type,
                n.TargetUrl,
                n.ReferenceId,
                n.ReferenceType,
                n.IsRead,
                n.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return Ok(new NotificationsResponseDto(items, unreadCount));
    }

    /// <summary>
    /// Đánh dấu 1 thông báo là đã đọc
    /// </summary>
    [HttpPut("{id:guid}/read")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken cancellationToken)
    {
        var notif = await _context.Notifications.FirstOrDefaultAsync(n => n.Id == id, cancellationToken);
        if (notif == null)
        {
            return NotFound(new { message = "Không tìm thấy thông báo." });
        }

        notif.IsRead = true;
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(new { success = true });
    }

    /// <summary>
    /// Đánh dấu tất cả thông báo của người dùng là đã đọc
    /// </summary>
    [HttpPut("read-all")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkAllAsRead(CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        var currentRole = _currentUserService.Role;

        var unreadList = await _context.Notifications
            .Where(n => !n.IsRead && (
                (currentUserId.HasValue && n.UserId == currentUserId.Value) ||
                (!string.IsNullOrEmpty(currentRole) && n.RoleName == currentRole) ||
                (n.UserId == null && n.RoleName == null)
            ))
            .ToListAsync(cancellationToken);

        foreach (var notif in unreadList)
        {
            notif.IsRead = true;
        }

        await _context.SaveChangesAsync(cancellationToken);
        return Ok(new { success = true, markedCount = unreadList.Count });
    }

    /// <summary>
    /// Xóa toàn bộ lịch sử thông báo của người dùng hiện tại
    /// </summary>
    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ClearAll(CancellationToken cancellationToken)
    {
        var currentUserId = _currentUserService.UserId;
        var currentRole = _currentUserService.Role;

        var myNotifs = await _context.Notifications
            .Where(n => 
                (currentUserId.HasValue && n.UserId == currentUserId.Value) ||
                (!string.IsNullOrEmpty(currentRole) && n.RoleName == currentRole)
            )
            .ToListAsync(cancellationToken);

        _context.Notifications.RemoveRange(myNotifs);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new { success = true, deletedCount = myNotifs.Count });
    }
}
