using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ConstructionProject.IntegrationTests;

public sealed class ProjectFileAuthorizationTests
{
    [Fact]
    public async Task AnonymousForeignAndAlternateFileRoutesCannotReachStorage_ValidRangeCan()
    {
        var files = new TestFileStorage();
        await using var fixture = Fixture(files);
        using var actor = await fixture.LoginAsync("submitter");
        using var anonymous = fixture.Factory.CreateClient();
        files.Put("allowed.pdf"); files.Put("foreign.pdf"); files.Put("foreign-proof.pdf");
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.ProjectAttachments.Add(new ProjectAttachment { ProjectId = fixture.ProjectB.Id, StoredFileName = "foreign-proof.pdf", OriginalName = "proof.pdf", ContentType = "application/pdf" });
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Unauthorized,(await anonymous.GetAsync("/api/drawings/files/allowed.pdf")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,(await anonymous.GetAsync("/api/inspections/attachments/files/foreign-proof.pdf")).StatusCode);
        foreach (var path in new[] { "/api/drawings/files/foreign.pdf", "/api/inspections/attachments/files/foreign-proof.pdf" })
            Assert.Equal(HttpStatusCode.Forbidden,(await actor.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await actor.GetAsync("/api/inspections/attachments/files/foreign.pdf")).StatusCode);
        files.Put("orphan.pdf");
        Assert.Equal(HttpStatusCode.NotFound,(await actor.GetAsync("/api/drawings/files/orphan.pdf")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await actor.GetAsync("/api/inspections/attachments/files/orphan.pdf")).StatusCode);
        using var foreignRange = new HttpRequestMessage(HttpMethod.Get,"/api/drawings/files/foreign.pdf");
        foreignRange.Headers.Range = new RangeHeaderValue(0,2);
        Assert.Equal(HttpStatusCode.Forbidden,(await actor.SendAsync(foreignRange)).StatusCode);
        Assert.Equal(0,files.ReadCalls);
        using var request = new HttpRequestMessage(HttpMethod.Get,"/api/drawings/files/allowed.pdf");
        request.Headers.Range = new RangeHeaderValue(0,2);
        using var response = await actor.SendAsync(request);
        Assert.Equal(HttpStatusCode.PartialContent,response.StatusCode);
        Assert.Equal("nosniff",response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.Equal(1,files.ReadCalls);
    }

    [Fact]
    public async Task UploadChecksProjectBeforeStorage_StoresCanonicalMime_AndRevokeAppliesToOldJwt()
    {
        var files = new TestFileStorage(); await using var fixture = Fixture(files);
        using var actor = await fixture.LoginAsync("submitter");
        Assert.Equal(HttpStatusCode.Forbidden,(await actor.PostAsync("/api/inspections/upload-attachment",Upload(fixture.ProjectB.Id))).StatusCode);
        Assert.Equal(0,files.SaveCalls);
        using var uploaded = await actor.PostAsync("/api/inspections/upload-attachment",Upload(fixture.ProjectA.Id));
        Assert.Equal(HttpStatusCode.OK,uploaded.StatusCode);
        var dto = await uploaded.Content.ReadFromJsonAsync<InspectionAttachmentDto>();
        Assert.Equal("application/pdf",dto!.ContentType);
        Assert.Equal(HttpStatusCode.OK,(await actor.GetAsync(dto.FileUrl)).StatusCode);
        using var admin = await fixture.LoginAsync("admin");
        Assert.Equal(HttpStatusCode.NoContent,(await admin.DeleteAsync($"/api/projects/{fixture.ProjectA.Id}/members/{fixture.SubmitterId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await actor.GetAsync(dto.FileUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await actor.PostAsync("/api/inspections/upload-attachment",Upload(fixture.ProjectA.Id))).StatusCode);
        Assert.Equal(1,files.SaveCalls);
    }

    [Fact]
    public async Task ForeignAttachmentIsRejected_EvenForDualMember_AndExternalUrlsCannotBeForged()
    {
        await using var fixture = Fixture(new TestFileStorage()); using var actor = await fixture.LoginAsync("submitter");
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.ProjectAttachments.AddRange(
                new ProjectAttachment { ProjectId = fixture.ProjectB.Id, StoredFileName = "b.pdf", OriginalName = "b.pdf", ContentType = "application/pdf" },
                new ProjectAttachment { ProjectId = fixture.ProjectA.Id, StoredFileName = "a.pdf", OriginalName = "a.pdf", ContentType = "application/pdf" });
            await db.SaveChangesAsync();
        }
        var url = $"/api/inspections/{fixture.Allowed.InspectionId}";
        var payload = "{\"attachments\":[{\"storedFileName\":\"b.pdf\",\"fileUrl\":\"/api/inspections/attachments/files/b.pdf\"}]}";
        Assert.Equal(HttpStatusCode.Forbidden,(await actor.PutAsJsonAsync(url,new { formDataJson = payload,rowVersion = "AQ==" })).StatusCode);
        using var admin = await fixture.LoginAsync("admin");
        Assert.True((await admin.PutAsJsonAsync($"/api/projects/{fixture.ProjectB.Id}/members/{fixture.SubmitterId}",new {})).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await actor.PutAsJsonAsync(url,new { formDataJson = payload,rowVersion = "AQ==" })).StatusCode);
        var forged = "{\"attachments\":[{\"storedFileName\":\"a.pdf\",\"fileUrl\":\"https://untrusted.invalid/b.pdf\"}]}";
        Assert.Equal(HttpStatusCode.BadRequest,(await actor.PutAsJsonAsync(url,new { formDataJson = forged,rowVersion = "AQ==" })).StatusCode);
    }

    private static ProjectAuthorizationFixture Fixture(TestFileStorage storage) => new(services =>
    {
        services.RemoveAll<IFileStorageService>(); services.AddSingleton<IFileStorageService>(storage);
    });
    private static MultipartFormDataContent Upload(Guid project)
    {
        var form = new MultipartFormDataContent(); form.Add(new StringContent(project.ToString()),"projectId");
        var file = new ByteArrayContent("%PDF-test-content"u8.ToArray()); file.Headers.ContentType = new MediaTypeHeaderValue("text/html");
        form.Add(file,"file","proof.pdf"); return form;
    }
}

internal sealed class TestFileStorage : IFileStorageService
{
    private readonly ConcurrentDictionary<string,byte[]> _files = new();
    public int ReadCalls; public int SaveCalls;
    public void Put(string name) => _files[name] = "%PDF-test-content"u8.ToArray();
    public async Task<(string fileUrl,string storedFileName,long size)> SaveFileAsync(Stream stream,string original,string contentType,CancellationToken ct = default)
    {
        Interlocked.Increment(ref SaveCalls); var name = Guid.NewGuid().ToString("N") + ".pdf";
        using var data = new MemoryStream(); await stream.CopyToAsync(data,ct); _files[name] = data.ToArray();
        return ($"/api/drawings/files/{name}",name,data.Length);
    }
    public Task<(Stream stream,string contentType,string fileName)?> GetFileAsync(string name,CancellationToken ct = default)
    {
        Interlocked.Increment(ref ReadCalls);
        return Task.FromResult<(Stream,string,string)?>(_files.TryGetValue(name,out var data) ? (new MemoryStream(data),"application/pdf",name) : null);
    }
    public Task<bool> DeleteFileAsync(string name,CancellationToken ct = default) => Task.FromResult(_files.TryRemove(name,out _));
}
