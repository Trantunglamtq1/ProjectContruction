using ConstructionProject.Infrastructure.Workflows.Activities;
using Elsa.Workflows;
using Elsa.Workflows.Activities;
using Elsa.Workflows.Contracts;

namespace ConstructionProject.Infrastructure.Workflows;

/// <summary>
/// Định nghĩa quy trình phê duyệt Kế hoạch Checklist & Biểu mẫu Form.io (Elsa Workflow #1)
/// Quản lý vòng đời Giai đoạn 1 (Planning Phase): Kỹ sư lập -> Giám sát thẩm duyệt -> Khóa cấu trúc.
/// </summary>
public class ChecklistApprovalWorkflow : WorkflowBase
{
    public const string WorkflowDefinitionId = "ChecklistApprovalWorkflow";

    protected override void Build(IWorkflowBuilder builder)
    {
        builder.DefinitionId = WorkflowDefinitionId;
        builder.Name = "Quy trình thẩm định & phê duyệt Kế hoạch Checklist";
        builder.Description = "Luồng điều phối Giai đoạn 1: Kỹ sư nộp kế hoạch Checklist -> Giám sát kiểm tra/sửa đổi/phê duyệt hoặc yêu cầu lập lại";

        builder.Root = new Sequence
        {
            Activities =
            {
                new WriteLine("[Elsa Workflow #1] Bắt đầu quy trình thẩm định Kế hoạch Checklist."),
                new WaitForSupervisorChecklistDecision(),
                new WriteLine("[Elsa Workflow #1] Giám sát đã hoàn tất thẩm định kế hoạch Checklist (Duyệt hoặc Từ chối).")
            }
        };
    }
}
