export type StatusDomain = 'inspection' | 'checklist' | 'sync';
type Tone = 'neutral' | 'blue' | 'amber' | 'green' | 'red';
type StatusPresentation = { label: string; tone: Tone };
export const statusPresentations: Record<StatusDomain, Record<string, StatusPresentation>> = {
  inspection: {
    Draft: { label: 'Bản nháp', tone: 'neutral' }, Submitted: { label: 'Chờ thẩm tra', tone: 'amber' },
    UnderReview: { label: 'Đang thẩm tra', tone: 'blue' }, Reviewed: { label: 'Đã thẩm tra', tone: 'blue' },
    Approved: { label: 'Đã phê duyệt', tone: 'green' }, Rejected: { label: 'Bị từ chối', tone: 'red' },
  },
  checklist: {
    Draft: { label: 'Bản nháp', tone: 'neutral' }, PendingSupervisor: { label: 'Chờ duyệt kế hoạch', tone: 'amber' },
    Approved: { label: 'Đã duyệt kế hoạch', tone: 'blue' }, Rejected: { label: 'Kế hoạch bị từ chối', tone: 'red' },
    InProgress: { label: 'Đang thực hiện', tone: 'blue' }, Completed: { label: 'Hoàn tất nghiệm thu', tone: 'green' },
  },
  sync: {
    Synchronized: { label: 'Đã đồng bộ', tone: 'neutral' }, Pending: { label: 'Đang đồng bộ', tone: 'amber' },
    Retrying: { label: 'Đồng bộ gặp lỗi, đang thử lại', tone: 'amber' }, NeedsRecovery: { label: 'Cần hỗ trợ khôi phục', tone: 'red' },
  },
};
export const roleLabels: Record<string, string> = { Admin: 'Quản trị viên', Submitter: 'Kỹ sư hiện trường', Reviewer: 'Tư vấn giám sát', Approver: 'Người phê duyệt' };
export const checklistAuditActionLabels: Record<string, string> = {
  CreateDraft: 'Tạo bản nháp', SubmitForApproval: 'Nộp duyệt kế hoạch',
  SupervisorApprove: 'Phê duyệt kế hoạch', SupervisorReject: 'Từ chối kế hoạch',
  SupervisorModify: 'Chỉnh sửa kế hoạch', LinkInspection: 'Liên kết hồ sơ nghiệm thu',
  AddItem: 'Thêm tiêu chí', UpdateItem: 'Cập nhật tiêu chí', DeleteItem: 'Xóa tiêu chí',
  DeleteChecklist: 'Xóa kế hoạch',
};
export const inspectionStatusOptions = Object.entries(statusPresentations.inspection).map(([value, { label }]) => ({ value, label }));
export function getStatusPresentation(domain: StatusDomain, status?: string | null): StatusPresentation {
  return statusPresentations[domain][status || ''] || { label: status || 'Chưa xác định', tone: 'neutral' };
}
