using ConstructionProject.Application.Features.Inspections.Commands;
using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using ConstructionProject.UnitTests.TestInfrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ConstructionProject.UnitTests.Inspections;

public class SubmitInspectionCommandTests
{
    private readonly Mock<INotificationService> _notifications = new();

    [Fact]
    public async Task Submit_RecordsWorkflowIntentWithBusinessChange_WithoutStartingElsaInRequest()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context);
        var handler = new SubmitInspectionCommandHandler(db.Context, _notifications.Object);
        var result = await handler.Handle(new SubmitInspectionCommand(seed.Inspection.Id, "{\"value\":1}", seed.Inspection.SubmittedById, "Submitter", seed.Inspection.RowVersion), CancellationToken.None);
        result.Status.Should().Be(InspectionStatus.Submitted.ToString());
        result.WorkflowInstanceId.Should().BeNull();
        var operation = await db.Context.InspectionWorkflowOperations.SingleAsync(x => x.InspectionId == seed.Inspection.Id);
        operation.Action.Should().Be("Start");
        operation.CompletedAt.Should().BeNull();
    }
    [Fact]
    public async Task Handle_WhenDraft_TransitionsToSubmitted_AndCreatesAuditAndNotifiesReviewer()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context);

        var handler = new SubmitInspectionCommandHandler(db.Context, _notifications.Object);
        var result = await handler.Handle(
            new SubmitInspectionCommand(seed.Inspection.Id, "{\"ketQua\":\"Dat\"}", seed.Inspection.SubmittedById, "Kỹ sư A", seed.Inspection.RowVersion),
            CancellationToken.None);

        result.Status.Should().Be(InspectionStatus.Submitted.ToString());
        result.SubmittedAt.Should().NotBeNull();
        result.WorkflowInstanceId.Should().BeNull();
        result.WorkflowSyncStatus.Should().Be("Pending");

        var stored = await db.Context.FormInspections.SingleAsync(i => i.Id == seed.Inspection.Id);
        stored.Status.Should().Be(InspectionStatus.Submitted);
        stored.RejectReason.Should().BeNull();

        var history = await db.Context.InspectionAuditHistories.SingleAsync(h => h.InspectionId == seed.Inspection.Id);
        history.Action.Should().Be("Submit");
        history.FromStatus.Should().Be(InspectionStatus.Draft);
        history.ToStatus.Should().Be(InspectionStatus.Submitted);

        (await db.Context.InspectionWorkflowOperations.SingleAsync(x => x.InspectionId == seed.Inspection.Id)).Action.Should().Be("Start");
        _notifications.Verify(
            n => n.SendNotificationToRoleAsync("Reviewer", It.IsAny<NotificationMessage>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_WhenPreviousOperationPending_DoesNotPersistSubmission()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context);
        db.Context.InspectionWorkflowOperations.Add(new InspectionWorkflowOperation { InspectionId = seed.Inspection.Id, InstanceId = "pending", Action = "Start" });
        await db.Context.SaveChangesAsync();
        var handler = new SubmitInspectionCommandHandler(db.Context, _notifications.Object);
        var action = () => handler.Handle(new SubmitInspectionCommand(seed.Inspection.Id, "{\"value\":1}", seed.Inspection.SubmittedById, "Submitter", seed.Inspection.RowVersion), CancellationToken.None);
        await action.Should().ThrowAsync<InvalidOperationException>();
        var saved = await db.Context.FormInspections.AsNoTracking().SingleAsync(x => x.Id == seed.Inspection.Id);
        saved.Status.Should().Be(InspectionStatus.Draft);
        (await db.Context.InspectionAuditHistories.CountAsync()).Should().Be(0);
    }
    [Fact]
    public async Task Handle_WhenAnotherSubmitterAttemptsSubmission_IsForbidden()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context);
        var handler = new SubmitInspectionCommandHandler(db.Context, _notifications.Object);
        var action = () => handler.Handle(new SubmitInspectionCommand(seed.Inspection.Id, "{\"value\":1}", Guid.NewGuid(), "Other", seed.Inspection.RowVersion), CancellationToken.None);
        await action.Should().ThrowAsync<ConstructionProject.Application.Common.Exceptions.ForbiddenAccessException>();
        (await db.Context.InspectionWorkflowOperations.CountAsync()).Should().Be(0);
    }
    [Fact]
    public async Task Handle_WhenRejected_Resubmits_AndClearsRejectReason()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Rejected);
        seed.Inspection.RejectReason = "Thiếu ảnh hiện trường";
        await db.Context.SaveChangesAsync();

        var handler = new SubmitInspectionCommandHandler(db.Context, _notifications.Object);
        var result = await handler.Handle(
            new SubmitInspectionCommand(seed.Inspection.Id, "{\"ketQua\":\"Dat\"}", seed.Inspection.SubmittedById, "Kỹ sư A", seed.Inspection.RowVersion),
            CancellationToken.None);

        result.Status.Should().Be(InspectionStatus.Submitted.ToString());
        result.RejectReason.Should().BeNull();

        var history = await db.Context.InspectionAuditHistories.SingleAsync(h => h.InspectionId == seed.Inspection.Id);
        history.Action.Should().Be("Resubmit");
        history.FromStatus.Should().Be(InspectionStatus.Rejected);
    }

    [Fact]
    public async Task Handle_WhenAlreadySubmitted_ThrowsInvalidOperation()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Submitted);

        var handler = new SubmitInspectionCommandHandler(db.Context, _notifications.Object);

        var act = () => handler.Handle(
            new SubmitInspectionCommand(seed.Inspection.Id, "{\"ketQua\":\"Dat\"}", null, null, seed.Inspection.RowVersion),
            CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Submitted*");
    }

    [Fact]
    public async Task Handle_WhenFormDataIsEmpty_ThrowsInvalidOperation_AndKeepsDraftStatus()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context);

        var handler = new SubmitInspectionCommandHandler(db.Context, _notifications.Object);

        var act = () => handler.Handle(
            new SubmitInspectionCommand(seed.Inspection.Id, "{}", seed.Inspection.SubmittedById, null, seed.Inspection.RowVersion),
            CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*rỗng*");

        var stored = await db.Context.FormInspections.SingleAsync(i => i.Id == seed.Inspection.Id);
        stored.Status.Should().Be(InspectionStatus.Draft);
        (await db.Context.InspectionWorkflowOperations.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Handle_WhenInspectionDoesNotExist_ThrowsKeyNotFound()
    {
        using var db = new TestDb();
        var handler = new SubmitInspectionCommandHandler(db.Context, _notifications.Object);

        var act = () => handler.Handle(
            new SubmitInspectionCommand(Guid.NewGuid(), "{\"ketQua\":\"Dat\"}", null, null),
            CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }
}
