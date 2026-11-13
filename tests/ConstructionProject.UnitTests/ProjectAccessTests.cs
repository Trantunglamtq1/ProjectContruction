using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Common.Security;
using ConstructionProject.Application.Features.Inspections.Queries;
using ConstructionProject.Domain.Constants;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ConstructionProject.UnitTests;

public sealed class ProjectAccessTests
{
    [Fact]
    public async Task ResourceResolutionUsesActualProject_AndRevocationIsFreshInSameService()
    {
        await using var db = NewContext();
        var user = new User { Username = "engineer", Email = "e@test.local", RoleId = RoleConstants.SubmitterRoleId };
        var a = new Project { Code = "A", Name = "A" }; var b = new Project { Code = "B", Name = "B" };
        var drawing = new DrawingFile { Project = a, ProjectId = a.Id };
        var foreign = new DrawingFile { Project = b, ProjectId = b.Id };
        var member = new ProjectMember { Project = a, User = user, ProjectId = a.Id, UserId = user.Id };
        db.Users.Add(user); db.Projects.AddRange(a,b); db.DrawingFiles.AddRange(drawing,foreign); db.ProjectMembers.Add(member);
        await db.SaveChangesAsync();
        var service = new ProjectAccessService(db, Actor(user.Id, RoleConstants.Submitter));
        Assert.Equal(a.Id, await service.DemandAsync(new(ProjectResourceKind.Drawing, drawing.Id)));
        await Assert.ThrowsAsync<ProjectAccessDeniedException>(() => service.DemandAsync(new(ProjectResourceKind.Drawing, foreign.Id)));
        db.ProjectMembers.Remove(member); await db.SaveChangesAsync();
        await Assert.ThrowsAsync<ProjectAccessDeniedException>(() => service.DemandAsync(new(ProjectResourceKind.Drawing, drawing.Id)));
        Assert.Empty(await service.AccessibleProjectIds.ToListAsync());
    }

    [Fact]
    public async Task StaleAdminClaimAndInactiveUser_DoNotBypassMembership()
    {
        await using var db = NewContext();
        var user = new User { Username = "old-admin", RoleId = RoleConstants.SubmitterRoleId };
        db.Users.Add(user); await db.SaveChangesAsync();
        var service = new ProjectAccessService(db, Actor(user.Id, RoleConstants.Admin));
        await Assert.ThrowsAsync<ProjectAccessDeniedException>(() => service.DemandAdminAsync());
        Assert.Empty(await service.AccessibleProjectIds.ToListAsync());
        user.RoleId = RoleConstants.AdminRoleId; await db.SaveChangesAsync();
        await service.DemandAdminAsync();
        user.IsActive = false; await db.SaveChangesAsync();
        await Assert.ThrowsAsync<ProjectAccessDeniedException>(() => service.DemandAdminAsync());
        Assert.Empty(await service.AccessibleProjectIds.ToListAsync());
    }

    [Fact]
    public async Task MissingResourceRemains404Semantics_NotAnAccessGrant()
    {
        await using var db = NewContext();
        var service = new ProjectAccessService(db, Actor(Guid.NewGuid(), RoleConstants.Submitter));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.DemandAsync(new(ProjectResourceKind.Inspection, Guid.NewGuid())));
    }

    [Fact]
    public void EveryResourceCqrsRequestHasAnExplicitAuthorizationClassification()
    {
        var requests = typeof(GetInspectionsQuery).Assembly.GetTypes()
            .Where(t => t.Namespace != null && new[] { ".Features.Drawings.", ".Features.Objects.", ".Features.Checklists.", ".Features.Inspections." }.Any(t.Namespace.Contains))
            .Where(t => t.GetInterfaces().Any(i => i.IsGenericType && i.GetGenericTypeDefinition() == typeof(IRequest<>))).ToArray();
        Assert.NotEmpty(requests);
        Assert.All(requests, t => Assert.True(ProjectRequestAuthorization.Supports(t), $"Unclassified resource request: {t.FullName}"));
        Assert.False(ProjectRequestAuthorization.Supports(typeof(ProjectAccessTests)));
    }

    private static ApplicationDbContext NewContext() => new(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static ICurrentUserService Actor(Guid id, string role)
    {
        var mock = new Mock<ICurrentUserService>();
        mock.SetupGet(x => x.UserId).Returns(id); mock.SetupGet(x => x.Role).Returns(role); mock.SetupGet(x => x.IsAuthenticated).Returns(true);
        return mock.Object;
    }
}
