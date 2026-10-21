import apiClient from './apiClient';
import type {
  ChecklistDto,
  ChecklistSummaryDto,
  CreateChecklistPayload,
  SubmitChecklistPayload,
  SupervisorApprovePayload,
  SupervisorRejectPayload,
  SupervisorModifyPayload,
  AddChecklistItemPayload,
  UpdateChecklistItemPayload,
  LinkInspectionPayload,
  ChecklistItemDto,
} from '../types/checklist';

export const checklistApi = {
  // Lấy danh sách Checklist theo filter
  getChecklists: async (params?: { objectId?: string; status?: string }): Promise<ChecklistDto[]> => {
    const res = await apiClient.get<ChecklistDto[]>('/api/checklists', { params });
    return res.data;
  },

  // Lấy chi tiết Checklist kèm danh sách items và audit history
  getChecklistById: async (id: string): Promise<ChecklistDto> => {
    const res = await apiClient.get<ChecklistDto>(`/api/checklists/${id}`);
    return res.data;
  },

  // Lấy tóm tắt tiến độ Checklist theo Object cấu kiện
  getChecklistSummaryByObject: async (objectId: string): Promise<ChecklistSummaryDto> => {
    const res = await apiClient.get<ChecklistSummaryDto>(`/api/checklists/object/${objectId}/summary`);
    return res.data;
  },

  // Kỹ sư tạo bản nháp Checklist (Draft)
  createChecklist: async (payload: CreateChecklistPayload): Promise<ChecklistDto> => {
    const res = await apiClient.post<ChecklistDto>('/api/checklists', payload);
    return res.data;
  },

  // Kỹ sư nộp duyệt Checklist (Kích hoạt Elsa Workflow #1)
  submitForApproval: async (id: string, payload?: SubmitChecklistPayload): Promise<ChecklistDto> => {
    const res = await apiClient.post<ChecklistDto>(`/api/checklists/${id}/submit`, payload || {});
    return res.data;
  },

  // Giám sát phê duyệt Checklist
  supervisorApprove: async (id: string, payload?: SupervisorApprovePayload): Promise<ChecklistDto> => {
    const res = await apiClient.post<ChecklistDto>(`/api/checklists/${id}/supervisor-approve`, payload || {});
    return res.data;
  },

  // Giám sát từ chối Checklist
  supervisorReject: async (id: string, payload: SupervisorRejectPayload): Promise<ChecklistDto> => {
    const res = await apiClient.post<ChecklistDto>(`/api/checklists/${id}/supervisor-reject`, payload);
    return res.data;
  },

  // Giám sát can thiệp chỉnh sửa Checklist & Form.io schemas
  supervisorModify: async (id: string, payload: SupervisorModifyPayload): Promise<ChecklistDto> => {
    const res = await apiClient.put<ChecklistDto>(`/api/checklists/${id}/supervisor-modify`, payload);
    return res.data;
  },

  // Thêm tiêu chí vào Checklist
  addItem: async (checklistId: string, payload: AddChecklistItemPayload): Promise<ChecklistItemDto> => {
    const res = await apiClient.post<ChecklistItemDto>(`/api/checklists/${checklistId}/items`, payload);
    return res.data;
  },

  // Cập nhật tiêu chí & schema
  updateItem: async (
    checklistId: string,
    itemId: string,
    payload: UpdateChecklistItemPayload
  ): Promise<ChecklistItemDto> => {
    const res = await apiClient.put<ChecklistItemDto>(`/api/checklists/${checklistId}/items/${itemId}`, payload);
    return res.data;
  },

  // Xóa tiêu chí (Xóa mềm, chặn nếu đã có inspection)
  deleteItem: async (checklistId: string, itemId: string): Promise<void> => {
    await apiClient.delete(`/api/checklists/${checklistId}/items/${itemId}`);
  },

  // Giai đoạn 2: Liên kết FormInspection đã được nộp/duyệt vào tiêu chí
  linkInspection: async (
    checklistId: string,
    itemId: string,
    payload: LinkInspectionPayload
  ): Promise<ChecklistItemDto> => {
    const res = await apiClient.post<ChecklistItemDto>(
      `/api/checklists/${checklistId}/items/${itemId}/link-inspection`,
      payload
    );
    return res.data;
  },

  // Xóa Checklist (Xóa mềm)
  deleteChecklist: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/checklists/${id}`);
  },
};
