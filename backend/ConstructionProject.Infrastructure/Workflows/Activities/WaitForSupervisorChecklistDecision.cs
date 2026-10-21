using Elsa.Workflows;
using Elsa.Workflows.Models;
using Microsoft.Extensions.Logging;

namespace ConstructionProject.Infrastructure.Workflows.Activities;

/// <summary>
/// Hoạt động tạm dừng (Bookmark) quy trình Elsa #1 để chờ Giám sát (Supervisor / Reviewer)
/// thẩm duyệt Kế hoạch Checklist & Biểu mẫu Form.io (Checklist_Pending_Supervisor).
/// </summary>
public class WaitForSupervisorChecklistDecision : Activity
{
    public const string BookmarkNameConstant = "Supervisor_Checklist_Decision";

    protected override void Execute(ActivityExecutionContext context)
    {
        var logger = context.GetRequiredService<ILogger<WaitForSupervisorChecklistDecision>>();
        logger.LogInformation("[Elsa Workflow #1] Tạo Bookmark chờ Giám sát thẩm duyệt kế hoạch Checklist (Supervisor_Checklist_Decision).");

        context.CreateBookmark(new CreateBookmarkArgs
        {
            BookmarkName = BookmarkNameConstant,
            Callback = OnResumed,
            IncludeActivityInstanceId = true
        });
    }

    private async ValueTask OnResumed(ActivityExecutionContext context)
    {
        var logger = context.GetRequiredService<ILogger<WaitForSupervisorChecklistDecision>>();
        logger.LogInformation("[Elsa Workflow #1] Bookmark Supervisor_Checklist_Decision đã được kích hoạt.");
        await context.CompleteActivityAsync();
    }
}
