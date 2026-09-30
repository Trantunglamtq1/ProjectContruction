using ConstructionProject.Application.Common.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;

namespace ConstructionProject.Infrastructure.Services;

public class LocalFileStorageService : IFileStorageService
{
    private readonly string _storageFolder;
    private readonly ILogger<LocalFileStorageService> _logger;

    public LocalFileStorageService(IWebHostEnvironment environment, ILogger<LocalFileStorageService> logger)
    {
        _logger = logger;
        // Store in uploads/drawings folder under ContentRoot
        _storageFolder = Path.Combine(environment.ContentRootPath, "uploads", "drawings");
        if (!Directory.Exists(_storageFolder))
        {
            Directory.CreateDirectory(_storageFolder);
        }
    }

    public async Task<(string fileUrl, string storedFileName, long size)> SaveFileAsync(
        Stream fileStream, 
        string originalFileName, 
        string contentType, 
        CancellationToken cancellationToken = default)
    {
        var extension = Path.GetExtension(originalFileName);
        var safeBaseName = Path.GetFileNameWithoutExtension(originalFileName)
            .Replace(" ", "_")
            .Replace("..", "");
        
        var storedFileName = $"{Guid.NewGuid():N}_{safeBaseName}{extension}";
        var filePath = Path.Combine(_storageFolder, storedFileName);

        using (var destStream = new FileStream(filePath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await fileStream.CopyToAsync(destStream, cancellationToken);
        }

        var fileInfo = new FileInfo(filePath);
        var fileUrl = $"/api/drawings/files/{storedFileName}";

        _logger.LogInformation("File saved successfully: {OriginalName} -> {StoredName}, Size: {Size} bytes",
            originalFileName, storedFileName, fileInfo.Length);

        return (fileUrl, storedFileName, fileInfo.Length);
    }

    public Task<(Stream stream, string contentType, string fileName)?> GetFileAsync(
        string storedFileName, 
        CancellationToken cancellationToken = default)
    {
        var safeFileName = Path.GetFileName(storedFileName);
        var filePath = Path.Combine(_storageFolder, safeFileName);

        if (!File.Exists(filePath))
        {
            return Task.FromResult<(Stream stream, string contentType, string fileName)?>(null);
        }

        var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        var contentType = safeFileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) 
            ? "application/pdf" 
            : "application/octet-stream";

        return Task.FromResult<(Stream stream, string contentType, string fileName)?>((stream, contentType, safeFileName));
    }

    public Task<bool> DeleteFileAsync(string storedFileName, CancellationToken cancellationToken = default)
    {
        var safeFileName = Path.GetFileName(storedFileName);
        var filePath = Path.Combine(_storageFolder, safeFileName);

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }
}
