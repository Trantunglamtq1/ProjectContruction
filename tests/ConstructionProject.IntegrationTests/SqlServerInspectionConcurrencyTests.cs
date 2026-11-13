using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Diagnostics;
using System.Net.Sockets;
using ConstructionProject.Domain.Constants;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using ConstructionProject.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ConstructionProject.IntegrationTests;

public class SqlServerInspectionConcurrencyTests
{
    [SqlServerFact]
    public async Task StaleDraftUpdate_ReturnsConflict_AndPreservesFirstChange()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}",
            TrustServerCertificate = true
        };
        await using var factory = new SqlApiFactory(connection.ConnectionString);
        var inspectionId = await factory.InitializeAsync();
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { UsernameOrEmail = "submitter", Password = "Test@12345" });
        login.EnsureSuccessStatusCode();
        var loginJson = await login.Content.ReadFromJsonAsync<JsonElement>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", loginJson.GetProperty("token").GetString());

        var original = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{inspectionId}");
        var version = original.GetProperty("rowVersion").GetString();
        Assert.False(string.IsNullOrWhiteSpace(version));
        var missing = await client.PutAsJsonAsync($"/api/inspections/{inspectionId}", new { formDataJson = "{\"value\":0}" });
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        var first = await client.PutAsJsonAsync($"/api/inspections/{inspectionId}", new { formDataJson = "{\"value\":1}", rowVersion = version });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var stale = await client.PutAsJsonAsync($"/api/inspections/{inspectionId}", new { formDataJson = "{\"value\":2}", rowVersion = version });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        var staleSubmit = await client.PostAsJsonAsync($"/api/inspections/{inspectionId}/submit", new { formDataJson = "{\"value\":1}", rowVersion = version });
        Assert.Equal(HttpStatusCode.Conflict, staleSubmit.StatusCode);
        using var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, $"/api/inspections/{inspectionId}") { Content = JsonContent.Create(new { rowVersion = version }) };
        var staleDelete = await client.SendAsync(deleteRequest);
        Assert.Equal(HttpStatusCode.Conflict, staleDelete.StatusCode);
        var final = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{inspectionId}");
        Assert.Equal("{\"value\":1}", final.GetProperty("formDataJson").GetString());
        var latestVersion = final.GetProperty("rowVersion").GetString();
        var simultaneous = await Task.WhenAll(
            client.PutAsJsonAsync($"/api/inspections/{inspectionId}", new { formDataJson = "{\"value\":3}", rowVersion = latestVersion }),
            client.PutAsJsonAsync($"/api/inspections/{inspectionId}", new { formDataJson = "{\"value\":4}", rowVersion = latestVersion }));
        Assert.Single(simultaneous, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(simultaneous, response => response.StatusCode == HttpStatusCode.Conflict);

        var snapshot = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{inspectionId}");
        var staleActionVersion = snapshot.GetProperty("rowVersion").GetString();
        await factory.TouchAsync(inspectionId);
        var reviewerLogin = await client.PostAsJsonAsync("/api/auth/login", new { UsernameOrEmail = "reviewer", Password = "Test@12345" });
        reviewerLogin.EnsureSuccessStatusCode();
        var reviewerToken = (await reviewerLogin.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", reviewerToken);
        foreach (var action in new[] { "receive", "review" })
        {
            var response = await client.PostAsJsonAsync($"/api/inspections/{inspectionId}/{action}", new { rowVersion = staleActionVersion });
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        }
        var rejected = await client.PostAsJsonAsync($"/api/inspections/{inspectionId}/reject", new { rowVersion = staleActionVersion, reason = "Cần sửa hồ sơ" });
        Assert.Equal(HttpStatusCode.Conflict, rejected.StatusCode);
        var approverLogin = await client.PostAsJsonAsync("/api/auth/login", new { UsernameOrEmail = "approver", Password = "Test@12345" });
        approverLogin.EnsureSuccessStatusCode();
        var approverToken = (await approverLogin.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", approverToken);
        var approved = await client.PostAsJsonAsync($"/api/inspections/{inspectionId}/approve", new { rowVersion = staleActionVersion });
        Assert.Equal(HttpStatusCode.Conflict, approved.StatusCode);
    }

    [SqlServerFact]
    public async Task Inspection_TwoStageApproval_RequiresReceiveAndReview()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
        };
        await using var factory = new SqlApiFactory(connection.ConnectionString);
        var id = await factory.InitializeAsync();
        using var client = factory.CreateClient();
        async Task Login(string username)
        {
            var login = await client.PostAsJsonAsync("/api/auth/login", new { UsernameOrEmail = username, Password = "Test@12345" });
            login.EnsureSuccessStatusCode();
            var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        await Login("submitter");
        var draft = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{id}");
        var submittedResponse = await client.PostAsJsonAsync($"/api/inspections/{id}/submit", new { formDataJson = "{\"value\":1}", rowVersion = draft.GetProperty("rowVersion").GetString() });
        Assert.Equal(HttpStatusCode.Accepted, submittedResponse.StatusCode);
        var submitted = await WaitForSync(client, id);
        Assert.Equal("Submitted", submitted.GetProperty("status").GetString());
        await Login("reviewer");
        var skip = await client.PostAsJsonAsync($"/api/inspections/{id}/review", new { rowVersion = submitted.GetProperty("rowVersion").GetString() });
        Assert.Equal(HttpStatusCode.BadRequest, skip.StatusCode);
        var receivedResponse = await client.PostAsJsonAsync($"/api/inspections/{id}/receive", new { rowVersion = submitted.GetProperty("rowVersion").GetString() });
        Assert.Equal(HttpStatusCode.OK, receivedResponse.StatusCode);
        var received = await receivedResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("UnderReview", received.GetProperty("status").GetString());
        await Login("approver");
        var skipApproval = await client.PostAsJsonAsync($"/api/inspections/{id}/approve", new { rowVersion = received.GetProperty("rowVersion").GetString() });
        Assert.Equal(HttpStatusCode.BadRequest, skipApproval.StatusCode);
        await Login("reviewer");
        var reviewedResponse = await client.PostAsJsonAsync($"/api/inspections/{id}/review", new { rowVersion = received.GetProperty("rowVersion").GetString() });
        Assert.Equal(HttpStatusCode.Accepted, reviewedResponse.StatusCode);
        var reviewed = await WaitForSync(client, id);
        Assert.Equal("Reviewed", reviewed.GetProperty("status").GetString());
        await Login("approver");
        var reviewVersion = reviewed.GetProperty("rowVersion").GetString();
        var approvals = await Task.WhenAll(
            client.PostAsJsonAsync($"/api/inspections/{id}/approve", new { rowVersion = reviewVersion }),
            client.PostAsJsonAsync($"/api/inspections/{id}/approve", new { rowVersion = reviewVersion }));
        Assert.Single(approvals, response => response.StatusCode == HttpStatusCode.Accepted);
        Assert.Single(approvals, response => response.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal("Approved", (await WaitForSync(client, id)).GetProperty("status").GetString());
        var history = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{id}/history");
        Assert.Equal(4, history.GetArrayLength());
    }
    [SqlServerFact]
    public async Task CreateAndSubmitImmediately_QueuesWorkflowAndSynchronizes()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        await using var factory = new SqlApiFactory(connection);
        var existingId = await factory.InitializeAsync();
        var (checklistId, itemId) = await factory.CreateChecklistAsync(existingId);
        using var client = factory.CreateClient();
        await LoginAsync(client, "submitter");
        var response = await client.PostAsJsonAsync("/api/inspections", new { checklistId, checklistItemId = itemId, formDataJson = "{\"value\":1}", submitImmediately = true });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Pending", created.GetProperty("workflowSyncStatus").GetString());
        Assert.False(created.TryGetProperty("workflowInstanceId", out _));
        var id = created.GetProperty("id").GetGuid();
        var synchronized = await WaitForSync(client, id);
        Assert.Equal("Submitted", synchronized.GetProperty("status").GetString());
        Assert.False(string.IsNullOrWhiteSpace(synchronized.GetProperty("workflowInstanceId").GetString()));
        var checklist = await client.GetFromJsonAsync<JsonElement>($"/api/checklists/{checklistId}");
        var item = checklist.GetProperty("items").EnumerateArray().Single(x => x.GetProperty("id").GetGuid() == itemId);
        Assert.Equal("Synchronized", item.GetProperty("linkedInspectionWorkflowSyncStatus").GetString());
        Assert.False(string.IsNullOrWhiteSpace(item.GetProperty("linkedInspectionRowVersion").GetString()));
    }

    [SqlServerFact]
    public async Task SubmittedInspection_AfterHostRestart_CanRejectResubmitAndApprove()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        Guid id;
        await using (var first = new SqlApiFactory(connection))
        {
            id = await first.InitializeAsync();
            using var client = first.CreateClient();
            await LoginAsync(client, "submitter");
            var draft = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{id}");
            var submitted = await client.PostAsJsonAsync($"/api/inspections/{id}/submit", new { formDataJson = "{\"value\":1}", rowVersion = draft.GetProperty("rowVersion").GetString() });
            Assert.Equal(HttpStatusCode.Accepted, submitted.StatusCode);
            await WaitForSync(client, id);
        }

        await using (var second = new SqlApiFactory(connection))
        {
            using var client = second.CreateClient();
            await LoginAsync(client, "reviewer");
            var submitted = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{id}");
            var receive = await client.PostAsJsonAsync($"/api/inspections/{id}/receive", new { rowVersion = submitted.GetProperty("rowVersion").GetString() });
            Assert.Equal(HttpStatusCode.OK, receive.StatusCode);
            var received = await receive.Content.ReadFromJsonAsync<JsonElement>();
            var reject = await client.PostAsJsonAsync($"/api/inspections/{id}/reject", new { rowVersion = received.GetProperty("rowVersion").GetString(), reason = "Cần bổ sung ảnh" });
            Assert.Equal(HttpStatusCode.Accepted, reject.StatusCode);
            var rejected = await WaitForSync(client, id);
            Assert.Equal("Rejected", rejected.GetProperty("status").GetString());
            await LoginAsync(client, "submitter");
            var edit = await client.PutAsJsonAsync($"/api/inspections/{id}", new { formDataJson = "{\"value\":2}", rowVersion = rejected.GetProperty("rowVersion").GetString() });
            Assert.Equal(HttpStatusCode.OK, edit.StatusCode);
            var edited = await edit.Content.ReadFromJsonAsync<JsonElement>();
            var resubmit = await client.PostAsJsonAsync($"/api/inspections/{id}/submit", new { rowVersion = edited.GetProperty("rowVersion").GetString(), formDataJson = "{\"value\":2}" });
            Assert.Equal(HttpStatusCode.Accepted, resubmit.StatusCode);
            var resubmitted = await WaitForSync(client, id);
            await LoginAsync(client, "reviewer");
            receive = await client.PostAsJsonAsync($"/api/inspections/{id}/receive", new { rowVersion = resubmitted.GetProperty("rowVersion").GetString() });
            Assert.Equal(HttpStatusCode.OK, receive.StatusCode);
            received = await receive.Content.ReadFromJsonAsync<JsonElement>();
            var review = await client.PostAsJsonAsync($"/api/inspections/{id}/review", new { rowVersion = received.GetProperty("rowVersion").GetString() });
            Assert.Equal(HttpStatusCode.Accepted, review.StatusCode);
            var reviewed = await WaitForSync(client, id);
            await LoginAsync(client, "approver");
            var approve = await client.PostAsJsonAsync($"/api/inspections/{id}/approve", new { rowVersion = reviewed.GetProperty("rowVersion").GetString() });
            Assert.Equal(HttpStatusCode.Accepted, approve.StatusCode);
            var approved = await WaitForSync(client, id);
            Assert.Equal("Approved", approved.GetProperty("status").GetString());
            var history = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{id}/history");
            Assert.Equal(7, history.GetArrayLength());
            Assert.Contains(history.EnumerateArray(), x => x.GetProperty("action").GetString() == "Resubmit");
        }
    }

    [SqlServerFact]
    public async Task SubmittedInspection_SurvivesBackendProcessRestart()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
        }.ConnectionString;
        Guid id;
        await using (var setup = new SqlApiFactory(connection)) id = await setup.InitializeAsync();
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
                await LoginAsync(client, "submitter");
                var draft = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{id}");
                var submit = await client.PostAsJsonAsync($"/api/inspections/{id}/submit", new { formDataJson = "{\"value\":1}", rowVersion = draft.GetProperty("rowVersion").GetString() });
                Assert.Equal(HttpStatusCode.Accepted, submit.StatusCode);
                await WaitForSync(client, id);
            }
            finally { await StopBackend(process); }
        }
        using (var process = StartBackend(connection, port))
        {
            try
            {
                await WaitForBackend(client, process);
                await LoginAsync(client, "reviewer");
                var submitted = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{id}");
                var receive = await client.PostAsJsonAsync($"/api/inspections/{id}/receive", new { rowVersion = submitted.GetProperty("rowVersion").GetString() });
                Assert.Equal(HttpStatusCode.OK, receive.StatusCode);
                var received = await receive.Content.ReadFromJsonAsync<JsonElement>();
                var review = await client.PostAsJsonAsync($"/api/inspections/{id}/review", new { rowVersion = received.GetProperty("rowVersion").GetString() });
                Assert.Equal(HttpStatusCode.Accepted, review.StatusCode);
                var reviewed = await WaitForSync(client, id);
                await LoginAsync(client, "approver");
                var approve = await client.PostAsJsonAsync($"/api/inspections/{id}/approve", new { rowVersion = reviewed.GetProperty("rowVersion").GetString() });
                Assert.Equal(HttpStatusCode.Accepted, approve.StatusCode);
                Assert.Equal("Approved", (await WaitForSync(client, id)).GetProperty("status").GetString());
            }
            finally { await StopBackend(process); }
        }
    }

    private static Process StartBackend(string connection, int port)
    {
        var info = new ProcessStartInfo("dotnet")
        {
            WorkingDirectory = AppContext.BaseDirectory,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        info.ArgumentList.Add(Path.Combine(AppContext.BaseDirectory, "ConstructionProject.API.dll"));
        info.Environment["ASPNETCORE_ENVIRONMENT"] = "Testing";
        info.Environment["Workflow__EnableInTests"] = "true";
        info.Environment["ConnectionStrings__DefaultConnection"] = connection;
        info.Environment["ASPNETCORE_URLS"] = $"http://127.0.0.1:{port}";
        var process = Process.Start(info) ?? throw new InvalidOperationException("Không thể khởi động backend kiểm thử.");
        var logLock = new object();
        void Log(object sender, DataReceivedEventArgs args) { if (args.Data != null) lock (logLock) File.AppendAllText(Path.Combine(AppContext.BaseDirectory,$"backend-{process.Id}.log"),args.Data + Environment.NewLine); }
        process.OutputDataReceived += Log;
        process.ErrorDataReceived += Log;
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

    private static async Task LoginAsync(HttpClient client, string username)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { UsernameOrEmail = username, Password = "Test@12345" });
        response.EnsureSuccessStatusCode();
        var token = (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    [SqlServerFact]
    public async Task MissingWorkflow_IsReportedAsRetrying_AndDoesNotPretendSynchronizationSucceeded()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}", TrustServerCertificate = true
        };
        await using var factory = new SqlApiFactory(connection.ConnectionString);
        var id = await factory.InitializeAsync();
        await factory.SetMissingReviewedWorkflowAsync(id);
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { UsernameOrEmail = "approver", Password = "Test@12345" });
        login.EnsureSuccessStatusCode();
        var token = (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("token").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var before = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{id}");
        var response = await client.PostAsJsonAsync($"/api/inspections/{id}/approve", new { rowVersion = before.GetProperty("rowVersion").GetString() });
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        var accepted = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Pending", accepted.GetProperty("workflowSyncStatus").GetString());
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        while (true)
        {
            timeout.Token.ThrowIfCancellationRequested();
            var current = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{id}", timeout.Token);
            if (current.GetProperty("workflowSyncStatus").GetString() == "Retrying") break;
            await Task.Delay(200, timeout.Token);
        }
    }

    private static async Task<JsonElement> WaitForSync(HttpClient client, Guid id)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        while (true)
        {
            timeout.Token.ThrowIfCancellationRequested();
            var value = await client.GetFromJsonAsync<JsonElement>($"/api/inspections/{id}", timeout.Token);
            var sync = value.GetProperty("workflowSyncStatus").GetString();
            if (sync == "Synchronized") return value;
            if (sync == "Retrying") throw new InvalidOperationException("Workflow synchronization is retrying.");
            await Task.Delay(200, timeout.Token);
        }
    }

    private sealed class SqlApiFactory(string connectionString) : WebApplicationFactory<Program>
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

        public async Task TouchAsync(Guid inspectionId)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var inspection = await db.FormInspections.SingleAsync(x => x.Id == inspectionId);
            inspection.FormDataJson = "{\"changed\":true}";
            await db.SaveChangesAsync();
        }

        public async Task SetMissingReviewedWorkflowAsync(Guid inspectionId)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var inspection = await db.FormInspections.SingleAsync(x => x.Id == inspectionId);
            inspection.Status = ConstructionProject.Domain.Enums.InspectionStatus.Reviewed;
            inspection.WorkflowInstanceId = "missing-instance";
            await db.SaveChangesAsync();
        }

        public async Task<(Guid ChecklistId, Guid ItemId)> CreateChecklistAsync(Guid inspectionId)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var existing = await db.FormInspections.SingleAsync(x => x.Id == inspectionId);
            var checklist = new Checklist { ObjectId = existing.ObjectId, Name = "Kiểm tra", CreatedBy = "test", Status = ConstructionProject.Domain.Enums.ChecklistStatus.Approved };
            var item = new ChecklistItem { Checklist = checklist, Name = "Tiêu chí", IsRequired = true, FormSchemaJson = "{}" };
            db.ChecklistItems.Add(item);
            await db.SaveChangesAsync();
            return (checklist.Id, item.Id);
        }
        public async Task<Guid> InitializeAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.MigrateAsync();
            var user = new User { Username = "submitter", Email = "submitter@test.local", FullName = "Submitter", PasswordHash = new PasswordHasher().HashPassword("Test@12345"), RoleId = RoleConstants.SubmitterRoleId, IsActive = true, EmailConfirmed = true };
            var drawing = new DrawingFile { FileName = "test.pdf", StoredFileName = "test.pdf", FileType = "pdf", FileUrl = "/test.pdf", FileSizeBytes = 1, UploadedBy = "test" };
            var obj = new ConstructionObject { DrawingFile = drawing, PageNumber = 1, MarkerCoordinates = "{}", Name = "C01", CreatedBy = "test" };
            var inspection = new FormInspection { Object = obj, Status = ConstructionProject.Domain.Enums.InspectionStatus.Draft, SubmittedById = user.Id, FormSchemaId = "default-inspection-schema", FormDataJson = "{}" };
            db.Users.Add(user);
            db.Users.Add(new User { Username = "reviewer", Email = "reviewer@test.local", FullName = "Reviewer", PasswordHash = new PasswordHasher().HashPassword("Test@12345"), RoleId = RoleConstants.ReviewerRoleId, IsActive = true, EmailConfirmed = true });
            db.Users.Add(new User { Username = "approver", Email = "approver@test.local", FullName = "Approver", PasswordHash = new PasswordHasher().HashPassword("Test@12345"), RoleId = RoleConstants.ApproverRoleId, IsActive = true, EmailConfirmed = true });
            db.FormInspections.Add(inspection);
            await db.SaveChangesAsync();
            var actorIds = await db.Users.Where(u => u.Username == "submitter" || u.Username == "reviewer" || u.Username == "approver").Select(u => u.Id).ToListAsync();
            db.ProjectMembers.AddRange(actorIds.Select(id => new ProjectMember { ProjectId = Project.LegacyId, UserId = id }));
            await db.SaveChangesAsync();
            return inspection.Id;
        }
    }
}
