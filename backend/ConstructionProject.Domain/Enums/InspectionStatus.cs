namespace ConstructionProject.Domain.Enums;

public enum InspectionStatus
{
    Draft = 1,
    Submitted = 2,
    UnderReview = 3,
    Reviewed = 4,       // Reviewer đã thẩm tra & phê duyệt cấp 1 (chuyển tiếp tới Approver)
    Approved = 5,       // Approver phê duyệt nghiệm thu chính thức (Cấp 2 - hoàn tất)
    Rejected = 6        // Bị từ chối (bởi Reviewer hoặc Approver) kèm lý do
}
