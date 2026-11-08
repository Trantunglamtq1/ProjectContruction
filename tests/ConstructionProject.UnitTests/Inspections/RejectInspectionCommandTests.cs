using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Features.Inspections.Commands;
using ConstructionProject.Domain.Enums;
using ConstructionProject.UnitTests.TestInfrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ConstructionProject.UnitTests.Inspections;

public class RejectInspectionCommandTests
{
    private readonly Mock<IInspectionWorkflowService> _workflow = new();
    private readonly Mock<INotificationService> _notifications = new();

    [Fact]
    public async Task Reject_WhenReviewed_ResumesApproverBookmark_AndNotifiesSubmitter()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Reviewed);

        var handler = new RejectInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);
        var approverId = Guid.NewGuid();

        var result = await handler.Handle(
            new RejectInspectionCommand(seed.Inspection.Id, "Hồ sơ thiếu biên bản", approverId, "CĐT C", "Approver"),
            CancellationToken.None);

        result.Status.Should().Be(InspectionStatus.Rejected.ToString());
        result.RejectReason.Should().Be("Hồ sơ thiếu biên bản");

        var history = await db.Context.InspectionAuditHistories.SingleAsync(h => h.InspectionId == seed.Inspection.Id);
        history.Action.Should().Be("Reject");
        history.ActorRole.Should().Be("Approver");

        _workflow.Verify(
            w => w.ResumeApproverBookmarkAsync("wf-test-001", false, "CĐT C", "Hồ sơ thiếu biên bản", It.IsAny<CancellationToken>()),
            Times.Once);
        _notifications.Verify(
            n => n.SendNotificationToUserAsync(seed.Inspection.SubmittedById!.Value.ToString(), It.IsAny<NotificationMessage>(), It.IsAny<CancellationToken>()),
            Times.Once);
        _notifications.Verify(
            n => n.SendNotificationToRoleAsync("Reviewer", It.IsAny<NotificationMessage>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Reject_WhenSubmitted_ResumesReviewerBookmark_AndDoesNotNotifyReviewerRole()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Submitted);

        var handler = new RejectInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);

        await handler.Handle(
            new RejectInspectionCommand(seed.Inspection.Id, "Ảnh hiện trường mờ", Guid.NewGuid(), "TVGS B", "Reviewer"),
            CancellationToken.None);

        _workflow.Verify(
            w => w.ResumeReviewerBookmarkAsync("wf-test-001", false, "TVGS B", "Ảnh hiện trường mờ", It.IsAny<CancellationToken>()),
            Times.Once);
        _notifications.Verify(
            n => n.SendNotificationToRoleAsync("Reviewer", It.IsAny<NotificationMessage>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Reject_WhenDraft_ThrowsInvalidOperation()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Draft);

        var handler = new RejectInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);

        var act = () => handler.Handle(
            new RejectInspectionCommand(seed.Inspection.Id, "Không hợp lệ", null, null, null),
            CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Theory]
    [InlineData("")]
    [InlineData("ab")]
    public void Validator_RejectsTooShortReason(string reason)
    {
        var validator = new RejectInspectionCommandValidator();

        var result = validator.Validate(new RejectInspectionCommand(Guid.NewGuid(), reason));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(RejectInspectionCommand.Reason));
    }

    [Fact]
    public void Validator_AcceptsValidReason()
    {
        var validator = new RejectInspectionCommandValidator();

        var result = validator.Validate(new RejectInspectionCommand(Guid.NewGuid(), "Thiếu biên bản"));

        result.IsValid.Should().BeTrue();
    }
}
