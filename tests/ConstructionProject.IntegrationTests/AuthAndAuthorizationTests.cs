using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace ConstructionProject.IntegrationTests;

public class AuthAndAuthorizationTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public AuthAndAuthorizationTests(ApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetCurrentUser_WithoutToken_Returns401()
    {
        var client = _factory.CreateSeededClient();

        var response = await client.GetAsync("/api/auth/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        var client = _factory.CreateSeededClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new
        {
            UsernameOrEmail = "admin",
            Password = "wrong-password"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_WithSeededAdmin_ReturnsTokenAndRole()
    {
        var client = _factory.CreateSeededClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new
        {
            UsernameOrEmail = "admin",
            Password = "Admin@123"
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        payload.GetProperty("token").GetString().Should().NotBeNullOrWhiteSpace();
        payload.GetProperty("user").GetProperty("roleName").GetString().Should().Be("Admin");
    }

    [Fact]
    public async Task Users_WithSubmitterToken_Returns403()
    {
        var client = _factory.CreateSeededClient();
        var token = await _factory.LoginAsync(client, "submitter");
        ApiFactory.Authorize(client, token);

        var response = await client.GetAsync("/api/users");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Users_WithAdminToken_Returns200()
    {
        var client = _factory.CreateSeededClient();
        var token = await _factory.LoginAsync(client, "admin", "Admin@123");
        ApiFactory.Authorize(client, token);

        var response = await client.GetAsync("/api/users");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("submitter");
    }

    [Fact]
    public async Task Users_WithReviewerToken_Returns403()
    {
        var client = _factory.CreateSeededClient();
        var token = await _factory.LoginAsync(client, "reviewer");
        ApiFactory.Authorize(client, token);

        var response = await client.GetAsync("/api/users/roles");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
