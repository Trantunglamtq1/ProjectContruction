using System.Net;
using System.Net.Http.Json;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using ConstructionProject.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ConstructionProject.IntegrationTests;

public sealed class ProjectNotificationAuthorizationTests
{
    [Fact]
    public async Task RoleAndDirectDispatchResolveActualProject_AndRecheckRevokedRecipients()
    {
        await using var fixture = new ProjectAuthorizationFixture();
        Guid reviewer;
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            reviewer = await db.Users.Where(u => u.Username == "reviewer").Select(u => u.Id).SingleAsync();
        }
        using var serviceScope = fixture.Factory.Services.CreateScope();
        var service = serviceScope.ServiceProvider.GetRequiredService<SignalRNotificationService>();
        var first = Message(fixture.Allowed.InspectionId,"first");
        await service.SendNotificationToRoleAsync("Reviewer",first);
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var persisted = await db.Notifications.Where(n => n.Title == "first").ToListAsync();
            Assert.Single(persisted); Assert.Equal(reviewer,persisted[0].UserId); Assert.Null(persisted[0].RoleName);
            Assert.Equal(fixture.ProjectA.Id,persisted[0].ProjectId);
        }
        using var admin = await fixture.LoginAsync("admin");
        Assert.Equal(HttpStatusCode.NoContent,(await admin.DeleteAsync($"/api/projects/{fixture.ProjectA.Id}/members/{reviewer}")).StatusCode);
        await service.SendNotificationToRoleAsync("Reviewer",Message(fixture.Allowed.InspectionId,"after-revoke"));
        Assert.Equal(HttpStatusCode.NoContent,(await admin.DeleteAsync($"/api/projects/{fixture.ProjectA.Id}/members/{fixture.SubmitterId}")).StatusCode);
        await service.SendNotificationToUserAsync(fixture.SubmitterId.ToString(),Message(fixture.Allowed.InspectionId,"revoked-creator"));
        await service.SendNotificationToRoleAsync("Reviewer",Message(Guid.NewGuid(),"unknown-reference"));
        using var check = fixture.Factory.Services.CreateScope();
        var context = check.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.False(await context.Notifications.AnyAsync(n => n.Title == "after-revoke" || n.Title == "revoked-creator" || n.Title == "unknown-reference"));
    }

    [Fact]
    public async Task NotificationHistoryCountAndMutationsRespectRecipientAndProject()
    {
        await using var fixture = new ProjectAuthorizationFixture();
        var own = new Notification { UserId = fixture.SubmitterId, ProjectId = fixture.ProjectA.Id, Title = "own", Content = "A" };
        var foreign = new Notification { UserId = fixture.SubmitterId, ProjectId = fixture.ProjectB.Id, Title = "forbidden", Content = "B" };
        var other = new Notification { UserId = Guid.NewGuid(), ProjectId = fixture.ProjectA.Id, Title = "other", Content = "other" };
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Notifications.AddRange(own,foreign,other); await db.SaveChangesAsync();
        }
        using var actor = await fixture.LoginAsync("submitter");
        var result = await actor.GetFromJsonAsync<History>("/api/notifications");
        Assert.Single(result!.Items); Assert.Equal(own.Id,result.Items[0].Id); Assert.Equal(1,result.UnreadCount);
        Assert.Equal(HttpStatusCode.NotFound,(await actor.PutAsJsonAsync($"/api/notifications/{other.Id}/read",new {})).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await actor.PutAsJsonAsync($"/api/notifications/{foreign.Id}/read",new {})).StatusCode);
        Assert.True((await actor.PutAsJsonAsync("/api/notifications/read-all",new {})).IsSuccessStatusCode);
        Assert.True((await actor.DeleteAsync("/api/notifications")).IsSuccessStatusCode);
        using var check = fixture.Factory.Services.CreateScope(); var context = check.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.False(await context.Notifications.AnyAsync(n => n.Id == own.Id));
        Assert.False((await context.Notifications.SingleAsync(n => n.Id == other.Id)).IsRead);
        Assert.False((await context.Notifications.SingleAsync(n => n.Id == foreign.Id)).IsRead);
    }

    private static NotificationMessage Message(Guid id,string title) => new() { Title = title, Content = title, ReferenceType = "Inspection", ReferenceId = id.ToString() };
    private sealed record Item(Guid Id);
    private sealed record History(List<Item> Items,int UnreadCount);
}
