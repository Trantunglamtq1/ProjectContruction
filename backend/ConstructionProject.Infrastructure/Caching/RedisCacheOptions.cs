namespace ConstructionProject.Infrastructure.Caching;

public sealed class RedisCacheOptions
{
    public const string SectionName = "Redis";
    public bool Enabled { get; set; }
    public string ConnectionString { get; set; } = string.Empty;
    public string KeyPrefix { get; set; } = "construction:";
    public int DrawingListTtlSeconds { get; set; } = 60;
    public int TimeoutMilliseconds { get; set; } = 500;
}
