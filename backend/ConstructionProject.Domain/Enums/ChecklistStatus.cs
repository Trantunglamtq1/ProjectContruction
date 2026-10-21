namespace ConstructionProject.Domain.Enums;

public enum ChecklistStatus
{
    Draft = 1,              // Checklist_Draft: Kỹ sư lập kế hoạch & thiết kế FormSchemaJson
    PendingSupervisor = 2,  // Checklist_Pending_Supervisor: Kỹ sư gửi duyệt cho Giám sát
    Approved = 3,           // Checklist_Approved: Giám sát duyệt, khóa cấu trúc & mở khóa điền phiếu
    Rejected = 4,           // Checklist_Rejected: Giám sát yêu cầu lập lại kèm lý do
    InProgress = 5,         // Checklist_InProgress: Đang nghiệm thu
    Completed = 6           // Checklist_Completed: Toàn bộ tiêu chí đạt Form_Completed
}

