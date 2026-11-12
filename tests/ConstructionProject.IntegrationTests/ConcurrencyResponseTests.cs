using System.Net;
using ConstructionProject.API.Middlewares;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace ConstructionProject.IntegrationTests;

public class ConcurrencyResponseTests
{
    [Fact]
    public async Task DbConcurrencyConflict_Returns409WithReloadMessage()
    {
        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new DbUpdateConcurrencyException("conflict"),
            NullLogger<ExceptionHandlingMiddleware>.Instance);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        Assert.Equal((int)HttpStatusCode.Conflict, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        var response = await new StreamReader(context.Response.Body).ReadToEndAsync();
        Assert.Contains("tải lại", System.Text.Json.JsonDocument.Parse(response).RootElement.GetProperty("message").GetString());
    }
}
