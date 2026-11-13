using ConstructionProject.Domain.Entities;
using ConstructionProject.UnitTests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConstructionProject.UnitTests;

public class DrawingCacheVersionTests
{
    [Fact]
    public async Task DrawingAndObjectChangesRotateOnlyTheirProjectIncludingSynchronousSaves()
    {
        using var test = new TestDb();
        var db = test.Context;
        var a = new Project { Code = "A", Name = "A" };
        var b = new Project { Code = "B", Name = "B" };
        db.Projects.AddRange(a, b);
        await db.SaveChangesAsync();
        var initial = a.DrawingListCacheVersion;
        var drawing = new DrawingFile { ProjectId = a.Id, FileName = "a.pdf" };
        db.DrawingFiles.Add(drawing);
        await db.SaveChangesAsync();
        Assert.NotEqual(initial, a.DrawingListCacheVersion);
        Assert.Equal(Guid.Empty, b.DrawingListCacheVersion);
        var uploaded = a.DrawingListCacheVersion;
        var obj = new ConstructionObject { DrawingFileId = drawing.Id, Name = "Column" };
        db.Objects.Add(obj);
        db.SaveChanges();
        Assert.NotEqual(uploaded, a.DrawingListCacheVersion);
        var added = a.DrawingListCacheVersion;
        db.Objects.Remove(obj);
        await db.SaveChangesAsync();
        Assert.NotEqual(added, a.DrawingListCacheVersion);
        var removed = a.DrawingListCacheVersion;
        db.DrawingFiles.Remove(drawing);
        db.SaveChanges();
        Assert.NotEqual(removed, a.DrawingListCacheVersion);
        var deleted = a.DrawingListCacheVersion;
        a.Name = "Renamed project";
        await db.SaveChangesAsync();
        Assert.Equal(deleted, a.DrawingListCacheVersion);
    }

    [Fact]
    public async Task MovingAnObjectInvalidatesBothOriginalAndNewProjectsAfterReload()
    {
        using var test = new TestDb();
        var db = test.Context;
        var a = new Project { Code = "A", Name = "A" };
        var b = new Project { Code = "B", Name = "B" };
        var da = new DrawingFile { ProjectId = a.Id, FileName = "a.pdf" };
        var dbb = new DrawingFile { ProjectId = b.Id, FileName = "b.pdf" };
        var obj = new ConstructionObject { DrawingFileId = da.Id, Name = "Column" };
        db.AddRange(a, b, da, dbb, obj);
        await db.SaveChangesAsync();
        var beforeA = a.DrawingListCacheVersion;
        var beforeB = b.DrawingListCacheVersion;
        db.ChangeTracker.Clear();
        obj = await db.Objects.SingleAsync(o => o.Id == obj.Id);
        obj.DrawingFileId = dbb.Id;
        await db.SaveChangesAsync();
        Assert.NotEqual(beforeA, (await db.Projects.FindAsync(a.Id))!.DrawingListCacheVersion);
        Assert.NotEqual(beforeB, (await db.Projects.FindAsync(b.Id))!.DrawingListCacheVersion);
    }
}
