using System.Security.Claims;
using ConstructionProject.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.Infrastructure.Hubs;

[Authorize]
public class NotificationHub(IApplicationDbContext db) : Hub
{
    public override async Task OnConnectedAsync()
    {
        var subject = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? Context.User?.FindFirst("sub")?.Value;
        if (!Guid.TryParse(subject, out var id) || !await db.Users.AsNoTracking().AnyAsync(u => u.Id == id && u.IsActive, Context.ConnectionAborted))
        {
            Context.Abort();
            return;
        }
        // No client-controlled or cached project/role group subscriptions.
        await Groups.AddToGroupAsync(Context.ConnectionId, $"User_{id:D}");
        await base.OnConnectedAsync();
    }
}
