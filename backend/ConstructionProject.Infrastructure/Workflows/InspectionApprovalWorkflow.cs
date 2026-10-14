using ConstructionProject.Infrastructure.Workflows.Activities;
using Elsa.Workflows;
using Elsa.Workflows.Activities;
using Elsa.Workflows.Contracts;

namespace ConstructionProject.Infrastructure.Workflows;

/// <summary>
/// Định nghĩa quy trình phê duyệt hồ sơ kiểm tra hiện trường (Inspection Approval Workflow)
/// theo chuẩn Elsa 3.x với mô hình 2 cấp thẩm duyệt (Reviewer -> Approver).
/// </summary>
public class InspectionApprovalWorkflow : WorkflowBase
{
    public const string WorkflowDefinitionId = "InspectionApprovalWorkflow";

    protected override void Build(IWorkflowBuilder builder)
    {
        builder.DefinitionId = WorkflowDefinitionId;
        builder.Name = "Quy trình kiểm tra & phê duyệt nghiệm thu hiện trường";
        builder.Description = "Luồng duyệt 2 cấp: Kỹ sư nộp (Submit) -> Tư vấn giám sát thẩm tra (Reviewer) -> Chủ đầu tư nghiệm thu (Approver)";

        builder.Root = new Sequence
        {
            Activities =
            {
                new WriteLine("[Elsa Workflow] Bắt đầu quy trình kiểm duyệt hồ sơ Inspection."),
                new WaitForReviewerDecision(),
                new WriteLine("[Elsa Workflow] Đã qua cấp thẩm tra 1 (Reviewer). Chuyển tiếp tới cấp phê duyệt nghiệm thu 2 (Approver)."),
                new WaitForApproverDecision(),
                new WriteLine("[Elsa Workflow] Hoàn tất toàn bộ quy trình phê duyệt hồ sơ Inspection!")
            }
        };
    }
}
