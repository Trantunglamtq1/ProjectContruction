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
    private readonly Mock<INotificationService> _notifications = new();

    [Fact]
    public async Task Reject_WhenReviewed_ResumesApproverBookmark_AndNotifiesSubmitter()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Reviewed);

        var handler = new RejectInspectionCommandHandler(db.Context, _notifications.Object);
        var approverId = Guid.NewGuid();

        var result = await handler.Handle(
            new RejectInspectionCommand(seed.Inspection.Id, "Hồ sơ thiếu biên bản", approverId, "CĐT C", "Approver", seed.Inspection.RowVersion),
            CancellationToken.None);

        result.Status.Should().Be(InspectionStatus.Rejected.ToString());
        result.RejectReason.Should().Be("Hồ sơ thiếu biên bản");

        var history = await db.Context.InspectionAuditHistories.SingleAsync(h => h.InspectionId == seed.Inspection.Id);
        history.Action.Should().Be("Reject");
        history.ActorRole.Should().Be("Approver");

        (await db.Context.InspectionWorkflowOperations.SingleAsync(x => x.InspectionId == seed.Inspection.Id)).Action.Should().Be("RejectApprover");
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

        var handler = new RejectInspectionCommandHandler(db.Context, _notifications.Object);

        await handler.Handle(
            new RejectInspectionCommand(seed.Inspection.Id, "Ảnh hiện trường mờ", Guid.NewGuid(), "TVGS B", "Reviewer", seed.Inspection.RowVersion),
            CancellationToken.None);

        (await db.Context.InspectionWorkflowOperations.SingleAsync(x => x.InspectionId == seed.Inspection.Id)).Action.Should().Be("RejectReviewer");
        _notifications.Verify(
            n => n.SendNotificationToRoleAsync("Reviewer", It.IsAny<NotificationMessage>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Theory]
    [InlineData(InspectionStatus.Submitted, "Approver")]
    [InlineData(InspectionStatus.UnderReview, "Approver")]
    [InlineData(InspectionStatus.Reviewed, "Reviewer")]
    public async Task Reject_WhenRoleDoesNotMatchStage_IsForbidden(InspectionStatus status, string role)
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, status);
        var handler = new RejectInspectionCommandHandler(db.Context, _notifications.Object);
        var action = () => handler.Handle(new RejectInspectionCommand(seed.Inspection.Id, "Cần sửa hồ sơ", Guid.NewGuid(), role, role, seed.Inspection.RowVersion), CancellationToken.None);
        await action.Should().ThrowAsync<ConstructionProject.Application.Common.Exceptions.ForbiddenAccessException>();
    }
    [Fact]
    public async Task Reject_WhenDraft_ThrowsInvalidOperation()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Draft);

        var handler = new RejectInspectionCommandHandler(db.Context, _notifications.Object);

        var act = () => handler.Handle(
            new RejectInspectionCommand(seed.Inspection.Id, "Không hợp lệ", null, null, null, seed.Inspection.RowVersion),
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
