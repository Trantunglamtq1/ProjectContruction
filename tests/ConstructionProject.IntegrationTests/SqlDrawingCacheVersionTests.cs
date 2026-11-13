using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ConstructionProject.IntegrationTests;

public class SqlDrawingCacheVersionTests
{
    [SqlServerFact]
    public async Task AdditiveMigrationPreservesDataAndVersionRollsBackWithMutation()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        { InitialCatalog = $"ConstructionProject_Test_RedisVersion_{Guid.NewGuid():N}", TrustServerCertificate = true };
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection.ConnectionString).Options;
        await using var db = new ApplicationDbContext(options);
        try
        {
            await db.GetService<IMigrator>().MigrateAsync("20261112181110_AddProjectAuthorization");
            var drawingId = Guid.NewGuid();
            await db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO DrawingFiles (Id, ProjectId, FileName, StoredFileName, FileType, FileUrl, FileSizeBytes, UploadedBy, UploadedAt)
VALUES ({drawingId}, {Project.LegacyId}, 'preserved.pdf', 'preserved.pdf', 'pdf', '/preserved.pdf', 10, 'test', {DateTime.UtcNow})");
            await db.Database.MigrateAsync();
            Assert.Equal("preserved.pdf", (await db.DrawingFiles.SingleAsync()).FileName);
            Assert.Equal(Guid.Empty, (await db.Projects.SingleAsync()).DrawingListCacheVersion);
            await using (var transaction = await db.Database.BeginTransactionAsync())
            {
                db.Objects.Add(new ConstructionObject { DrawingFileId = drawingId, Name = "rollback" });
                await db.SaveChangesAsync();
                Assert.NotEqual(Guid.Empty, (await db.Projects.SingleAsync()).DrawingListCacheVersion);
                await transaction.RollbackAsync();
            }
            db.ChangeTracker.Clear();
            Assert.Empty(await db.Objects.ToListAsync());
            Assert.Equal(Guid.Empty, (await db.Projects.SingleAsync()).DrawingListCacheVersion);

            db.Objects.Add(new ConstructionObject { DrawingFileId = drawingId, Name = "committed" });
            await db.SaveChangesAsync();
            var version = (await db.Projects.SingleAsync()).DrawingListCacheVersion;
            Assert.NotEqual(Guid.Empty, version);
            // Fresh context proves durability, not merely change-tracker state.
            await using var fresh = new ApplicationDbContext(options);
            Assert.Equal(version, (await fresh.Projects.SingleAsync()).DrawingListCacheVersion);
            fresh.Objects.Remove(await fresh.Objects.SingleAsync());
            fresh.SaveChanges();
            Assert.NotEqual(version, (await fresh.Projects.SingleAsync()).DrawingListCacheVersion);
        }
        finally { await db.Database.EnsureDeletedAsync(); }
    }
}
