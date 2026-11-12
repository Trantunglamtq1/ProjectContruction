using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ConstructionProject.Domain.Constants;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using ConstructionProject.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ConstructionProject.IntegrationTests;

public sealed class ChecklistSqlFactAttribute : FactAttribute
{
    public ChecklistSqlFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL")))
            Skip = "Cần CONSTRUCTION_TEST_SQL để chạy kiểm thử SQL Server.";
    }
}

public class SqlServerChecklistConcurrencyTests
{
    [ChecklistSqlFact]
    public async Task ItemChangesOutsideChecklistHandlers_UpdateParentVersionAndSerializeWriters()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        await using var factory = new Factory(connection);
        var (checklistId, itemId) = await factory.InitializeAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;
        await using var first = new ApplicationDbContext(options);
        await using var second = new ApplicationDbContext(options);
        var firstItem = await first.ChecklistItems.SingleAsync(x => x.Id == itemId);
        var secondItem = await second.ChecklistItems.SingleAsync(x => x.Id == itemId);
        firstItem.Name = "Thay đổi thứ nhất";
        secondItem.Name = "Thay đổi thứ hai";
        await first.SaveChangesAsync();
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());
        await using var verify = new ApplicationDbContext(options);
        Assert.Equal(1, (await verify.Checklists.SingleAsync(x => x.Id == checklistId)).ItemsRevision);
        Assert.Equal("Thay đổi thứ nhất", (await verify.ChecklistItems.SingleAsync(x => x.Id == itemId)).Name);
        await using var sync = new ApplicationDbContext(options);
        (await sync.ChecklistItems.SingleAsync(x => x.Id == itemId)).Name = "Cập nhật đồng bộ";
        sync.SaveChanges();
        await using var explicitAsync = new ApplicationDbContext(options);
        (await explicitAsync.ChecklistItems.SingleAsync(x => x.Id == itemId)).Name = "Cập nhật bất đồng bộ";
        await explicitAsync.SaveChangesAsync(true);
        await using var final = new ApplicationDbContext(options);
        Assert.Equal(3, (await final.Checklists.SingleAsync(x => x.Id == checklistId)).ItemsRevision);
    }

    [ChecklistSqlFact]
    public async Task LegacyChecklistAndItems_SurviveRevisionMigration()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;
        await using var db = new ApplicationDbContext(options);
        await db.GetService<IMigrator>().MigrateAsync("20261024083332_AddNotificationsTable");
        var drawingId = Guid.NewGuid();
        var objectId = Guid.NewGuid();
        var checklistId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        await db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO DrawingFiles (Id, FileName, StoredFileName, FileType, FileUrl, FileSizeBytes, UploadedBy, UploadedAt)
VALUES ({drawingId}, 'legacy.pdf', 'stored.pdf', 'pdf', '/legacy.pdf', {1L}, 'test', {DateTime.UtcNow});
INSERT INTO Objects (Id, DrawingFileId, PageNumber, MarkerCoordinates, Name, CreatedBy, CreatedAt)
VALUES ({objectId}, {drawingId}, {1}, '{{}}', 'C01', 'test', {DateTime.UtcNow});
INSERT INTO Checklists (Id, ObjectId, Name, Status, CreatedBy, CreatedAt, IsDeleted)
VALUES ({checklistId}, {objectId}, 'Legacy', 'Draft', 'test', {DateTime.UtcNow}, {false});
INSERT INTO ChecklistItems (Id, ChecklistId, Name, IsRequired, Status, IsDeleted, FormSchemaJson, OrderIndex)
VALUES ({itemId}, {checklistId}, 'Old item', {true}, 'Pending', {false}, '{{}}', {1});");
        await db.Database.MigrateAsync();
        var result = await db.Checklists.Include(x => x.Items).SingleAsync(x => x.Id == checklistId);
        Assert.Equal(0, result.ItemsRevision);
        Assert.Equal("Old item", Assert.Single(result.Items).Name);
        Assert.Equal(8, result.RowVersion!.Length);
        Assert.Equal(8, Assert.Single(result.Items).RowVersion!.Length);
    }

    [ChecklistSqlFact]
    public async Task StaleChecklistAndItemUpdates_ReturnConflictWithoutOverwriting()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        await using var factory = new Factory(connection);
        var (checklistId, itemId) = await factory.InitializeAsync();
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { UsernameOrEmail = "submitter", Password = "Test@12345" });
        login.EnsureSuccessStatusCode();
        ApiFactory.Authorize(client, (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!);

        var before = await client.GetFromJsonAsync<JsonElement>($"/api/checklists/{checklistId}");
        var checklistVersion = before.GetProperty("rowVersion").GetString();
        var itemVersion = before.GetProperty("items")[0].GetProperty("rowVersion").GetString();
        Assert.False(string.IsNullOrWhiteSpace(checklistVersion));
        Assert.False(string.IsNullOrWhiteSpace(itemVersion));

        var url = $"/api/checklists/{checklistId}/items/{itemId}";
        var missing = await client.PutAsJsonAsync(url, new { name = "Thiếu phiên bản" });
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        var update = new { name = "Cập nhật đầu", orderIndex = 1, isRequired = true, checklistRowVersion = checklistVersion, rowVersion = itemVersion };
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync(url, update)).StatusCode);
        var stale = await client.PutAsJsonAsync(url, new { name = "Ghi đè", orderIndex = 1, isRequired = true, checklistRowVersion = checklistVersion, rowVersion = itemVersion });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var current = await client.GetFromJsonAsync<JsonElement>($"/api/checklists/{checklistId}");
        Assert.Equal("Cập nhật đầu", current.GetProperty("items")[0].GetProperty("name").GetString());
        Assert.NotEqual(checklistVersion, current.GetProperty("rowVersion").GetString());

        var staleSubmit = await client.PostAsJsonAsync($"/api/checklists/{checklistId}/submit", new { rowVersion = checklistVersion });
        Assert.Equal(HttpStatusCode.Conflict, staleSubmit.StatusCode);
        var staleAdd = await client.PostAsJsonAsync($"/api/checklists/{checklistId}/items", new { name = "Mới", checklistRowVersion = checklistVersion });
        Assert.Equal(HttpStatusCode.Conflict, staleAdd.StatusCode);
        using var deleteItem = new HttpRequestMessage(HttpMethod.Delete, url)
        {
            Content = JsonContent.Create(new { checklistRowVersion = checklistVersion, rowVersion = itemVersion })
        };
        Assert.Equal(HttpStatusCode.Conflict, (await client.SendAsync(deleteItem)).StatusCode);
        using var deleteChecklist = new HttpRequestMessage(HttpMethod.Delete, $"/api/checklists/{checklistId}")
        {
            Content = JsonContent.Create(new { rowVersion = checklistVersion })
        };
        Assert.Equal(HttpStatusCode.Conflict, (await client.SendAsync(deleteChecklist)).StatusCode);
        var wrongRoute = await client.PutAsJsonAsync($"/api/checklists/{Guid.NewGuid()}/items/{itemId}", new
        {
            name = "Sai checklist", orderIndex = 1, isRequired = true,
            checklistRowVersion = current.GetProperty("rowVersion").GetString(),
            rowVersion = current.GetProperty("items")[0].GetProperty("rowVersion").GetString()
        });
        Assert.Equal(HttpStatusCode.NotFound, wrongRoute.StatusCode);

        var latestChecklistVersion = current.GetProperty("rowVersion").GetString();
        var latestItemVersion = current.GetProperty("items")[0].GetProperty("rowVersion").GetString();
        var concurrent = await Task.WhenAll(
            client.PutAsJsonAsync(url, new { name = "Đồng thời A", orderIndex = 1, isRequired = true, checklistRowVersion = latestChecklistVersion, rowVersion = latestItemVersion }),
            client.PutAsJsonAsync(url, new { name = "Đồng thời B", orderIndex = 1, isRequired = true, checklistRowVersion = latestChecklistVersion, rowVersion = latestItemVersion }));
        Assert.Single(concurrent, result => result.StatusCode == HttpStatusCode.OK);
        Assert.Single(concurrent, result => result.StatusCode == HttpStatusCode.Conflict);
        var final = await client.GetFromJsonAsync<JsonElement>($"/api/checklists/{checklistId}");
        Assert.Equal(2, final.GetProperty("auditHistories").EnumerateArray().Count(x => x.GetProperty("action").GetString() == "UpdateItem"));

        var reviewerLogin = await client.PostAsJsonAsync("/api/auth/login", new { UsernameOrEmail = "reviewer", Password = "Test@12345" });
        reviewerLogin.EnsureSuccessStatusCode();
        ApiFactory.Authorize(client, (await reviewerLogin.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/checklists/{checklistId}/supervisor-approve", new { rowVersion = checklistVersion })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/checklists/{checklistId}/supervisor-reject", new { reason = "Cần sửa", rowVersion = checklistVersion })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync($"/api/checklists/{checklistId}/supervisor-modify", new { name = "Sai phiên bản", rowVersion = checklistVersion })).StatusCode);
    }

    [ChecklistSqlFact]
    public async Task ItemMutations_ReturnCommittedVersions_UsableWithoutReload()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        await using var factory = new Factory(connection);
        var (checklistId, _) = await factory.InitializeAsync();
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { UsernameOrEmail = "submitter", Password = "Test@12345" });
        login.EnsureSuccessStatusCode();
        ApiFactory.Authorize(client, (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!);

        var before = await client.GetFromJsonAsync<JsonElement>($"/api/checklists/{checklistId}");
        var originalVersion = before.GetProperty("rowVersion").GetString();
        var add = await client.PostAsJsonAsync($"/api/checklists/{checklistId}/items", new { name = "Thêm", checklistRowVersion = originalVersion });
        Assert.Equal(HttpStatusCode.Created, add.StatusCode);
        var added = await add.Content.ReadFromJsonAsync<JsonElement>();
        var addedVersion = added.GetProperty("checklistRowVersion").GetString();
        Assert.NotEqual(originalVersion, addedVersion);
        Assert.Equal(8, Convert.FromBase64String(addedVersion!).Length);
        var url = $"/api/checklists/{checklistId}/items/{added.GetProperty("id").GetGuid()}";

        var update = await client.PutAsJsonAsync(url, new
        {
            name = "Sửa", checklistRowVersion = addedVersion, rowVersion = added.GetProperty("rowVersion").GetString()
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await update.Content.ReadFromJsonAsync<JsonElement>();
        var updatedVersion = updated.GetProperty("checklistRowVersion").GetString();
        Assert.NotEqual(addedVersion, updatedVersion);
        Assert.NotEqual(added.GetProperty("rowVersion").GetString(), updated.GetProperty("rowVersion").GetString());
        using var delete = new HttpRequestMessage(HttpMethod.Delete, url)
        {
            Content = JsonContent.Create(new { checklistRowVersion = updatedVersion, rowVersion = updated.GetProperty("rowVersion").GetString() })
        };
        var deleted = await client.SendAsync(delete);
        Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);
        var result = await deleted.Content.ReadFromJsonAsync<JsonElement>();
        var deletedVersion = result.GetProperty("checklistRowVersion").GetString();
        Assert.NotEqual(updatedVersion, deletedVersion);
        var current = await client.GetFromJsonAsync<JsonElement>($"/api/checklists/{checklistId}");
        Assert.Equal(current.GetProperty("rowVersion").GetString(), deletedVersion);
        Assert.DoesNotContain(current.GetProperty("items").EnumerateArray(), x => x.GetProperty("id").GetGuid() == added.GetProperty("id").GetGuid());
        Assert.Equal(3, current.GetProperty("auditHistories").GetArrayLength());
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync($"/api/checklists/{checklistId}/items", new { name = "Sau xóa", checklistRowVersion = deletedVersion })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/checklists/{checklistId}/items", new { name = "Token cũ", checklistRowVersion = updatedVersion })).StatusCode);
    }

    [ChecklistSqlFact]
    public async Task PendingOperation_BlocksSoftDeleteAndItemChanges_KeepingWorkerParentVisible()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        await using var factory = new Factory(connection);
        var (checklistId, _) = await factory.InitializeAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;
        await using (var db = new ApplicationDbContext(options))
        {
            var checklist = await db.Checklists.SingleAsync(x => x.Id == checklistId);
            checklist.Status = ConstructionProject.Domain.Enums.ChecklistStatus.Rejected;
            db.ChecklistWorkflowOperations.Add(new ChecklistWorkflowOperation { ChecklistId = checklistId, InstanceId = "pending-reject", Action = "Reject" });
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { UsernameOrEmail = "submitter", Password = "Test@12345" });
        login.EnsureSuccessStatusCode();
        ApiFactory.Authorize(client, (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!);
        var before = await client.GetFromJsonAsync<JsonElement>($"/api/checklists/{checklistId}");
        var version = before.GetProperty("rowVersion").GetString();
        using var delete = new HttpRequestMessage(HttpMethod.Delete, $"/api/checklists/{checklistId}")
        {
            Content = JsonContent.Create(new { rowVersion = version })
        };
        var blockedDelete = await client.SendAsync(delete);
        Assert.Equal(HttpStatusCode.BadRequest, blockedDelete.StatusCode);
        Assert.Contains("đang đồng bộ", (await blockedDelete.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString());
        var blockedAdd = await client.PostAsJsonAsync($"/api/checklists/{checklistId}/items", new { name = "Bị khóa", checklistRowVersion = version });
        Assert.Equal(HttpStatusCode.BadRequest, blockedAdd.StatusCode);
        Assert.Contains("đang đồng bộ", (await blockedAdd.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("message").GetString());
        await using var verify = new ApplicationDbContext(options);
        var operation = await verify.ChecklistWorkflowOperations.Include(x => x.Checklist).SingleAsync(x => x.ChecklistId == checklistId);
        Assert.NotNull(operation.Checklist);
        Assert.False(operation.Checklist!.IsDeleted);
        Assert.Null(operation.CompletedAt);
        Assert.Empty(await verify.ChecklistAuditHistories.Where(x => x.ChecklistId == checklistId).ToListAsync());
        Assert.Single(await verify.ChecklistItems.Where(x => x.ChecklistId == checklistId).ToListAsync());
    }

    private sealed class Factory(string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
                services.RemoveAll<ApplicationDbContext>();
                services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString));
            });
        }

        public async Task<(Guid ChecklistId, Guid ItemId)> InitializeAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.MigrateAsync();
            var user = new User { Username = "submitter", Email = "submitter@test.local", FullName = "Submitter", PasswordHash = new PasswordHasher().HashPassword("Test@12345"), RoleId = RoleConstants.SubmitterRoleId, IsActive = true, EmailConfirmed = true };
            var drawing = new DrawingFile { FileName = "test.pdf", StoredFileName = "test.pdf", FileType = "pdf", FileUrl = "/test.pdf", FileSizeBytes = 1, UploadedBy = "test" };
            var obj = new ConstructionObject { DrawingFile = drawing, MarkerCoordinates = "{}", Name = "C01", CreatedBy = "test" };
            var checklist = new Checklist { Object = obj, Name = "Kiểm tra", CreatedBy = "test", CreatedById = user.Id };
            var item = new ChecklistItem { Checklist = checklist, Name = "Tiêu chí", IsRequired = true };
            db.Users.Add(user);
            db.Users.Add(new User { Username = "reviewer", Email = "reviewer@test.local", FullName = "Reviewer", PasswordHash = new PasswordHasher().HashPassword("Test@12345"), RoleId = RoleConstants.ReviewerRoleId, IsActive = true, EmailConfirmed = true });
            db.ChecklistItems.Add(item);
            await db.SaveChangesAsync();
            return (checklist.Id, item.Id);
        }
    }
}
