using ConstructionProject.Application.Features.Drawings.Queries;
using ConstructionProject.Application.Features.Inspections.Queries;
using ConstructionProject.Domain.Constants;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Features.Projects;

namespace ConstructionProject.IntegrationTests;

public class ProjectSqlScopeTests
{
    [SqlServerFact]
    public async Task MembershipFiltersCountsPagesAndDuplicateNamesInSql_AndRevocationIsImmediate()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
            { InitialCatalog = $"ConstructionProject_Test_ProjectScope_{Guid.NewGuid():N}", TrustServerCertificate = true };
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection.ConnectionString).Options);
        await db.Database.MigrateAsync();
        await InspectionListTestData.SeedAsync(db);
        var b = new Project { Code = "B", Name = "B" };
        var user = new User { Username = "scope", Email = "scope@test.local", RoleId = RoleConstants.SubmitterRoleId };
        var foreign = new DrawingFile { Project = b, ProjectId = b.Id, FileName = "reliability.pdf", StoredFileName = "private.pdf", UploadedAt = DateTime.UtcNow.AddDays(1) };
        var obj = new ConstructionObject { DrawingFile = foreign, Name = "secret" };
        db.Users.Add(user); db.FormInspections.Add(new FormInspection { Object = obj });
        db.ProjectMembers.Add(new ProjectMember { ProjectId = Project.LegacyId, UserId = user.Id }); await db.SaveChangesAsync();
        var access = ProjectTestAccess.ForSubmitter(db,user.Id);
        var handler = new GetInspectionsQueryHandler(db,access);
        var page = await handler.Handle(new GetInspectionsQuery(PageSize: 1),default);
        Assert.Equal(14,page.TotalCount); Assert.Equal(14,page.StatusCounts.Values.Sum()); Assert.Single(page.Items);
        var name = await new GetDrawingFileByNameQueryHandler(db,access).Handle(new("reliability.pdf"),default);
        Assert.NotNull(name); Assert.NotEqual(foreign.Id,name.Id);
        await using var cache = new ConstructionProject.Infrastructure.Caching.RedisDrawingListCache(
            Microsoft.Extensions.Options.Options.Create(new ConstructionProject.Infrastructure.Caching.RedisCacheOptions()),
            Microsoft.Extensions.Logging.Abstractions.NullLogger<ConstructionProject.Infrastructure.Caching.RedisDrawingListCache>.Instance);
        Assert.Single(await new GetDrawingFilesQueryHandler(db,access,cache).Handle(new(),default));
        var projects = new ProjectHandlers(db,ProjectTestAccess.ForAdmin(db),ProjectTestAccess.AdminIdentity(),new NoEvents());
        Assert.Single(await projects.Handle(new GetProjectMembersQuery(Project.LegacyId),default));
        var assigned = await projects.Handle(new AssignProjectMemberCommand(Project.LegacyId,user.Id),default); Assert.Equal(user.Id,assigned.UserId);
        await projects.Handle(new RevokeProjectMemberCommand(Project.LegacyId,user.Id),default);
        var revoked = await handler.Handle(new(),default);
        Assert.Empty(revoked.Items); Assert.Equal(0,revoked.TotalCount); Assert.Equal(0,revoked.StatusCounts.Values.Sum());
    }
    private class NoEvents : IProjectAccessEvents
    {
        public Task MembershipChangedAsync(Guid userId,Guid projectId,CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
