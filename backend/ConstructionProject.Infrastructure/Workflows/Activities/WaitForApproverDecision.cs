using Elsa.Workflows;
using Elsa.Workflows.Models;
using Microsoft.Extensions.Logging;

namespace ConstructionProject.Infrastructure.Workflows.Activities;

/// <summary>
/// Hoạt động tạm dừng (Bookmark) quy trình Elsa để chờ Chủ đầu tư / Quản lý dự án (Approver) nghiệm thu Cấp 2.
/// </summary>
public class WaitForApproverDecision : Activity
{
    public const string BookmarkNameConstant = "Approver_Decision";

    protected override void Execute(ActivityExecutionContext context)
    {
        var logger = context.GetRequiredService<ILogger<WaitForApproverDecision>>();
        logger.LogInformation("[Elsa Workflow] Tạo Bookmark chờ Approver nghiệm thu Cấp 2 (Approver_Decision).");

        context.CreateBookmark(new CreateBookmarkArgs
        {
            BookmarkName = BookmarkNameConstant,
            Callback = OnResumed,
            IncludeActivityInstanceId = true
        });
    }

    private async ValueTask OnResumed(ActivityExecutionContext context)
    {
        var logger = context.GetRequiredService<ILogger<WaitForApproverDecision>>();
        logger.LogInformation("[Elsa Workflow] Bookmark Approver_Decision đã được kích hoạt tiếp tục tiến trình.");
        await context.CompleteActivityAsync();
    }
}
