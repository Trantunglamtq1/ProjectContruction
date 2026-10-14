using Elsa.Workflows;
using Elsa.Workflows.Models;
using Microsoft.Extensions.Logging;

namespace ConstructionProject.Infrastructure.Workflows.Activities;

/// <summary>
/// Hoạt động tạm dừng (Bookmark) quy trình Elsa để chờ Tư vấn Giám sát (Reviewer) thẩm tra Cấp 1.
/// </summary>
public class WaitForReviewerDecision : Activity
{
    public const string BookmarkNameConstant = "Reviewer_Decision";

    protected override void Execute(ActivityExecutionContext context)
    {
        var logger = context.GetRequiredService<ILogger<WaitForReviewerDecision>>();
        logger.LogInformation("[Elsa Workflow] Tạo Bookmark chờ Reviewer thẩm tra Cấp 1 (Reviewer_Decision).");

        context.CreateBookmark(new CreateBookmarkArgs
        {
            BookmarkName = BookmarkNameConstant,
            Callback = OnResumed,
            IncludeActivityInstanceId = true
        });
    }

    private async ValueTask OnResumed(ActivityExecutionContext context)
    {
        var logger = context.GetRequiredService<ILogger<WaitForReviewerDecision>>();
        logger.LogInformation("[Elsa Workflow] Bookmark Reviewer_Decision đã được kích hoạt tiếp tục tiến trình.");
        await context.CompleteActivityAsync();
    }
}
