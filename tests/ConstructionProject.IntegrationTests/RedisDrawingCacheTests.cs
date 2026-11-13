using System.Net;
using System.Net.Http.Json;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Caching;
using ConstructionProject.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using StackExchange.Redis;

namespace ConstructionProject.IntegrationTests;

public sealed class RedisFactAttribute : FactAttribute
{
    public RedisFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_REDIS")))
            Skip = "Set CONSTRUCTION_TEST_REDIS for actual Redis integration tests.";
    }
}

public class RedisDrawingCacheTests
{
    [RedisFact]
    public async Task MissHitSearchProjectAndVersionIsolationUseRealRedis()
    {
        await using var redis = await RedisScope.CreateAsync();
        var project = Guid.NewGuid(); var version = Guid.NewGuid(); var loads = 0;
        Task<List<DrawingFileDto>> Load(CancellationToken _) => Task.FromResult(new List<DrawingFileDto>
            { new() { FileName = $"load-{++loads}.pdf" } });
        var first = await redis.Cache.GetOrCreateAsync(project, version, "", Load, default);
        var second = await redis.Cache.GetOrCreateAsync(project, version, "", Load, default);
        Assert.Equal(first[0].FileName, second[0].FileName);
        Assert.Equal(1, loads);
        await redis.Cache.GetOrCreateAsync(project, version, "search", Load, default);
        await redis.Cache.GetOrCreateAsync(Guid.NewGuid(), version, "", Load, default);
        await redis.Cache.GetOrCreateAsync(project, Guid.NewGuid(), "", Load, default);
        Assert.Equal(4, loads);
        Assert.Equal(4, redis.Keys().Length);
        foreach (var key in redis.Keys())
        {
            var ttl = await redis.Database.KeyTimeToLiveAsync(key);
            Assert.NotNull(ttl);
            Assert.InRange(ttl.Value.TotalSeconds, 0.1, 60);
        }
    }

    [RedisFact]
    public async Task ExpiredOrCorruptPayloadLoadsDatabaseAndRepairsCache()
    {
        await using var redis = await RedisScope.CreateAsync(ttlSeconds: 1);
        var project = Guid.NewGuid(); var version = Guid.NewGuid(); var loads = 0;
        Task<List<DrawingFileDto>> Load(CancellationToken _) { loads++; return Task.FromResult(new List<DrawingFileDto>()); }
        await redis.Cache.GetOrCreateAsync(project, version, "", Load, default);
        await redis.Database.StringSetAsync(Assert.Single(redis.Keys()), "{malformed", TimeSpan.FromSeconds(1));
        await redis.Cache.GetOrCreateAsync(project, version, "", Load, default);
        await redis.Cache.GetOrCreateAsync(project, version, "", Load, default);
        Assert.Equal(2, loads);
        await Task.Delay(1200);
        await redis.Cache.GetOrCreateAsync(project, version, "", Load, default);
        Assert.Equal(3, loads);
    }

    [RedisFact]
    public async Task OldInFlightFillCannotReplaceCurrentVersion()
    {
        await using var redis = await RedisScope.CreateAsync();
        var project = Guid.NewGuid(); var oldVersion = Guid.NewGuid(); var currentVersion = Guid.NewGuid();
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var old = redis.Cache.GetOrCreateAsync(project, oldVersion, "", async _ =>
        {
            started.SetResult(); await release.Task;
            return [new() { FileName = "old.pdf" }];
        }, default);
        await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
        await redis.Cache.GetOrCreateAsync(project, currentVersion, "",
            _ => Task.FromResult(new List<DrawingFileDto> { new() { FileName = "new.pdf" } }), default);
        release.SetResult(); await old;
        var current = await redis.Cache.GetOrCreateAsync(project, currentVersion, "",
            _ => throw new InvalidOperationException("Current entry should be cached"), default);
        Assert.Equal("new.pdf", Assert.Single(current).FileName);
    }

    [Fact]
    public async Task DisabledOrUnavailableCacheFallsBackAndPropagatesLoaderFailuresAndCancellation()
    {
        foreach (var enabled in new[] { false, true })
        {
            await using var cache = NewCache(new RedisCacheOptions
            {
                Enabled = enabled, ConnectionString = "127.0.0.1:1", TimeoutMilliseconds = 100
            });
            var loads = 0;
            var result = await cache.GetOrCreateAsync(Guid.NewGuid(), Guid.NewGuid(), "", _ =>
            { loads++; return Task.FromResult(new List<DrawingFileDto>()); }, default);
            Assert.Empty(result); Assert.Equal(1, loads);
            await Assert.ThrowsAsync<InvalidOperationException>(() => cache.GetOrCreateAsync(Guid.NewGuid(), Guid.NewGuid(), "",
                _ => throw new InvalidOperationException("SQL failed"), default));
            using var cancelled = new CancellationTokenSource(); cancelled.Cancel();
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => cache.GetOrCreateAsync(Guid.NewGuid(), Guid.NewGuid(), "",
                _ => throw new InvalidOperationException("Must not load"), cancelled.Token));
        }
    }

    [RedisFact]
    public async Task WarmApiCacheHonorsCurrentMembershipSearchAndResourceFileGuards()
    {
        await using var redis = await RedisScope.CreateAsync();
        await using var fixture = new ProjectAuthorizationFixture(services => services.AddSingleton<IDrawingListCache>(redis.Cache));
        using var actor = await fixture.LoginAsync("submitter");
        using var admin = await fixture.LoginAsync("admin");
        var url = $"/api/drawings?projectId={fixture.ProjectA.Id}";
        var first = await actor.GetFromJsonAsync<List<DrawingFileDto>>(url);
        var warm = await actor.GetFromJsonAsync<List<DrawingFileDto>>(url);
        Assert.Equal(fixture.Allowed.DrawingId, Assert.Single(warm!).Id);
        Assert.Equal(first![0].Id, warm![0].Id);
        Assert.Single(redis.Keys());
        Assert.Empty((await actor.GetFromJsonAsync<List<DrawingFileDto>>(url + "&search=nonexistent"))!);
        Assert.Single((await actor.GetFromJsonAsync<List<DrawingFileDto>>(url + "&search=%20ALLOWED%20"))!);
        // Warm B directly with its own data to prove authorization happens before even a real cache hit.
        Guid foreignVersion;
        using (var scope = fixture.Factory.Services.CreateScope())
            foreignVersion = (await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Projects
                .SingleAsync(p => p.Id == fixture.ProjectB.Id)).DrawingListCacheVersion;
        await redis.Cache.GetOrCreateAsync(fixture.ProjectB.Id, foreignVersion, "", _ =>
            Task.FromResult(new List<DrawingFileDto> { new() { Id = fixture.Foreign.DrawingId, FileName = "foreign.pdf" } }), default);
        Assert.Equal(HttpStatusCode.Forbidden, (await actor.GetAsync($"/api/drawings?projectId={fixture.ProjectB.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/projects/{fixture.ProjectA.Id}/members/{fixture.SubmitterId}")).StatusCode);
        foreach (var path in new[] { url, $"/api/drawings/{fixture.Allowed.DrawingId}",
                     $"/api/objects/{fixture.Allowed.ObjectId}", "/api/drawings/files/allowed.pdf" })
            Assert.Equal(HttpStatusCode.Forbidden, (await actor.GetAsync(path)).StatusCode);
        Assert.Empty((await actor.GetFromJsonAsync<List<DrawingFileDto>>("/api/drawings"))!);
    }

    [RedisFact]
    public async Task ApiUploadObjectCreateDeleteAndDrawingDeleteRefreshCachedCounts()
    {
        await using var redis = await RedisScope.CreateAsync();
        await using var fixture = new ProjectAuthorizationFixture(services =>
        {
            services.AddSingleton<IDrawingListCache>(redis.Cache);
            services.AddSingleton<IFileStorageService>(new CacheTestFiles());
        });
        using var actor = await fixture.LoginAsync("submitter");
        var url = $"/api/drawings?projectId={fixture.ProjectA.Id}";
        Assert.Single((await actor.GetFromJsonAsync<List<DrawingFileDto>>(url))!);
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(fixture.ProjectA.Id.ToString()), "projectId");
        using var pdf = new ByteArrayContent("%PDF-1.7 demo"u8.ToArray());
        pdf.Headers.ContentType = new("application/pdf");
        form.Add(pdf, "file", "cache-test.pdf");
        var upload = await actor.PostAsync("/api/drawings/upload", form);
        upload.EnsureSuccessStatusCode();
        var drawing = (await upload.Content.ReadFromJsonAsync<DrawingFileDto>())!;
        Assert.Equal(2, (await actor.GetFromJsonAsync<List<DrawingFileDto>>(url))!.Count);
        var created = await actor.PostAsJsonAsync("/api/objects", new
        {
            drawingFileId = drawing.Id, pageNumber = 1, name = "Cache column",
            markerCoordinates = "{\"x\":1,\"y\":1,\"width\":2,\"height\":2}"
        });
        created.EnsureSuccessStatusCode();
        var obj = (await created.Content.ReadFromJsonAsync<ObjectDto>())!;
        Assert.Equal(1, (await actor.GetFromJsonAsync<List<DrawingFileDto>>(url))!.Single(d => d.Id == drawing.Id).ObjectCount);
        (await actor.DeleteAsync($"/api/objects/{obj.Id}")).EnsureSuccessStatusCode();
        Assert.Equal(0, (await actor.GetFromJsonAsync<List<DrawingFileDto>>(url))!.Single(d => d.Id == drawing.Id).ObjectCount);
        (await actor.DeleteAsync($"/api/drawings/{drawing.Id}")).EnsureSuccessStatusCode();
        Assert.Single((await actor.GetFromJsonAsync<List<DrawingFileDto>>(url))!);
    }

    [RedisFact]
    public async Task CommittedMutationDuringCacheOutageCannotResurrectPreOutageList()
    {
        await using var redis = await RedisScope.CreateAsync();
        // API resolves this slot on every scoped handler, simulating cache unavailability/recovery.
        await using var down = NewCache(new RedisCacheOptions { Enabled = true, ConnectionString = "127.0.0.1:1", TimeoutMilliseconds = 100 });
        IDrawingListCache selected = redis.Cache;
        await using var fixture = new ProjectAuthorizationFixture(services => services.AddSingleton<IDrawingListCache>(new SelectedCache(() => selected)));
        using var actor = await fixture.LoginAsync("submitter");
        var url = $"/api/drawings?projectId={fixture.ProjectA.Id}";
        Assert.Single((await actor.GetFromJsonAsync<List<DrawingFileDto>>(url))!);
        selected = down;
        using (var scope = fixture.Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.DrawingFiles.Add(new DrawingFile { ProjectId = fixture.ProjectA.Id, FileName = "during-outage.pdf" });
            await db.SaveChangesAsync();
        }
        Assert.Equal(2, (await actor.GetFromJsonAsync<List<DrawingFileDto>>(url))!.Count);
        selected = redis.Cache;
        Assert.Equal(2, (await actor.GetFromJsonAsync<List<DrawingFileDto>>(url))!.Count);
        Assert.Equal(2, redis.Keys().Length); // Old snapshot still exists, but is unreachable through SQL version.
    }

    internal static RedisDrawingListCache NewCache(RedisCacheOptions options) =>
        new(Options.Create(options), NullLogger<RedisDrawingListCache>.Instance);

    private sealed class SelectedCache(Func<IDrawingListCache> current) : IDrawingListCache
    {
        public Task<List<DrawingFileDto>> GetOrCreateAsync(Guid projectId, Guid version, string search,
            Func<CancellationToken, Task<List<DrawingFileDto>>> load, CancellationToken cancellationToken) =>
            current().GetOrCreateAsync(projectId, version, search, load, cancellationToken);
    }

    private sealed class CacheTestFiles : IFileStorageService
    {
        public Task<(string fileUrl, string storedFileName, long size)> SaveFileAsync(Stream fileStream,
            string originalFileName, string contentType, CancellationToken cancellationToken = default) =>
            Task.FromResult(($"/api/drawings/files/{originalFileName}", originalFileName, fileStream.Length));
        public Task<(Stream stream, string contentType, string fileName)?> GetFileAsync(string storedFileName,
            CancellationToken cancellationToken = default) => Task.FromResult<(Stream, string, string)?>(null);
        public Task<bool> DeleteFileAsync(string storedFileName, CancellationToken cancellationToken = default) => Task.FromResult(true);
    }

    private sealed class RedisScope : IAsyncDisposable
    {
        private readonly ConnectionMultiplexer _connection;
        private readonly string _prefix;
        public RedisDrawingListCache Cache { get; }
        public IDatabase Database => _connection.GetDatabase();
        private RedisScope(ConnectionMultiplexer connection, string endpoint, int ttlSeconds)
        {
            _connection = connection; _prefix = $"construction-tests:{Guid.NewGuid():N}:";
            Cache = NewCache(new RedisCacheOptions
            {
                Enabled = true, ConnectionString = endpoint, KeyPrefix = _prefix,
                DrawingListTtlSeconds = ttlSeconds, TimeoutMilliseconds = 1000
            });
        }
        public static async Task<RedisScope> CreateAsync(int ttlSeconds = 60)
        {
            var endpoint = Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_REDIS")!;
            return new RedisScope(await ConnectionMultiplexer.ConnectAsync(endpoint), endpoint, ttlSeconds);
        }
        public RedisKey[] Keys() => _connection.GetServer(_connection.GetEndPoints()[0]).Keys(pattern: _prefix + "*").ToArray();
        public async ValueTask DisposeAsync()
        {
            foreach (var key in Keys()) await Database.KeyDeleteAsync(key);
            await Cache.DisposeAsync(); await _connection.DisposeAsync();
        }
    }
}
