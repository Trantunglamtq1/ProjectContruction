using ConstructionProject.Application.Common.Interfaces;
using ConstructionProject.Application.Features.Inspections.Commands;
using ConstructionProject.Domain.Entities;
using ConstructionProject.Domain.Enums;
using ConstructionProject.UnitTests.TestInfrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace ConstructionProject.UnitTests.Inspections;

public class ReviewAndApproveInspectionTests
{
    private readonly Mock<INotificationService> _notifications = new();

    [Fact]
    public async Task Review_WhenPreviousOperationPending_DoesNotPersistReview()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.UnderReview);
        db.Context.InspectionWorkflowOperations.Add(new InspectionWorkflowOperation { InspectionId = seed.Inspection.Id, InstanceId = "wf-test-001", Action = "Start" });
        await db.Context.SaveChangesAsync();
        var handler = new ReviewInspectionCommandHandler(db.Context, _notifications.Object);
        var action = () => handler.Handle(new ReviewInspectionCommand(seed.Inspection.Id, Guid.NewGuid(), "Reviewer", null, seed.Inspection.RowVersion), CancellationToken.None);
        await action.Should().ThrowAsync<InvalidOperationException>();
        var saved = await db.Context.FormInspections.AsNoTracking().SingleAsync(x => x.Id == seed.Inspection.Id);
        saved.Status.Should().Be(InspectionStatus.UnderReview);
        (await db.Context.InspectionAuditHistories.CountAsync()).Should().Be(0);
    }
    [Fact]
    public async Task Review_WhenUnderReview_TransitionsToReviewed_AndNotifiesApprover()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.UnderReview);

        var handler = new ReviewInspectionCommandHandler(db.Context, _notifications.Object);
        var reviewerId = Guid.NewGuid();

        var result = await handler.Handle(
            new ReviewInspectionCommand(seed.Inspection.Id, reviewerId, "TVGS B", "Đạt yêu cầu", seed.Inspection.RowVersion),
            CancellationToken.None);

        result.Status.Should().Be(InspectionStatus.Reviewed.ToString());
        result.ReviewedById.Should().Be(reviewerId);
        result.ReviewedAt.Should().NotBeNull();

        var history = await db.Context.InspectionAuditHistories.SingleAsync(h => h.InspectionId == seed.Inspection.Id);
        history.Action.Should().Be("Review");
        history.ActorRole.Should().Be("Reviewer");
        history.FromStatus.Should().Be(InspectionStatus.UnderReview);
        history.ToStatus.Should().Be(InspectionStatus.Reviewed);

        (await db.Context.InspectionWorkflowOperations.SingleAsync(x => x.InspectionId == seed.Inspection.Id)).Action.Should().Be("Review");
        _notifications.Verify(
            n => n.SendNotificationToRoleAsync("Approver", It.IsAny<NotificationMessage>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Review_WhenNotReceived_RejectsSkippingReceive()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Submitted);
        var handler = new ReviewInspectionCommandHandler(db.Context, _notifications.Object);
        var action = () => handler.Handle(new ReviewInspectionCommand(seed.Inspection.Id, Guid.NewGuid(), "Reviewer", null, seed.Inspection.RowVersion), CancellationToken.None);
        await action.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task Approve_WhenUnderReview_RejectsSkippingReview()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.UnderReview);
        var handler = new ApproveInspectionCommandHandler(db.Context, _notifications.Object);
        var action = () => handler.Handle(new ApproveInspectionCommand(seed.Inspection.Id, Guid.NewGuid(), "Approver", null, seed.Inspection.RowVersion), CancellationToken.None);
        await action.Should().ThrowAsync<InvalidOperationException>();
    }
    [Fact]
    public async Task Review_WhenDraft_ThrowsInvalidOperation()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Draft);

        var handler = new ReviewInspectionCommandHandler(db.Context, _notifications.Object);

        var act = () => handler.Handle(
            new ReviewInspectionCommand(seed.Inspection.Id, Guid.NewGuid(), "TVGS B", null, seed.Inspection.RowVersion),
            CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*UnderReview*");
    }

    [Fact]
    public async Task Approve_WithStaleVersion_DoesNotResumeWorkflow()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Reviewed);
        var handler = new ApproveInspectionCommandHandler(db.Context, _notifications.Object);

        var act = () => handler.Handle(
            new ApproveInspectionCommand(seed.Inspection.Id, Guid.NewGuid(), "Approver", null, new byte[] { 1, 0, 0, 0, 0, 0, 0, 0 }),
            CancellationToken.None);

        await act.Should().ThrowAsync<DbUpdateConcurrencyException>();
        (await db.Context.InspectionWorkflowOperations.CountAsync()).Should().Be(0);
    }
    [Fact]
    public async Task Approve_WhenReviewed_MarksLinkedChecklistItemsDone_AndCompletesChecklist()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Reviewed);

        var handler = new ApproveInspectionCommandHandler(db.Context, _notifications.Object);
        var approverId = Guid.NewGuid();

        var result = await handler.Handle(
            new ApproveInspectionCommand(seed.Inspection.Id, approverId, "CĐT C", "Nghiệm thu đạt", seed.Inspection.RowVersion),
            CancellationToken.None);

        result.Status.Should().Be(InspectionStatus.Approved.ToString());
        result.ApprovedById.Should().Be(approverId);
        result.ApprovedAt.Should().NotBeNull();

        // Cả 2 tiêu chí bắt buộc đều Done → checklist phải Completed
        var checklist = await db.Context.Checklists
            .Include(c => c.Items)
            .SingleAsync(c => c.Id == seed.Checklist.Id);

        checklist.Items.Should().OnlyContain(i => i.Status == ChecklistItemStatus.Done);
        checklist.Status.Should().Be(ChecklistStatus.Completed);

        var history = await db.Context.InspectionAuditHistories.SingleAsync(h => h.InspectionId == seed.Inspection.Id);
        history.Action.Should().Be("Approve");
        history.FromStatus.Should().Be(InspectionStatus.Reviewed);
        history.ToStatus.Should().Be(InspectionStatus.Approved);

        (await db.Context.InspectionWorkflowOperations.SingleAsync(x => x.InspectionId == seed.Inspection.Id)).Action.Should().Be("Approve");
    }

    [Fact]
    public async Task Approve_WhenDraft_ThrowsInvalidOperation_AndDoesNotTouchChecklist()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Draft);

        var handler = new ApproveInspectionCommandHandler(db.Context, _notifications.Object);

        var act = () => handler.Handle(
            new ApproveInspectionCommand(seed.Inspection.Id, Guid.NewGuid(), "CĐT C", null, seed.Inspection.RowVersion),
            CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Reviewed*");

        var item = await db.Context.ChecklistItems.SingleAsync(i => i.Id == seed.LinkedItem.Id);
        item.Status.Should().Be(ChecklistItemStatus.Pending);
    }

    [Fact]
    public async Task Approve_WhenOnlySomeRequiredItemsDone_KeepsChecklistInProgress()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Reviewed);

        // Tiêu chí thứ 2 chưa Done và không liên kết với phiếu này → checklist chưa thể Completed
        seed.AlreadyDoneItem.Status = ChecklistItemStatus.Pending;
        seed.AlreadyDoneItem.LinkedInspectionId = null;
        await db.Context.SaveChangesAsync();

        var handler = new ApproveInspectionCommandHandler(db.Context, _notifications.Object);
        await handler.Handle(
            new ApproveInspectionCommand(seed.Inspection.Id, Guid.NewGuid(), "CĐT C", null, seed.Inspection.RowVersion),
            CancellationToken.None);

        var checklist = await db.Context.Checklists
            .Include(c => c.Items)
            .SingleAsync(c => c.Id == seed.Checklist.Id);

        checklist.Status.Should().Be(ChecklistStatus.InProgress);
        checklist.Items.Single(i => i.Id == seed.LinkedItem.Id).Status.Should().Be(ChecklistItemStatus.Done);
    }
}
