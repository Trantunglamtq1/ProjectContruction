using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace ConstructionProject.Infrastructure.Caching;

/// <summary>
/// SQL owns authorization and list versions. Redis loss/eviction/reconnect cannot restore an old version.
/// One shared multiplexer is created lazily, so a stopped optional cache does not prevent API startup.
/// </summary>
public sealed class RedisDrawingListCache : IDrawingListCache, IAsyncDisposable
{
    private readonly RedisCacheOptions _options;
    private readonly ILogger<RedisDrawingListCache> _logger;
    private readonly Lazy<Task<ConnectionMultiplexer>> _connection;

    public RedisDrawingListCache(IOptions<RedisCacheOptions> options, ILogger<RedisDrawingListCache> logger)
    {
        _options = options.Value;
        _logger = logger;
        _connection = new Lazy<Task<ConnectionMultiplexer>>(() =>
        {
            var configuration = ConfigurationOptions.Parse(_options.ConnectionString);
            configuration.AbortOnConnectFail = false;
            configuration.ConnectRetry = 0;
            configuration.ConnectTimeout = _options.TimeoutMilliseconds;
            configuration.AsyncTimeout = _options.TimeoutMilliseconds;
            configuration.SyncTimeout = _options.TimeoutMilliseconds;
            configuration.BacklogPolicy = BacklogPolicy.FailFast;
            configuration.IncludeDetailInExceptions = false;
            return ConnectionMultiplexer.ConnectAsync(configuration);
        });
    }

    public async Task<List<DrawingFileDto>> GetOrCreateAsync(Guid projectId, Guid version, string search,
        Func<CancellationToken, Task<List<DrawingFileDto>>> load, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!_options.Enabled) return await load(cancellationToken);

        var key = $"{_options.KeyPrefix}drawings:v1:{projectId:N}:{version:N}:" +
                  Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(search)));
        IDatabase? database = null;
        try
        {
            var connection = await _connection.Value.WaitAsync(
                TimeSpan.FromMilliseconds(_options.TimeoutMilliseconds), cancellationToken);
            database = connection.GetDatabase();
            var payload = await database.StringGetAsync(key).WaitAsync(
                TimeSpan.FromMilliseconds(_options.TimeoutMilliseconds), cancellationToken);
            if (payload.HasValue)
            {
                var result = JsonSerializer.Deserialize<List<DrawingFileDto>>((string)payload!);
                if (result != null && result.All(d => d != null))
                {
                    _logger.LogDebug("Drawing cache hit for project {ProjectId}", projectId);
                    return result;
                }
            }
            _logger.LogDebug("Drawing cache miss for project {ProjectId}", projectId);
        }
        catch (Exception ex) when (ex is RedisException or TimeoutException or JsonException)
        {
            if (ex is not JsonException) database = null;
            // Do not log connection strings, search text, cached payloads, or exception details containing endpoints.
            _logger.LogWarning("Drawing cache read unavailable ({FailureType}); using database", ex.GetType().Name);
        }

        // Loader failures and request cancellation must propagate, never be mistaken for cache failures.
        var drawings = await load(cancellationToken);
        cancellationToken.ThrowIfCancellationRequested();
        if (database != null)
        {
            try
            {
                await database.StringSetAsync(key, JsonSerializer.Serialize(drawings),
                        TimeSpan.FromSeconds(_options.DrawingListTtlSeconds))
                    .WaitAsync(TimeSpan.FromMilliseconds(_options.TimeoutMilliseconds), cancellationToken);
            }
            catch (Exception ex) when (ex is RedisException or TimeoutException)
            {
                _logger.LogWarning("Drawing cache write unavailable ({FailureType}); returning database result", ex.GetType().Name);
            }
        }
        return drawings;
    }

    public async ValueTask DisposeAsync()
    {
        if (_connection.IsValueCreated)
        {
            try { await (await _connection.Value).DisposeAsync(); }
            catch (RedisException) { /* A connection that never opened has nothing to dispose. */ }
        }
    }
}
