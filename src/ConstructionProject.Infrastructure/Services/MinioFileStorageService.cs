using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ConstructionProject.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Minio;
using Minio.DataModel.Args;
using Minio.Exceptions;

namespace ConstructionProject.Infrastructure.Services;

public class MinioFileStorageService : IFileStorageService
{
    private readonly IMinioClient _minioClient;
    private readonly string _bucketName;
    private readonly ILogger<MinioFileStorageService> _logger;
    private bool _bucketInitialized = false;
    private readonly SemaphoreSlim _initLock = new(1, 1);

    public MinioFileStorageService(IConfiguration configuration, ILogger<MinioFileStorageService> logger)
    {
        _logger = logger;
        
        var endpoint = configuration["Storage:MinIO:Endpoint"] ?? "localhost:9000";
        var accessKey = configuration["Storage:MinIO:AccessKey"] ?? "minioadmin";
        var secretKey = configuration["Storage:MinIO:SecretKey"] ?? "minioadmin";
        var useSsl = bool.TryParse(configuration["Storage:MinIO:UseSSL"], out var ssl) && ssl;
        _bucketName = configuration["Storage:MinIO:BucketName"] ?? "construction-drawings";

        _minioClient = new MinioClient()
            .WithEndpoint(endpoint)
            .WithCredentials(accessKey, secretKey)
            .WithSSL(useSsl)
            .Build();
    }

    private async Task EnsureBucketExistsAsync(CancellationToken cancellationToken)
    {
        if (_bucketInitialized) return;

        await _initLock.WaitAsync(cancellationToken);
        try
        {
            if (_bucketInitialized) return;

            var beArgs = new BucketExistsArgs().WithBucket(_bucketName);
            bool found = await _minioClient.BucketExistsAsync(beArgs, cancellationToken);
            if (!found)
            {
                var mbArgs = new MakeBucketArgs().WithBucket(_bucketName);
                await _minioClient.MakeBucketAsync(mbArgs, cancellationToken);
                _logger.LogInformation("Bucket MinIO '{BucketName}' đã được tạo thành công.", _bucketName);
            }

            _bucketInitialized = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi kiểm tra hoặc tạo bucket MinIO '{BucketName}'.", _bucketName);
            throw;
        }
        finally
        {
            _initLock.Release();
        }
    }

    private static string ConvertToAsciiSafeName(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "drawing";

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
        await EnsureBucketExistsAsync(cancellationToken);

        var extension = Path.GetExtension(originalFileName).ToLowerInvariant();
        var safeBaseName = ConvertToAsciiSafeName(Path.GetFileNameWithoutExtension(originalFileName));
        var storedFileName = $"{Guid.NewGuid():N}_{safeBaseName}{extension}";

        // Đảm bảo Stream có thể đo được kích thước (nếu chưa seekable thì copy vào MemoryStream)
        Stream uploadStream = fileStream;
        MemoryStream? memoryStream = null;
        long streamSize;

        try
        {
            if (fileStream.CanSeek)
            {
                fileStream.Position = 0;
                streamSize = fileStream.Length;
            }
            else
            {
                memoryStream = new MemoryStream();
                await fileStream.CopyToAsync(memoryStream, cancellationToken);
                memoryStream.Position = 0;
                uploadStream = memoryStream;
                streamSize = memoryStream.Length;
            }

            var putObjectArgs = new PutObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(storedFileName)
                .WithStreamData(uploadStream)
                .WithObjectSize(streamSize)
                .WithContentType(string.IsNullOrWhiteSpace(contentType) ? "application/pdf" : contentType);

            await _minioClient.PutObjectAsync(putObjectArgs, cancellationToken);

            var fileUrl = $"/api/drawings/files/{storedFileName}";
            _logger.LogInformation("File đã được tải lên MinIO thành công: {Original} -> Bucket '{Bucket}' / {Stored}, Size: {Size} bytes",
                originalFileName, _bucketName, storedFileName, streamSize);

            return (fileUrl, storedFileName, streamSize);
        }
        finally
        {
            memoryStream?.Dispose();
        }
    }

    public async Task<(Stream stream, string contentType, string fileName)?> GetFileAsync(
        string storedFileName,
        CancellationToken cancellationToken = default)
    {
        await EnsureBucketExistsAsync(cancellationToken);

        try
        {
            var statArgs = new StatObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(storedFileName);

            var stat = await _minioClient.StatObjectAsync(statArgs, cancellationToken);
            if (stat == null) return null;

            var ms = new MemoryStream();
            var getObjectArgs = new GetObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(storedFileName)
                .WithCallbackStream((stream) =>
                {
                    stream.CopyTo(ms);
                });

            await _minioClient.GetObjectAsync(getObjectArgs, cancellationToken);
            ms.Position = 0;

            var contentType = !string.IsNullOrWhiteSpace(stat.ContentType) ? stat.ContentType : "application/pdf";
            return (ms, contentType, storedFileName);
        }
        catch (ObjectNotFoundException)
        {
            _logger.LogWarning("Không tìm thấy file '{FileName}' trong bucket MinIO '{BucketName}'.", storedFileName, _bucketName);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi lấy file '{FileName}' từ bucket MinIO '{BucketName}'.", storedFileName, _bucketName);
            return null;
        }
    }

    public async Task<bool> DeleteFileAsync(string storedFileName, CancellationToken cancellationToken = default)
    {
        await EnsureBucketExistsAsync(cancellationToken);

        try
        {
            var rmArgs = new RemoveObjectArgs()
                .WithBucket(_bucketName)
                .WithObject(storedFileName);

            await _minioClient.RemoveObjectAsync(rmArgs, cancellationToken);
            _logger.LogInformation("Đã xóa file '{FileName}' khỏi bucket MinIO '{BucketName}'.", storedFileName, _bucketName);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi xóa file '{FileName}' khỏi MinIO.", storedFileName);
            return false;
        }
    }
}
