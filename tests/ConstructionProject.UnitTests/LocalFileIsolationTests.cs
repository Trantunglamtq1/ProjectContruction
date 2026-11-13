using ConstructionProject.Infrastructure.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace ConstructionProject.UnitTests;

public class LocalFileIsolationTests
{
    [Fact]
    public async Task OriginalNameOrMissingStoredNameNeverFallsBackToAnotherPhysicalFile()
    {
        var directory = Path.Combine(AppContext.BaseDirectory,"isolated-files",Guid.NewGuid().ToString("N"));
        var env = new Mock<IWebHostEnvironment>(); env.SetupGet(e => e.ContentRootPath).Returns(directory);
        var storage = new LocalFileStorageService(env.Object,NullLogger<LocalFileStorageService>.Instance);
        var (_,stored,_) = await storage.SaveFileAsync(new MemoryStream("%PDF-private-B"u8.ToArray()),"shared.pdf","application/pdf");
        Assert.Null(await storage.GetFileAsync("shared.pdf"));
        Assert.Null(await storage.GetFileAsync("missing_shared.pdf"));
        Assert.False(await storage.DeleteFileAsync("shared.pdf"));
        var found = await storage.GetFileAsync(stored); Assert.NotNull(found); found.Value.stream.Dispose();
    }
}
