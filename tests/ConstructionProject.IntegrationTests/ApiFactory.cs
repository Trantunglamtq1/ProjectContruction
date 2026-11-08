using System.Net.Http.Json;
using System.Text.Json;
using ConstructionProject.Domain.Constants;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using ConstructionProject.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ConstructionProject.IntegrationTests;

/// <summary>
/// Dựng toàn bộ API thật (controllers, JWT, middleware, SignalR) nhưng thay SQL Server
/// bằng EF InMemory để test chạy nhanh và không cần Docker.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string Password = "Test@12345";

    private readonly string _databaseName = $"integration-tests-{Guid.NewGuid()}";
    private bool _initialized;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<ApplicationDbContext>>();
            services.RemoveAll<ApplicationDbContext>();
            services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase(_databaseName));
        });
    }

    /// <summary>Tạo schema + seed 4 tài khoản demo (mỗi role 1 tài khoản).</summary>
    public void InitializeDatabase()
    {
        if (_initialized) return;

        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        db.Database.EnsureCreated();

        var hasher = new PasswordHasher();

        // Admin đã được seed sẵn trong cấu hình entity (admin / Admin@123)
        if (!db.Users.Any(u => u.Username == "submitter"))
        {
            db.Users.AddRange(
                NewUser("submitter", "submitter@test.local", "Kỹ sư hiện trường", RoleConstants.SubmitterRoleId, hasher),
                NewUser("reviewer", "reviewer@test.local", "Tư vấn giám sát", RoleConstants.ReviewerRoleId, hasher),
                NewUser("approver", "approver@test.local", "Chủ đầu tư", RoleConstants.ApproverRoleId, hasher)
            );
            db.SaveChanges();
        }

        _initialized = true;
    }

    public HttpClient CreateSeededClient()
    {
        InitializeDatabase();
        return CreateClient();
    }

    public async Task<string> LoginAsync(HttpClient client, string username, string password = Password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new
        {
            UsernameOrEmail = username,
            Password = password
        });

        response.EnsureSuccessStatusCode();

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        return payload.GetProperty("token").GetString()
               ?? throw new InvalidOperationException("Login response không chứa token.");
    }

    public static void Authorize(HttpClient client, string token) =>
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

    private static User NewUser(string username, string email, string fullName, Guid roleId, PasswordHasher hasher) =>
        new()
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email,
            FullName = fullName,
            PasswordHash = hasher.HashPassword(Password),
            RoleId = roleId,
            IsActive = true,
            EmailConfirmed = true,
            CreatedAt = DateTime.UtcNow
        };
}
