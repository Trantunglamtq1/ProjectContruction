using ConstructionProject.Application.Features.Inspections.Queries;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using ConstructionProject.UnitTests.TestInfrastructure;
using FluentAssertions;

namespace ConstructionProject.UnitTests.Inspections;

public class GetInspectionsQueryTests
{
    [Fact]
    public async Task Counts_CoverAllMatchingRows_RegardlessOfPagination()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context);
        foreach (var status in Enum.GetValues<InspectionStatus>())
            db.Context.FormInspections.Add(new FormInspection { ObjectId = seed.Object.Id, Status = status });
        await db.Context.SaveChangesAsync();
        var handler = new GetInspectionsQueryHandler(db.Context, ProjectTestAccess.ForLegacy(db.Context));

        var first = await handler.Handle(new GetInspectionsQuery(PageSize: 2), default);
        var last = await handler.Handle(new GetInspectionsQuery(PageNumber: 4, PageSize: 2), default);

        first.Items.Should().HaveCount(2);
        last.Items.Should().HaveCount(1);
        first.TotalCount.Should().Be(7);
        first.StatusCounts.Should().HaveCount(6);
        first.StatusCounts["Draft"].Should().Be(2);
        first.StatusCounts["UnderReview"].Should().Be(1);
        first.StatusCounts.Values.Sum().Should().Be(first.TotalCount);
        last.StatusCounts.Should().BeEquivalentTo(first.StatusCounts);
    }

    [Fact]
    public async Task Counts_RespectSearchStatusAndResourceFilters_AndEmptyResults()
    {
        using var db = new TestDb();
        var target = InspectionSeed.Create(db.Context, InspectionStatus.Reviewed);
        target.Object.Name = "Target column";
        target.Inspection.ChecklistItemId = target.LinkedItem.Id;
        InspectionSeed.Create(db.Context, InspectionStatus.Approved);
        await db.Context.SaveChangesAsync();
        var handler = new GetInspectionsQueryHandler(db.Context, ProjectTestAccess.ForLegacy(db.Context));
        var query = new GetInspectionsQuery(ObjectId: target.Object.Id, DrawingFileId: target.Drawing.Id,
            ChecklistId: target.Checklist.Id, ChecklistItemId: target.LinkedItem.Id,
            Status: InspectionStatus.Reviewed, Search: " TARGET ");

        var result = await handler.Handle(query, default);
        result.Items.Should().ContainSingle(x => x.Id == target.Inspection.Id);
        result.TotalCount.Should().Be(1);
        result.StatusCounts["Reviewed"].Should().Be(1);
        result.StatusCounts["Approved"].Should().Be(0);

        var empty = await handler.Handle(query with { Status = InspectionStatus.Approved }, default);
        empty.Items.Should().BeEmpty();
        empty.TotalCount.Should().Be(0);
        empty.StatusCounts.Should().HaveCount(6).And.OnlyContain(x => x.Value == 0);
    }

    [Theory]
    [InlineData("A1B2C3D4")]
    [InlineData("  #a1b2c3d4  ")]
    [InlineData("A1B2C3D4-1234-5678-90AB-1234567890AB")]
    [InlineData("#A1B2C3D41234567890AB1234567890AB")]
    public async Task Search_AcceptsDisplayedCodeAndFullId(string search)
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context);
        var target = new FormInspection
        {
            Id = Guid.Parse("a1b2c3d4-1234-5678-90ab-1234567890ab"),
            ObjectId = seed.Object.Id,
        };
        db.Context.FormInspections.Add(target);
        await db.Context.SaveChangesAsync();

        var result = await new GetInspectionsQueryHandler(db.Context, ProjectTestAccess.ForLegacy(db.Context))
            .Handle(new GetInspectionsQuery(Search: search), default);

        result.Items.Should().ContainSingle(x => x.Id == target.Id);
        result.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task ShortCode_ReturnsAllCollisions_AndStillRespectsStatus()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context);
        db.Context.FormInspections.AddRange(
            new FormInspection { Id = Guid.Parse("a1b2c3d4-0000-0000-0000-000000000001"), ObjectId = seed.Object.Id },
            new FormInspection { Id = Guid.Parse("a1b2c3d4-0000-0000-0000-000000000002"), ObjectId = seed.Object.Id, Status = InspectionStatus.Approved });
        await db.Context.SaveChangesAsync();
        var handler = new GetInspectionsQueryHandler(db.Context, ProjectTestAccess.ForLegacy(db.Context));

        var all = await handler.Handle(new GetInspectionsQuery(Search: "#A1B2C3D4"), default);
        var approved = await handler.Handle(new GetInspectionsQuery(Search: "#A1B2C3D4", Status: InspectionStatus.Approved), default);

        all.TotalCount.Should().Be(2);
        approved.Items.Should().ContainSingle(x => x.Status == "Approved");
        approved.StatusCounts["Draft"].Should().Be(0);
    }

    [Theory]
    [InlineData("Cột C12")]
    [InlineData("Kỹ sư hiện trường")]
    [InlineData("BAN-VE-TANG-3.PDF")]
    public async Task Search_PreservesExistingTextMatches(string search)
    {
        using var db = new TestDb();
        var target = InspectionSeed.Create(db.Context);
        var result = await new GetInspectionsQueryHandler(db.Context, ProjectTestAccess.ForLegacy(db.Context))
            .Handle(new GetInspectionsQuery(Search: search), default);

        result.Items.Should().ContainSingle(x => x.Id == target.Inspection.Id);
    }
}
