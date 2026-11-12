using System.Net;
using System.Net.Sockets;
using System.Net.Http.Json;
using System.Text.Json;
using System.Diagnostics;
using ConstructionProject.Domain.Constants;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using ConstructionProject.Infrastructure.Services;
using Elsa.Workflows.Runtime.Contracts;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ConstructionProject.IntegrationTests;

public sealed class ChecklistWorkflowSqlFactAttribute : FactAttribute
{
    public ChecklistWorkflowSqlFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL")))
            Skip = "Cần cấu hình CONSTRUCTION_TEST_SQL để chạy SQL Server.";
    }
}

public class SqlChecklistWorkflowTests
{
    [ChecklistWorkflowSqlFact]
    public async Task Reconciler_RepeatedStartAndApprove_RecognizesCompletedElsaState()
    {
        await using var factory = new Factory(NewConnection());
        var id = await factory.InitializeAsync();
        using var scope = factory.Services.CreateScope();
        var reconciler = new ChecklistWorkflowReconciler(scope.ServiceProvider.GetRequiredService<IWorkflowRuntime>());
        var operation = new ChecklistWorkflowOperation { ChecklistId = id, InstanceId = Guid.NewGuid().ToString("N"), Action = "Start" };
        await reconciler.ReconcileAsync(operation);
        await reconciler.ReconcileAsync(operation);
        operation.Action = "Approve";
        await reconciler.ReconcileAsync(operation);
        await reconciler.ReconcileAsync(operation);
    }

    [ChecklistWorkflowSqlFact]
    public async Task SubmittedChecklist_SurvivesBackendProcessRestart()
    {
        var connection = NewConnection();
        Guid id;
        await using (var setup = new Factory(connection)) id = await setup.InitializeAsync();
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        using var client = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{port}") };
        using (var process = StartBackend(connection, port))
        {
            try
            {
                await WaitForBackend(client, process);
                await Login(client, "submitter");
                Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync($"/api/checklists/{id}/submit", new { })).StatusCode);
                await WaitForSync(client, id);
            }
            finally { await StopBackend(process); }
        }
        using (var process = StartBackend(connection, port))
        {
            try
            {
                await WaitForBackend(client, process);
                await Login(client, "reviewer");
                Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync($"/api/checklists/{id}/supervisor-approve", new { })).StatusCode);
                Assert.Equal("Approved", (await WaitForSync(client, id)).GetProperty("status").GetString());
            }
            finally { await StopBackend(process); }
        }
    }

    [ChecklistWorkflowSqlFact]
    public async Task MissingWorkflow_IsShownAsRetrying()
    {
        var connection = NewConnection();
        await using var factory = new Factory(connection);
        var id = await factory.InitializeAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;
        await using (var db = new ApplicationDbContext(options))
        {
            var checklist = await db.Checklists.SingleAsync(x => x.Id == id);
            checklist.Status = ConstructionProject.Domain.Enums.ChecklistStatus.PendingSupervisor;
            checklist.WorkflowInstanceId = null;
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await Login(client, "reviewer");
        Assert.Equal("NeedsRecovery", (await client.GetFromJsonAsync<JsonElement>($"/api/checklists/{id}")).GetProperty("workflowSyncStatus").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync($"/api/checklists/{id}/supervisor-approve", new { })).StatusCode);
        await using (var db = new ApplicationDbContext(options))
        {
            (await db.Checklists.SingleAsync(x => x.Id == id)).WorkflowInstanceId = "missing-instance";
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync($"/api/checklists/{id}/supervisor-approve", new { })).StatusCode);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        while (true)
        {
            var value = await client.GetFromJsonAsync<JsonElement>($"/api/checklists/{id}", timeout.Token);
            if (value.GetProperty("workflowSyncStatus").GetString() == "Retrying")
            {
                Assert.False(value.GetProperty("canFillInspection").GetBoolean());
                break;
            }
            await Task.Delay(250, timeout.Token);
        }
    }

    private static Process StartBackend(string connection, int port)
    {
        var info = new ProcessStartInfo("dotnet")
        {
            WorkingDirectory = AppContext.BaseDirectory, UseShellExecute = false,
            CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = true, RedirectStandardError = true
        };
        info.ArgumentList.Add(Path.Combine(AppContext.BaseDirectory, "ConstructionProject.API.dll"));
        info.Environment["ASPNETCORE_ENVIRONMENT"] = "Testing";
        info.Environment["Workflow__EnableInTests"] = "true";
        info.Environment["ConnectionStrings__DefaultConnection"] = connection;
        info.Environment["ASPNETCORE_URLS"] = $"http://127.0.0.1:{port}";
        var process = Process.Start(info) ?? throw new InvalidOperationException("Không thể khởi động backend kiểm thử.");
        process.OutputDataReceived += (_, _) => { };
        process.ErrorDataReceived += (_, _) => { };
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        return process;
    }

    private static async Task WaitForBackend(HttpClient client, Process process)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        while (true)
        {
            timeout.Token.ThrowIfCancellationRequested();
            if (process.HasExited) throw new InvalidOperationException($"Backend kiểm thử đã thoát với mã {process.ExitCode}.");
            try
            {
                using var response = await client.GetAsync("/api/auth/me", timeout.Token);
                if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.OK) return;
            }
            catch (HttpRequestException) { }
            await Task.Delay(250, timeout.Token);
        }
    }

    private static async Task StopBackend(Process process)
    {
        if (!process.HasExited) process.Kill(entireProcessTree: true);
        await process.WaitForExitAsync();
    }

    [ChecklistWorkflowSqlFact]
    public async Task LegacyPendingChecklist_QueuesRecovery_WithoutChangingHistory()
    {
        var connection = NewConnection();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection).Options;
        await using var db = new ApplicationDbContext(options);
        await db.GetService<IMigrator>().MigrateAsync("20261024083332_AddNotificationsTable");
        var drawingId = Guid.NewGuid();
        var objectId = Guid.NewGuid();
        var checklistId = Guid.NewGuid();
        var auditId = Guid.NewGuid();
        await db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO DrawingFiles (Id, FileName, StoredFileName, FileType, FileUrl, FileSizeBytes, UploadedBy, UploadedAt)
VALUES ({drawingId}, 'legacy.pdf', 'stored.pdf', 'pdf', '/legacy.pdf', {1L}, 'test', {DateTime.UtcNow});
INSERT INTO Objects (Id, DrawingFileId, PageNumber, MarkerCoordinates, Name, CreatedBy, CreatedAt)
VALUES ({objectId}, {drawingId}, {1}, '{{}}', 'C01', 'test', {DateTime.UtcNow});
INSERT INTO Checklists (Id, ObjectId, Name, Status, CreatedBy, CreatedAt, IsDeleted, WorkflowInstanceId)
VALUES ({checklistId}, {objectId}, 'Legacy', 'PendingSupervisor', 'test', {DateTime.UtcNow}, {false}, 'legacy-id');
INSERT INTO ChecklistAuditHistories (Id, ChecklistId, FromStatus, ToStatus, Action, CreatedAt)
VALUES ({auditId}, {checklistId}, 'Draft', 'PendingSupervisor', 'SubmitForApproval', {DateTime.UtcNow});");
        await db.Database.MigrateAsync();
        var operation = await db.ChecklistWorkflowOperations.SingleAsync(x => x.ChecklistId == checklistId);
        Assert.Equal("legacy-id", operation.PreviousInstanceId);
        Assert.Equal("Recover", operation.Action);
        Assert.Null((await db.Checklists.SingleAsync(x => x.Id == checklistId)).WorkflowInstanceId);
        Assert.Single(await db.ChecklistAuditHistories.Where(x => x.ChecklistId == checklistId).ToListAsync());

        await using var factory = new Factory(connection);
        using var client = factory.CreateClient();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(60));
        while (true)
        {
            timeout.Token.ThrowIfCancellationRequested();
            await using var check = new ApplicationDbContext(options);
            var current = await check.ChecklistWorkflowOperations.SingleAsync(x => x.ChecklistId == checklistId, timeout.Token);
            if (current.CompletedAt.HasValue)
            {
                Assert.Equal(current.InstanceId, (await check.Checklists.SingleAsync(x => x.Id == checklistId, timeout.Token)).WorkflowInstanceId);
                Assert.Single(await check.ChecklistAuditHistories.Where(x => x.ChecklistId == checklistId).ToListAsync(timeout.Token));
                break;
            }
            await Task.Delay(250, timeout.Token);
        }
    }

    [ChecklistWorkflowSqlFact]
    public async Task RejectEditResubmit_ThenConcurrentApproval_ProducesOneDecision()
    {
        await using var factory = new Factory(NewConnection());
        var id = await factory.InitializeAsync();
        using var client = factory.CreateClient();
        await Login(client, "submitter");
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync($"/api/checklists/{id}/submit", new { })).StatusCode);
        await WaitForSync(client, id);
        await Login(client, "reviewer");
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync($"/api/checklists/{id}/supervisor-reject", new { reason = "Cần sửa" })).StatusCode);
        Assert.Equal("Rejected", (await WaitForSync(client, id)).GetProperty("status").GetString());
        await Login(client, "submitter");
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync($"/api/checklists/{id}/items", new { name = "Tiêu chí bổ sung" })).StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync($"/api/checklists/{id}/submit", new { })).StatusCode);
        await WaitForSync(client, id);
        await Login(client, "reviewer");
        var decisions = await Task.WhenAll(
            client.PostAsJsonAsync($"/api/checklists/{id}/supervisor-approve", new { }),
            client.PostAsJsonAsync($"/api/checklists/{id}/supervisor-approve", new { }));
        Assert.Single(decisions, x => x.StatusCode == HttpStatusCode.Accepted);
        Assert.Single(decisions, x => !x.IsSuccessStatusCode);
        var final = await WaitForSync(client, id);
        Assert.Equal("Approved", final.GetProperty("status").GetString());
        Assert.Equal(1, final.GetProperty("auditHistories").EnumerateArray().Count(x => x.GetProperty("action").GetString() == "SupervisorApprove"));
    }

    private static string NewConnection() => new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
    {
        InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
    }.ConnectionString;
    [ChecklistWorkflowSqlFact]
    public async Task SubmittedChecklist_AfterHostRestart_CanBeApproved()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        Guid id;
        await using (var first = new Factory(connection))
        {
            id = await first.InitializeAsync();
            using var client = first.CreateClient();
            await Login(client, "submitter");
            var result = await client.PostAsJsonAsync($"/api/checklists/{id}/submit", new { });
            Assert.Equal(HttpStatusCode.Accepted, result.StatusCode);
            var response = await result.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal("Pending", response.GetProperty("workflowSyncStatus").GetString());
            Assert.False(response.TryGetProperty("workflowInstanceId", out _));
            await WaitForSync(client, id);
        }
        await using (var second = new Factory(connection))
        {
            using var client = second.CreateClient();
            await Login(client, "reviewer");
            var result = await client.PostAsJsonAsync($"/api/checklists/{id}/supervisor-approve", new { });
            Assert.Equal(HttpStatusCode.Accepted, result.StatusCode);
            var completed = await WaitForSync(client, id);
            Assert.Equal("Approved", completed.GetProperty("status").GetString());
            Assert.Equal(2, completed.GetProperty("auditHistories").GetArrayLength());
        }
    }

    private static async Task Login(HttpClient client, string username)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login", new { UsernameOrEmail = username, Password = "Test@12345" });
        login.EnsureSuccessStatusCode();
        ApiFactory.Authorize(client, (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString()!);
    }

    private static async Task<JsonElement> WaitForSync(HttpClient client, Guid id)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        while (true)
        {
            var value = await client.GetFromJsonAsync<JsonElement>($"/api/checklists/{id}", timeout.Token);
            var state = value.GetProperty("workflowSyncStatus").GetString();
            if (state == "Synchronized") return value;
            if (state != "Pending") throw new InvalidOperationException($"Không đồng bộ được: {state}");
            await Task.Delay(200, timeout.Token);
        }
    }

    private sealed class Factory(string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Workflow:EnableInTests", "true");
            builder.UseSetting("ConnectionStrings:DefaultConnection", connectionString);
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
                services.RemoveAll<ApplicationDbContext>();
                services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure()));
            });
        }

        public async Task<Guid> InitializeAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.MigrateAsync();
            var hasher = new PasswordHasher();
            var submitter = new User { Username = "submitter", Email = "submitter@test.local", FullName = "Submitter", PasswordHash = hasher.HashPassword("Test@12345"), RoleId = RoleConstants.SubmitterRoleId, IsActive = true, EmailConfirmed = true };
            var reviewer = new User { Username = "reviewer", Email = "reviewer@test.local", FullName = "Reviewer", PasswordHash = hasher.HashPassword("Test@12345"), RoleId = RoleConstants.ReviewerRoleId, IsActive = true, EmailConfirmed = true };
            var drawing = new DrawingFile { FileName = "test.pdf", StoredFileName = "test.pdf", FileType = "pdf", FileUrl = "/test.pdf", FileSizeBytes = 1, UploadedBy = "test" };
            var obj = new ConstructionObject { DrawingFile = drawing, MarkerCoordinates = "{}", Name = "C01", CreatedBy = "test" };
            var checklist = new Checklist { Object = obj, Name = "Kiểm tra", CreatedBy = "submitter", CreatedById = submitter.Id };
            db.Users.AddRange(submitter, reviewer);
            db.ChecklistItems.Add(new ChecklistItem { Checklist = checklist, Name = "Tiêu chí", IsRequired = true });
            await db.SaveChangesAsync();
            return checklist.Id;
        }
    }
}
