using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
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

    private static string ConvertToAsciiSafeName(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "drawing";

        // Chuyển ký tự có dấu tiếng Việt thành không dấu
        var normalizedString = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalizedString.Length);
        foreach (var c in normalizedString)
        {
            var uc = CharUnicodeInfo.GetUnicodeCategory(c);
            if (uc != UnicodeCategory.NonSpacingMark)
            {
                sb.Append(c);
            }
        }
        var withoutDiacritics = sb.ToString().Normalize(NormalizationForm.FormC);

        // Chỉ giữ lại chữ cái a-z, số 0-9, gạch dưới và gạch ngang
        var safe = Regex.Replace(withoutDiacritics, @"[^a-zA-Z0-9_\-]", "_");
        safe = Regex.Replace(safe, @"_+", "_").Trim('_');
        return string.IsNullOrWhiteSpace(safe) ? "drawing" : safe;
    }

    public async Task<(string fileUrl, string storedFileName, long size)> SaveFileAsync(
        Stream fileStream, 
        string originalFileName, 
        string contentType, 
        CancellationToken cancellationToken = default)
    {
        var extension = Path.GetExtension(originalFileName).ToLowerInvariant();
        var safeBaseName = ConvertToAsciiSafeName(Path.GetFileNameWithoutExtension(originalFileName));
        
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

        // Nếu không tìm thấy file trực tiếp (ví dụ truyền tên file gốc lúc upload)
        if (!File.Exists(filePath))
        {
            var normalizedName = safeFileName.Replace(" ", "_");
            var matchedFile = Directory.EnumerateFiles(_storageFolder, $"*_{normalizedName}")
                .Concat(Directory.EnumerateFiles(_storageFolder, $"*_{safeFileName}"))
                .OrderByDescending(f => File.GetLastWriteTimeUtc(f))
                .FirstOrDefault();

            if (matchedFile != null && File.Exists(matchedFile))
            {
                filePath = matchedFile;
                safeFileName = Path.GetFileName(matchedFile);
            }
            else
            {
                return Task.FromResult<(Stream stream, string contentType, string fileName)?>(null);
            }
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

        if (!File.Exists(filePath))
        {
            var normalizedName = safeFileName.Replace(" ", "_");
            var matchedFile = Directory.EnumerateFiles(_storageFolder, $"*_{normalizedName}")
                .Concat(Directory.EnumerateFiles(_storageFolder, $"*_{safeFileName}"))
                .OrderByDescending(f => File.GetLastWriteTimeUtc(f))
                .FirstOrDefault();

            if (matchedFile != null && File.Exists(matchedFile))
            {
                filePath = matchedFile;
            }
        }

        if (File.Exists(filePath))
        {
            File.Delete(filePath);
            return Task.FromResult(true);
        }

        return Task.FromResult(false);
    }
}
