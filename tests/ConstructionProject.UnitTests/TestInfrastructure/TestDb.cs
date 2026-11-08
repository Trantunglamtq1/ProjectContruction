using ConstructionProject.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.UnitTests.TestInfrastructure;

/// <summary>
/// Mỗi test có một database in-memory riêng. Dùng EF InMemory để handler test
/// không phụ thuộc SQL Server/Docker và không bị ảnh hưởng bởi các column type
/// đặc thù của SQL Server (nvarchar(max), rowversion...).
/// </summary>
public sealed class TestDb : IDisposable
{
    public ApplicationDbContext Context { get; }

    public TestDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"unit-tests-{Guid.NewGuid()}")
            .Options;

        Context = new ApplicationDbContext(options);
        Context.Database.EnsureCreated();
    }

    public void Dispose() => Context.Dispose();
}
