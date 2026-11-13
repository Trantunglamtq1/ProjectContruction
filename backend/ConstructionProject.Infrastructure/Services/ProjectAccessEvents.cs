using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Infrastructure.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace ConstructionProject.Infrastructure.Services;

public sealed class ProjectAccessEvents(IHubContext<NotificationHub> hub,ILogger<ProjectAccessEvents> logger) : IProjectAccessEvents
{
    public async Task MembershipChangedAsync(Guid userId,Guid projectId,CancellationToken cancellationToken = default)
    {
        try
        {
            await hub.Clients.Group($"User_{userId}").SendAsync("ProjectAccessChanged",new { projectId },cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,"Membership committed; access-change notification could not be delivered.");
        }
    }
}
