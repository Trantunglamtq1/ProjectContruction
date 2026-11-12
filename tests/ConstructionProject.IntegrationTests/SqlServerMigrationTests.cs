using System.Data;
using ConstructionProject.Infrastructure.Persistence;
using ConstructionProject.Domain.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ConstructionProject.IntegrationTests;

/// <summary>
/// Opt-in SQL Server tests. Each run creates a uniquely named database and never drops it.
/// Set CONSTRUCTION_TEST_SQL to a connection string with permission to create databases.
/// Do not point tests at a production server.
/// </summary>
public sealed class SqlServerMigrationTests
{
    private const string LegacyMigration = "20261024083332_AddNotificationsTable";

    [SqlServerFact]
    public async Task ExistingInspection_SurvivesMigration_AndReceivesRowVersion()
    {
        var options = CreateOptions();
        await using var db = new ApplicationDbContext(options);
        await db.GetService<IMigrator>().MigrateAsync(LegacyMigration);

        var drawingId = Guid.NewGuid();
        var objectId = Guid.NewGuid();
        var inspectionId = Guid.NewGuid();
        await db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO DrawingFiles (Id, FileName, StoredFileName, FileType, FileUrl, FileSizeBytes, UploadedBy, UploadedAt)
VALUES ({drawingId}, 'legacy.pdf', 'stored.pdf', 'pdf', '/legacy.pdf', {1L}, 'test', {DateTime.UtcNow});
INSERT INTO Objects (Id, DrawingFileId, PageNumber, MarkerCoordinates, Name, CreatedBy, CreatedAt)
VALUES ({objectId}, {drawingId}, {1}, '{{}}', 'C01', 'test', {DateTime.UtcNow});
INSERT INTO FormInspections (Id, ObjectId, FormSchemaId, FormDataJson, Status, WorkflowInstanceId, CreatedAt)
VALUES ({inspectionId}, {objectId}, 'default-inspection-schema', '{{}}', 'Submitted', 'legacy-instance', {DateTime.UtcNow});");

        await db.Database.MigrateAsync();
        await using var connection = new SqlConnection(db.Database.GetConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT Status, WorkflowInstanceId, RowVersion FROM FormInspections WHERE Id = @id";
        command.Parameters.Add(new SqlParameter("@id", SqlDbType.UniqueIdentifier) { Value = inspectionId });
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.Equal("Submitted", reader.GetString(0));
        Assert.True(reader.IsDBNull(1));
        Assert.Equal(8, ((byte[])reader.GetValue(2)).Length);
        await reader.DisposeAsync();
        await connection.CloseAsync();

        await using var first = new ApplicationDbContext(options);
        await using var second = new ApplicationDbContext(options);
        var firstCopy = await first.FormInspections.SingleAsync(x => x.Id == inspectionId);
        var secondCopy = await second.FormInspections.SingleAsync(x => x.Id == inspectionId);
        firstCopy.FormDataJson = "{\"version\":1}";
        secondCopy.FormDataJson = "{\"version\":2}";
        await first.SaveChangesAsync();
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());

        var recovery = await first.InspectionWorkflowOperations.SingleAsync(x => x.InspectionId == inspectionId);
        Assert.Equal("legacy-instance", recovery.PreviousInstanceId);
        Assert.Equal("RecoverReviewer", recovery.Action);
        Assert.Null(recovery.CompletedAt);
        recovery.CompletedAt = DateTime.UtcNow;
        await first.SaveChangesAsync();

        first.InspectionWorkflowOperations.Add(new InspectionWorkflowOperation
        {
            InspectionId = inspectionId, InstanceId = "test-instance", Action = "Start"
        });
        await first.SaveChangesAsync();
        await using var competing = new ApplicationDbContext(options);
        competing.InspectionWorkflowOperations.Add(new InspectionWorkflowOperation
        {
            InspectionId = inspectionId, InstanceId = "another-instance", Action = "Start"
        });
        await Assert.ThrowsAsync<DbUpdateException>(() => competing.SaveChangesAsync());
    }

    [SqlServerFact]
    public async Task NewDatabase_AllMigrationsCreateInspectionRowVersion()
    {
        await using var db = new ApplicationDbContext(CreateOptions());
        await db.Database.MigrateAsync();
        await using var connection = new SqlConnection(db.Database.GetConnectionString());
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.FormInspections') AND name = 'RowVersion' AND system_type_id = 189";
        Assert.Equal(1, (int)(await command.ExecuteScalarAsync())!);
    }
    private static DbContextOptions<ApplicationDbContext> CreateOptions()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}",
            TrustServerCertificate = true
        };
        return new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection.ConnectionString).Options;
    }
}

public sealed class SqlServerFactAttribute : FactAttribute
{
    public SqlServerFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL")))
            Skip = "Set CONSTRUCTION_TEST_SQL to opt in to isolated SQL Server migration tests.";
    }
}
