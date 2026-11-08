using System.Net;
using System.Net.Http.Json;
using FluentAssertions;

namespace ConstructionProject.IntegrationTests;

public class InspectionEndpointsTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public InspectionEndpointsTests(ApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetInspections_WithoutToken_Returns401()
    {
        var client = _factory.CreateSeededClient();

        var response = await client.GetAsync("/api/inspections?pageNumber=1&pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetInspections_WithSubmitterToken_ReturnsEmptyPage()
    {
        var client = _factory.CreateSeededClient();
        var token = await _factory.LoginAsync(client, "submitter");
        ApiFactory.Authorize(client, token);

        var response = await client.GetAsync("/api/inspections?pageNumber=1&pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync();
        body.Should().Contain("\"items\"");
    }

    [Fact]
    public async Task Approve_WithSubmitterToken_Returns403()
    {
        var client = _factory.CreateSeededClient();
        var token = await _factory.LoginAsync(client, "submitter");
        ApiFactory.Authorize(client, token);

        var response = await client.PostAsJsonAsync(
            $"/api/inspections/{Guid.NewGuid()}/approve",
            new { Comment = "test" });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Review_WithApproverToken_Returns403()
    {
        var client = _factory.CreateSeededClient();
        var token = await _factory.LoginAsync(client, "approver");
        ApiFactory.Authorize(client, token);

        var response = await client.PostAsJsonAsync(
            $"/api/inspections/{Guid.NewGuid()}/review",
            new { Comment = "test" });

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetInspection_WithRandomId_Returns404()
    {
        var client = _factory.CreateSeededClient();
        var token = await _factory.LoginAsync(client, "reviewer");
        ApiFactory.Authorize(client, token);

        var response = await client.GetAsync($"/api/inspections/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
