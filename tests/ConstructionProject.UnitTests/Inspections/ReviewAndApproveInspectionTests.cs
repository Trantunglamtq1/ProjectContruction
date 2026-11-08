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
    private readonly Mock<IInspectionWorkflowService> _workflow = new();
    private readonly Mock<INotificationService> _notifications = new();

    [Fact]
    public async Task Review_WhenSubmitted_TransitionsToReviewed_AndNotifiesApprover()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Submitted);

        var handler = new ReviewInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);
        var reviewerId = Guid.NewGuid();

        var result = await handler.Handle(
            new ReviewInspectionCommand(seed.Inspection.Id, reviewerId, "TVGS B", "Đạt yêu cầu"),
            CancellationToken.None);

        result.Status.Should().Be(InspectionStatus.Reviewed.ToString());
        result.ReviewedById.Should().Be(reviewerId);
        result.ReviewedAt.Should().NotBeNull();

        var history = await db.Context.InspectionAuditHistories.SingleAsync(h => h.InspectionId == seed.Inspection.Id);
        history.Action.Should().Be("Review");
        history.ActorRole.Should().Be("Reviewer");
        history.FromStatus.Should().Be(InspectionStatus.Submitted);
        history.ToStatus.Should().Be(InspectionStatus.Reviewed);

        _workflow.Verify(
            w => w.ResumeReviewerBookmarkAsync("wf-test-001", true, "TVGS B", "Đạt yêu cầu", It.IsAny<CancellationToken>()),
            Times.Once);
        _notifications.Verify(
            n => n.SendNotificationToRoleAsync("Approver", It.IsAny<NotificationMessage>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Review_WhenDraft_ThrowsInvalidOperation()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Draft);

        var handler = new ReviewInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);

        var act = () => handler.Handle(
            new ReviewInspectionCommand(seed.Inspection.Id, Guid.NewGuid(), "TVGS B", null),
            CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>().WithMessage("*Submitted*");
    }

    [Fact]
    public async Task Approve_WhenReviewed_MarksLinkedChecklistItemsDone_AndCompletesChecklist()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Reviewed);

        var handler = new ApproveInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);
        var approverId = Guid.NewGuid();

        var result = await handler.Handle(
            new ApproveInspectionCommand(seed.Inspection.Id, approverId, "CĐT C", "Nghiệm thu đạt"),
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

        _workflow.Verify(
            w => w.ResumeApproverBookmarkAsync("wf-test-001", true, "CĐT C", "Nghiệm thu đạt", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Approve_WhenDraft_ThrowsInvalidOperation_AndDoesNotTouchChecklist()
    {
        using var db = new TestDb();
        var seed = InspectionSeed.Create(db.Context, InspectionStatus.Draft);

        var handler = new ApproveInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);

        var act = () => handler.Handle(
            new ApproveInspectionCommand(seed.Inspection.Id, Guid.NewGuid(), "CĐT C", null),
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

        var handler = new ApproveInspectionCommandHandler(db.Context, _workflow.Object, _notifications.Object);
        await handler.Handle(
            new ApproveInspectionCommand(seed.Inspection.Id, Guid.NewGuid(), "CĐT C", null),
            CancellationToken.None);

        var checklist = await db.Context.Checklists
            .Include(c => c.Items)
            .SingleAsync(c => c.Id == seed.Checklist.Id);

        checklist.Status.Should().Be(ChecklistStatus.InProgress);
        checklist.Items.Single(i => i.Id == seed.LinkedItem.Id).Status.Should().Be(ChecklistItemStatus.Done);
    }
}
