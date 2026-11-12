using System.Net;
using System.Net.Http.Json;

namespace ConstructionProject.IntegrationTests;

public class ChecklistWorkflowAuthorizationTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;
    public ChecklistWorkflowAuthorizationTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task WrongRoles_CannotSubmitOrApproveChecklist()
    {
        using var client = _factory.CreateSeededClient();
        ApiFactory.Authorize(client, await _factory.LoginAsync(client, "reviewer"));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/checklists/{Guid.NewGuid()}/submit", new { })).StatusCode);
        ApiFactory.Authorize(client, await _factory.LoginAsync(client, "submitter"));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/checklists/{Guid.NewGuid()}/supervisor-approve", new { })).StatusCode);
    }
}
