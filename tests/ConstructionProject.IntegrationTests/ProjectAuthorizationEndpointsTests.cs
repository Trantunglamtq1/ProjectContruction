using System.Net;
using System.Net.Http.Json;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using ConstructionProject.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ConstructionProject.IntegrationTests;

public sealed class ProjectAuthorizationEndpointsTests
{
    [Theory]
    [InlineData("submitter")]
    [InlineData("reviewer")]
    [InlineData("approver")]
    public async Task ResourceIdsAndExplicitQueryFiltersCannotCrossProjects(string role)
    {
        await using var fixture = new ProjectAuthorizationFixture();
        using var client = await fixture.LoginAsync(role);
        Assert.Equal(HttpStatusCode.OK,(await client.GetAsync("/api/auth/me")).StatusCode);
        var f = fixture.Foreign;
        var paths = new[]
        {
            $"drawings/{f.DrawingId}", $"drawings?projectId={fixture.ProjectB.Id}",
            $"objects/{f.ObjectId}", $"objects?drawingFileId={f.DrawingId}",
            $"checklists/{f.ChecklistId}", $"checklists?objectId={f.ObjectId}", $"checklists/object/{f.ObjectId}/summary",
            $"inspections/{f.InspectionId}", $"inspections/{f.InspectionId}/history", $"inspections?drawingFileId={f.DrawingId}",
            $"inspections?objectId={f.ObjectId}", $"inspections?checklistId={f.ChecklistId}", $"inspections?checklistItemId={f.ItemId}",
            $"inspections/schema/{f.ItemId}"
        };
        foreach (var path in paths)
        {
            using var response = await client.GetAsync("/api/" + path);
            Assert.True(response.StatusCode == HttpStatusCode.Forbidden, $"{role} GET {path}: {response.StatusCode}");
        }
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/drawings/{fixture.Allowed.DrawingId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await client.GetAsync("/api/inspections/schema/%2e%2e%5cappsettings")).StatusCode);
        var projects = await client.GetFromJsonAsync<ProjectListDto[]>("/api/projects");
        Assert.DoesNotContain(projects!, p => p.Id == fixture.ProjectB.Id);
    }

    [Fact]
    public async Task MembershipRevocationUsesTheSameJwt_AndReassignmentRestoresAccess()
    {
        await using var fixture = new ProjectAuthorizationFixture();
        using var actor = await fixture.LoginAsync("submitter");
        using var admin = await fixture.LoginAsync("admin");
        var path = $"/api/projects/{fixture.ProjectA.Id}/members/{fixture.SubmitterId}";
        Assert.Equal(HttpStatusCode.OK, (await actor.GetAsync($"/api/drawings/{fixture.Allowed.DrawingId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await actor.GetAsync($"/api/drawings/{fixture.Allowed.DrawingId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await actor.GetAsync($"/api/checklists/{fixture.Allowed.ChecklistId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync(path)).StatusCode);
        Assert.True((await admin.PutAsJsonAsync(path,new {})).IsSuccessStatusCode);
        Assert.True((await admin.PutAsJsonAsync(path,new {})).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.OK, (await actor.GetAsync($"/api/drawings/{fixture.Allowed.DrawingId}")).StatusCode);
    }

    private sealed record ProjectListDto(Guid Id);

    [Theory]
    [InlineData("submitter")]
    [InlineData("reviewer")]
    [InlineData("approver")]
    public async Task ForeignWriteIdsAreDeniedBeforeWorkflowOrPersistence(string role)
    {
        await using var fixture = new ProjectAuthorizationFixture();
        using var actor = await fixture.LoginAsync(role);
        var f = fixture.Foreign;
        var payload = new { name = "test", description = "test", orderIndex = 1, isRequired = true, formDataJson = "{}", rowVersion = "AQ==", reason = "test", items = Array.Empty<object>(),
            drawingFileId = f.DrawingId, objectId = f.ObjectId, checklistId = f.ChecklistId, checklistItemId = f.ItemId, inspectionId = f.InspectionId, pageNumber = 1, markerCoordinates = "[]" };
        var actions = role switch
        {
            "submitter" => new[] { ("POST","objects"), ("DELETE",$"objects/{f.ObjectId}"), ("DELETE",$"drawings/{f.DrawingId}"), ("POST","checklists"),
                ("POST",$"checklists/{f.ChecklistId}/submit"), ("DELETE",$"checklists/{f.ChecklistId}"), ("POST",$"checklists/{f.ChecklistId}/items"),
                ("PUT",$"checklists/{f.ChecklistId}/items/{f.ItemId}"), ("DELETE",$"checklists/{f.ChecklistId}/items/{f.ItemId}"),
                ("POST",$"checklists/{f.ChecklistId}/items/{f.ItemId}/link-inspection"), ("POST","inspections"), ("PUT",$"inspections/{f.InspectionId}"),
                ("POST",$"inspections/{f.InspectionId}/submit"), ("DELETE",$"inspections/{f.InspectionId}") },
            "reviewer" => new[] { ("POST",$"checklists/{f.ChecklistId}/supervisor-approve"), ("POST",$"checklists/{f.ChecklistId}/supervisor-reject"),
                ("PUT",$"checklists/{f.ChecklistId}/supervisor-modify"), ("POST",$"checklists/{f.ChecklistId}/items"),
                ("PUT",$"checklists/{f.ChecklistId}/items/{f.ItemId}"), ("DELETE",$"checklists/{f.ChecklistId}/items/{f.ItemId}"),
                ("POST",$"checklists/{f.ChecklistId}/items/{f.ItemId}/link-inspection"), ("POST",$"inspections/{f.InspectionId}/receive"),
                ("POST",$"inspections/{f.InspectionId}/review"), ("POST",$"inspections/{f.InspectionId}/review-pass"), ("POST",$"inspections/{f.InspectionId}/reject") },
            _ => new[] { ("POST",$"inspections/{f.InspectionId}/approve"), ("POST",$"inspections/{f.InspectionId}/reject") }
        };
        foreach (var (method,path) in actions)
        {
            using var request = new HttpRequestMessage(new HttpMethod(method),"/api/" + path) { Content = JsonContent.Create(payload) };
            using var response = await actor.SendAsync(request);
            Assert.True(response.StatusCode == HttpStatusCode.Forbidden,$"{role} {method} {path}: {response.StatusCode} {await response.Content.ReadAsStringAsync()}");
        }
        using var scope = fixture.Factory.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Assert.Equal(InspectionStatus.Draft,(await db.FormInspections.SingleAsync(i => i.Id == f.InspectionId)).Status);
        Assert.Empty(await db.InspectionWorkflowOperations.ToListAsync());
        Assert.Empty(await db.ChecklistWorkflowOperations.ToListAsync());
    }

    [Fact]
    public async Task AdminManagementRequiresCurrentRole_AndNoMembershipReturnsEmptyCollections()
    {
        await using var fixture = new ProjectAuthorizationFixture();
        using var actor = await fixture.LoginAsync("submitter"); using var admin = await fixture.LoginAsync("admin");
        Assert.Equal(HttpStatusCode.Forbidden,(await actor.PostAsJsonAsync("/api/projects",new { code = "new", name = "New" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await actor.GetAsync($"/api/projects/{fixture.ProjectA.Id}/members")).StatusCode);
        var created = await admin.PostAsJsonAsync("/api/projects",new { code = " new ", name = " New " });
        Assert.Equal(HttpStatusCode.Created,created.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await admin.PutAsJsonAsync($"/api/projects/{fixture.ProjectA.Id}/members/{ConstructionProject.Domain.Constants.RoleConstants.DefaultAdminUserId}",new {})).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await admin.PutAsJsonAsync($"/api/projects/{fixture.ProjectA.Id}/members/{Guid.NewGuid()}",new {})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await admin.PostAsJsonAsync("/api/projects",new { code = "NEW", name = "Duplicate" })).StatusCode);
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.ProjectMembers.RemoveRange(db.ProjectMembers.Where(m => m.UserId == fixture.SubmitterId));
            var user = await db.Users.SingleAsync(u => u.Username == "admin"); user.RoleId = ConstructionProject.Domain.Constants.RoleConstants.SubmitterRoleId;
            await db.SaveChangesAsync();
        }
        Assert.Empty((await actor.GetFromJsonAsync<ProjectListDto[]>("/api/projects"))!);
        Assert.Empty((await actor.GetFromJsonAsync<ProjectListDto[]>("/api/drawings"))!);
        Assert.Equal(HttpStatusCode.Forbidden,(await admin.GetAsync($"/api/projects/{fixture.ProjectA.Id}/members")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await admin.PostAsJsonAsync("/api/projects",new { code = "denied", name = "Denied" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await admin.PutAsJsonAsync($"/api/users/{ConstructionProject.Domain.Constants.RoleConstants.DefaultAdminUserId}/role",new { roleId = ConstructionProject.Domain.Constants.RoleConstants.AdminRoleId })).StatusCode);
    }

    [Fact]
    public async Task DualMembershipDoesNotAllowCrossProjectBodyOrNestedParentLinks()
    {
        await using var fixture = new ProjectAuthorizationFixture(); using var admin = await fixture.LoginAsync("admin");
        await admin.PutAsJsonAsync($"/api/projects/{fixture.ProjectB.Id}/members/{fixture.SubmitterId}",new {});
        using var actor = await fixture.LoginAsync("submitter"); var a = fixture.Allowed; var b = fixture.Foreign;
        Assert.Equal(HttpStatusCode.BadRequest,(await actor.PostAsJsonAsync("/api/inspections",new { checklistId = a.ChecklistId, checklistItemId = a.ItemId, objectId = b.ObjectId, formDataJson = "{}" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await actor.PostAsJsonAsync($"/api/checklists/{a.ChecklistId}/items/{a.ItemId}/link-inspection",new { inspectionId = b.InspectionId, rowVersion = "AQ==" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await actor.PutAsJsonAsync($"/api/checklists/{a.ChecklistId}/items/{b.ItemId}",new { name = "test", orderIndex = 1, rowVersion = "AQ==" })).StatusCode);
    }
}

internal sealed class ProjectAuthorizationFixture : IAsyncDisposable
{
    public ApiFactory Factory { get; }
    public Project ProjectA { get; } = new() { Code = "A", Name = "Project A" };
    public Project ProjectB { get; } = new() { Code = "B", Name = "Project B" };
    public ProjectGraph Allowed { get; }
    public ProjectGraph Foreign { get; }
    public Guid SubmitterId { get; }

    public ProjectAuthorizationFixture(Action<IServiceCollection>? configure = null)
    {
        Factory = new ApiFactory(configure);
        Factory.InitializeDatabase();
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Projects.AddRange(ProjectA,ProjectB);
        var users = db.Users.Where(u => u.Username == "submitter" || u.Username == "reviewer" || u.Username == "approver").ToList();
        SubmitterId = users.Single(u => u.Username == "submitter").Id;
        foreach (var user in users) db.ProjectMembers.Add(new ProjectMember { ProjectId = ProjectA.Id, UserId = user.Id });
        Allowed = SeedGraph(db, ProjectA.Id, SubmitterId, "allowed");
        Foreign = SeedGraph(db, ProjectB.Id, SubmitterId, "foreign");
        db.SaveChanges();
    }

    public async Task<HttpClient> LoginAsync(string role)
    {
        var client = Factory.CreateClient();
        ApiFactory.Authorize(client, await Factory.LoginAsync(client, role, role == "admin" ? "Admin@123" : ApiFactory.Password));
        return client;
    }

    private static ProjectGraph SeedGraph(ApplicationDbContext db, Guid project, Guid actor, string name)
    {
        var drawing = new DrawingFile { ProjectId = project, FileName = name + ".pdf", StoredFileName = name + ".pdf" };
        var obj = new ConstructionObject { DrawingFile = drawing, DrawingFileId = drawing.Id, Name = name };
        var checklist = new Checklist { Object = obj, ObjectId = obj.Id, Name = name, Status = ChecklistStatus.Approved, CreatedById = actor, RowVersion = [1] };
        var item = new ChecklistItem { Checklist = checklist, ChecklistId = checklist.Id, Name = name, OrderIndex = 1, RowVersion = [1] };
        var inspection = new FormInspection { Object = obj, ObjectId = obj.Id, Checklist = checklist, ChecklistId = checklist.Id, ChecklistItem = item, ChecklistItemId = item.Id, SubmittedById = actor, RowVersion = [1] };
        item.LinkedInspectionId = inspection.Id;
        db.DrawingFiles.Add(drawing); db.Objects.Add(obj); db.Checklists.Add(checklist); db.ChecklistItems.Add(item); db.FormInspections.Add(inspection);
        return new(drawing.Id,obj.Id,checklist.Id,item.Id,inspection.Id);
    }
    public ValueTask DisposeAsync() => Factory.DisposeAsync();
}

internal sealed record ProjectGraph(Guid DrawingId, Guid ObjectId, Guid ChecklistId, Guid ItemId, Guid InspectionId);
