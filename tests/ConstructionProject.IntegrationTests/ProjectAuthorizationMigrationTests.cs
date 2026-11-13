using ConstructionProject.Domain.Entities;
using ConstructionProject.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace ConstructionProject.IntegrationTests;

public sealed class ProjectAuthorizationMigrationTests
{
    private static ApplicationDbContext NewDatabase()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_ProjectAuth_{Guid.NewGuid():N}", TrustServerCertificate = true
        };
        return new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection.ConnectionString).Options);
    }

    [SqlServerFact]
    public async Task FreshSchema_SeedsOnlyLegacyProject_NoMembers_AndRejectsDuplicateMembership()
    {
        await using var db = NewDatabase();
        await db.Database.MigrateAsync();
        Assert.Equal("LEGACY", (await db.Projects.SingleAsync(p => p.Id == Project.LegacyId)).Code);
        Assert.Empty(await db.ProjectMembers.ToListAsync());
        db.ProjectMembers.Add(new ProjectMember { ProjectId = Project.LegacyId, UserId = ConstructionProject.Domain.Constants.RoleConstants.DefaultAdminUserId });
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        db.ProjectMembers.Add(new ProjectMember { ProjectId = Project.LegacyId, UserId = ConstructionProject.Domain.Constants.RoleConstants.DefaultAdminUserId });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }

    [SqlServerFact]
    public async Task LegacyDrawingInspectionAttachmentAndHistory_ArePreserved_WithoutAutomaticAccess()
    {
        await using var db = NewDatabase();
        await db.GetService<IMigrator>().MigrateAsync("20261024083332_AddNotificationsTable");
        var drawing = Guid.NewGuid(); var obj = Guid.NewGuid(); var inspection = Guid.NewGuid();
        var history = Guid.NewGuid(); var notification = Guid.NewGuid();
        var payload = "{\"attachments\":[{\"storedFileName\":\"legacy-proof.pdf\",\"originalName\":\"proof.pdf\",\"contentType\":\"application/pdf\",\"size\":42}]}";
        await db.Database.ExecuteSqlInterpolatedAsync($@"
INSERT INTO DrawingFiles (Id,FileName,StoredFileName,FileType,FileUrl,FileSizeBytes,UploadedBy,UploadedAt)
VALUES ({drawing},'legacy.pdf','legacy.pdf','pdf','/api/drawings/files/legacy.pdf',42,'legacy',{DateTime.UtcNow});
INSERT INTO Objects (Id,DrawingFileId,PageNumber,MarkerCoordinates,Name,CreatedBy,CreatedAt)
VALUES ({obj},{drawing},1,'{{}}','Legacy object','legacy',{DateTime.UtcNow});
INSERT INTO FormInspections (Id,ObjectId,FormSchemaId,FormDataJson,Status,CreatedAt)
VALUES ({inspection},{obj},'default-inspection-schema',{payload},'Draft',{DateTime.UtcNow});
INSERT INTO InspectionAuditHistories (Id,InspectionId,FromStatus,ToStatus,Action,ActorName,CreatedAt)
VALUES ({history},{inspection},'Draft','Draft','CreateDraft','legacy',{DateTime.UtcNow});
INSERT INTO Notifications (Id,Title,Content,Type,ReferenceId,ReferenceType,IsRead,CreatedAt)
VALUES ({notification},'Legacy','legacy','info',{inspection.ToString()},'Inspection',0,{DateTime.UtcNow});");
        await db.Database.MigrateAsync();
        Assert.Equal(Project.LegacyId, (await db.DrawingFiles.SingleAsync(d => d.Id == drawing)).ProjectId);
        Assert.Equal(payload, (await db.FormInspections.SingleAsync(i => i.Id == inspection)).FormDataJson);
        Assert.True(await db.InspectionAuditHistories.AnyAsync(h => h.Id == history));
        Assert.Equal(Project.LegacyId, (await db.ProjectAttachments.SingleAsync(a => a.StoredFileName == "legacy-proof.pdf")).ProjectId);
        Assert.Equal(Project.LegacyId, (await db.Notifications.SingleAsync(n => n.Id == notification)).ProjectId);
        Assert.Empty(await db.ProjectMembers.ToListAsync());
    }
}
