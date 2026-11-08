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
    private readonly Mock<IInspectionWorkflowService> _workflow = new();
    private readonly Mock<INotificationService> _notifications = new();

    public SubmitInspectionCommandTests()
    {
        _workflow
            .Setup(w => w.StartApprovalWorkflowAsync(It.IsAny<Guid>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync("wf-test-001");
    }

    [Fact]
    public async Task Handle_WhenDraft_TransitionsToSubmitted_AndCreatesAuditAndNotifiesReviewer()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context);

        var handler = new SubmitInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);
        var result = await handler.Handle(
            new SubmitInspectionCommand(seed.Inspection.Id, "{\"ketQua\":\"Dat\"}", seed.Inspection.SubmittedById, "Kỹ sư A"),
            CancellationToken.None);

        result.Status.Should().Be(InspectionStatus.Submitted.ToString());
        result.SubmittedAt.Should().NotBeNull();
        result.WorkflowInstanceId.Should().Be("wf-test-001");

        var stored = await db.Context.FormInspections.SingleAsync(i => i.Id == seed.Inspection.Id);
        stored.Status.Should().Be(InspectionStatus.Submitted);
        stored.RejectReason.Should().BeNull();

        var history = await db.Context.InspectionAuditHistories.SingleAsync(h => h.InspectionId == seed.Inspection.Id);
        history.Action.Should().Be("Submit");
        history.FromStatus.Should().Be(InspectionStatus.Draft);
        history.ToStatus.Should().Be(InspectionStatus.Submitted);

        _workflow.Verify(
            w => w.StartApprovalWorkflowAsync(seed.Inspection.Id, It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Once);
        _notifications.Verify(
            n => n.SendNotificationToRoleAsync("Reviewer", It.IsAny<NotificationMessage>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_WhenRejected_Resubmits_AndClearsRejectReason()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Rejected);
        seed.Inspection.RejectReason = "Thiếu ảnh hiện trường";
        await db.Context.SaveChangesAsync();

        var handler = new SubmitInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);
        var result = await handler.Handle(
            new SubmitInspectionCommand(seed.Inspection.Id, "{\"ketQua\":\"Dat\"}", null, "Kỹ sư A"),
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

        var handler = new SubmitInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);

        var act = () => handler.Handle(
            new SubmitInspectionCommand(seed.Inspection.Id, "{\"ketQua\":\"Dat\"}", null, null),
            CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Submitted*");
    }

    [Fact]
    public async Task Handle_WhenFormDataIsEmpty_ThrowsInvalidOperation_AndKeepsDraftStatus()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context);

        var handler = new SubmitInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);

        var act = () => handler.Handle(
            new SubmitInspectionCommand(seed.Inspection.Id, "{}", null, null),
            CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*rỗng*");

        var stored = await db.Context.FormInspections.SingleAsync(i => i.Id == seed.Inspection.Id);
        stored.Status.Should().Be(InspectionStatus.Draft);
        _workflow.Verify(
            w => w.StartApprovalWorkflowAsync(It.IsAny<Guid>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_WhenInspectionDoesNotExist_ThrowsKeyNotFound()
    {
        using var db = new TestDb();
        var handler = new SubmitInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);

        var act = () => handler.Handle(
            new SubmitInspectionCommand(Guid.NewGuid(), "{\"ketQua\":\"Dat\"}", null, null),
            CancellationToken.None);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }
}
