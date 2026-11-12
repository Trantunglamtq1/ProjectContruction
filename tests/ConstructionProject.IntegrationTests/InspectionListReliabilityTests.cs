using System.Net.Http.Json;
using ConstructionProject.Application.DTOs;
using ConstructionProject.Application.Features.Inspections.Queries;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using ConstructionProject.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ConstructionProject.IntegrationTests;

public class InspectionListReliabilityTests
{
    [Theory]
    [InlineData("submitter")]
    [InlineData("reviewer")]
    [InlineData("approver")]
    public async Task DisplayedCodeSearch_WorksForEveryInspectionRole(string role)
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateSeededClient();
        using (var scope = factory.Services.CreateScope())
            await InspectionListTestData.SeedAsync(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
        ApiFactory.Authorize(client, await factory.LoginAsync(client, role));

        var result = await client.GetFromJsonAsync<InspectionListResult>(
            "/api/inspections?search=%20%23A1B2C3D4%20&pageSize=1");

        result!.Items.Should().HaveCount(1);
        result.TotalCount.Should().Be(2);
        result.StatusCounts["Draft"].Should().Be(1);
        result.StatusCounts["Submitted"].Should().Be(1);
        result.StatusCounts.Values.Sum().Should().Be(2);
    }

    [Fact]
    public async Task PageNumberAndLegacyPage_ReturnDifferentPagesWithSameWholeResultCounts()
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateSeededClient();
        using (var scope = factory.Services.CreateScope())
            await InspectionListTestData.SeedAsync(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
        ApiFactory.Authorize(client, await factory.LoginAsync(client, "submitter"));

        var first = (await client.GetFromJsonAsync<InspectionListResult>("/api/inspections?pageNumber=1&pageSize=2"))!;
        var second = (await client.GetFromJsonAsync<InspectionListResult>("/api/inspections?pageNumber=2&pageSize=2"))!;
        var legacy = (await client.GetFromJsonAsync<InspectionListResult>("/api/inspections?page=2&pageSize=2"))!;
        var both = (await client.GetFromJsonAsync<InspectionListResult>("/api/inspections?page=1&pageNumber=2&pageSize=2"))!;

        first.TotalCount.Should().Be(14);
        first.Items.Select(x => x.Id).Should().NotIntersectWith(second.Items.Select(x => x.Id));
        second.PageNumber.Should().Be(2);
        second.HasPreviousPage.Should().BeTrue();
        legacy.Items.Select(x => x.Id).Should().Equal(second.Items.Select(x => x.Id));
        both.Items.Select(x => x.Id).Should().Equal(second.Items.Select(x => x.Id));
        second.StatusCounts.Should().BeEquivalentTo(first.StatusCounts);
        first.StatusCounts["Draft"].Should().Be(3);
        first.StatusCounts["UnderReview"].Should().Be(2);
        first.StatusCounts.Values.Sum().Should().Be(first.TotalCount);
    }

    [Fact]
    public async Task CountsFollowFilters_EvenWhenRequestedPageIsEmpty()
    {
        await using var factory = new ApiFactory();
        using var client = factory.CreateSeededClient();
        using (var scope = factory.Services.CreateScope())
            await InspectionListTestData.SeedAsync(scope.ServiceProvider.GetRequiredService<ApplicationDbContext>());
        ApiFactory.Authorize(client, await factory.LoginAsync(client, "reviewer"));

        var result = (await client.GetFromJsonAsync<InspectionListResult>(
            "/api/inspections?search=Target&status=Draft&pageNumber=99&pageSize=1"))!;
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(3);
        result.StatusCounts["Draft"].Should().Be(3);
        result.StatusCounts.Values.Sum().Should().Be(3);

        var empty = (await client.GetFromJsonAsync<InspectionListResult>("/api/inspections?search=not-found"))!;
        empty.TotalCount.Should().Be(0);
        empty.StatusCounts.Should().HaveCount(6).And.OnlyContain(x => x.Value == 0);
    }

    [SqlServerFact]
    public async Task CountsAndCodeSearch_ExecuteOnSqlServerBeforePagination()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("CONSTRUCTION_TEST_SQL"))
        {
            InitialCatalog = $"ConstructionProject_Test_{Guid.NewGuid():N}",
            TrustServerCertificate = true,
        };
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlServer(connection.ConnectionString).Options;
        await using var db = new ApplicationDbContext(options);
        await db.Database.MigrateAsync();
        await InspectionListTestData.SeedAsync(db);
        var handler = new GetInspectionsQueryHandler(db);

        var first = await handler.Handle(new GetInspectionsQuery(PageSize: 2), default);
        var last = await handler.Handle(new GetInspectionsQuery(PageNumber: 7, PageSize: 2), default);
        first.TotalCount.Should().Be(14);
        first.StatusCounts["Draft"].Should().Be(3);
        first.StatusCounts["UnderReview"].Should().Be(2);
        first.StatusCounts.Values.Sum().Should().Be(first.TotalCount);
        last.StatusCounts.Should().BeEquivalentTo(first.StatusCounts);
        last.Items.Should().HaveCount(2);

        foreach (var search in new[] { "A1B2C3D4", " #a1b2c3d4 " })
        {
            var result = await handler.Handle(new GetInspectionsQuery(Search: search, PageSize: 1), default);
            result.TotalCount.Should().Be(2);
            result.Items.Should().ContainSingle();
        }
        var fullId = await handler.Handle(new GetInspectionsQuery(Search: "#A1B2C3D4-0000-0000-0000-000000000001"), default);
        fullId.Items.Should().ContainSingle(x => x.Id == InspectionListTestData.FirstId);
        var compactId = await handler.Handle(new GetInspectionsQuery(Search: InspectionListTestData.FirstId.ToString("N")), default);
        compactId.Items.Should().ContainSingle(x => x.Id == InspectionListTestData.FirstId);
        var filtered = await handler.Handle(new GetInspectionsQuery(Search: "#A1B2C3D4", Status: InspectionStatus.Submitted), default);
        filtered.TotalCount.Should().Be(1);
        filtered.StatusCounts["Draft"].Should().Be(0);
        var byObject = await handler.Handle(new GetInspectionsQuery(Search: "TARGET"), default);
        byObject.TotalCount.Should().Be(13);
        var byPerson = await handler.Handle(new GetInspectionsQuery(Search: "ENGINEER MAIN"), default);
        byPerson.TotalCount.Should().Be(13);
        var byDrawing = await handler.Handle(new GetInspectionsQuery(Search: "RELIABILITY.PDF"), default);
        byDrawing.TotalCount.Should().Be(14);
        var empty = await handler.Handle(new GetInspectionsQuery(Search: "not-found"), default);
        empty.TotalCount.Should().Be(0);
        empty.StatusCounts.Should().HaveCount(6).And.OnlyContain(x => x.Value == 0);
    }
}

internal static class InspectionListTestData
{
    internal static readonly Guid FirstId = Guid.Parse("a1b2c3d4-0000-0000-0000-000000000001");

    internal static async Task SeedAsync(ApplicationDbContext db)
    {
        var drawing = new DrawingFile
        {
            FileName = "reliability.pdf", StoredFileName = "reliability.pdf", FileType = "pdf",
            FileUrl = "/uploads/reliability.pdf", UploadedBy = "test",
        };
        var target = new ConstructionObject { DrawingFile = drawing, Name = "Target column", CreatedBy = "test" };
        var other = new ConstructionObject { DrawingFile = drawing, Name = "Other beam", CreatedBy = "test" };
        db.Objects.AddRange(target, other);
        for (var i = 0; i < 13; i++)
        {
            db.FormInspections.Add(new FormInspection
            {
                Id = i == 0 ? FirstId : i == 1 ? Guid.Parse("a1b2c3d4-0000-0000-0000-000000000002") : Guid.NewGuid(),
                Object = target, Status = (InspectionStatus)(1 + i % 6),
                SubmittedBy = "Engineer main", CreatedAt = new DateTime(2026, 11, 12, 0, 0, i, DateTimeKind.Utc),
            });
        }
        db.FormInspections.Add(new FormInspection { Object = other, Status = InspectionStatus.Approved });
        await db.SaveChangesAsync();
    }
}
