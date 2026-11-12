using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Features.Inspections.Commands;
using ConstructionProject.Domain.Enums;
using ConstructionProject.UnitTests.TestInfrastructure;
using FluentAssertions;
using Moq;

namespace ConstructionProject.UnitTests.Inspections;

public class CreateInspectionSafetyTests
{
    [Fact]
    public async Task SubmitImmediately_WithEmptyForm_DoesNotCreateInspectionOrWorkflow()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context);
        seed.LinkedItem.LinkedInspectionId = null;
        seed.LinkedItem.LinkedInspection = null;
        await db.Context.SaveChangesAsync();
        var notifications = new Mock<INotificationService>();
        var handler = new CreateInspectionCommandHandler(db.Context, notifications.Object);
        var command = new CreateInspectionCommand(seed.Checklist.Id, seed.LinkedItem.Id, FormDataJson: "{}", SubmitImmediately: true, SubmitterId: seed.Inspection.SubmittedById);

        await FluentActions.Invoking(() => handler.Handle(command, CancellationToken.None)).Should().ThrowAsync<InvalidOperationException>();
        db.Context.InspectionWorkflowOperations.Should().BeEmpty();
    }

    [Theory]
    [InlineData(InspectionStatus.Draft)]
    [InlineData(InspectionStatus.Submitted)]
    [InlineData(InspectionStatus.UnderReview)]
    [InlineData(InspectionStatus.Rejected)]
    public async Task Create_WhenItemAlreadyLinked_DoesNotOverwriteExistingInspection(InspectionStatus status)
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, status);
        var notifications = new Mock<INotificationService>();
        var handler = new CreateInspectionCommandHandler(db.Context, notifications.Object);
        var command = new CreateInspectionCommand(seed.Checklist.Id, seed.LinkedItem.Id, FormDataJson: "{\"changed\":true}", SubmitterId: Guid.NewGuid());

        await FluentActions.Invoking(() => handler.Handle(command, CancellationToken.None)).Should().ThrowAsync<InvalidOperationException>();
    }
}
