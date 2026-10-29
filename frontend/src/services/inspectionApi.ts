import apiClient from './apiClient';
import type {
  InspectionDto,
  PaginatedResult,
  InspectionAuditHistoryDto,
  FormSchemaItemDto,
  ConstructionObjectDto,
  FormIoSchema,
  InspectionAttachmentDto,
} from '../types/inspection';

export interface GetInspectionsParams {
  pageNumber?: number;
  pageSize?: number;
  status?: string;
  objectId?: string;
  drawingFileId?: string;
  checklistId?: string;
  checklistItemId?: string;
  search?: string;
}

export const inspectionApi = {
  // Lấy danh sách Inspection có lọc, tìm kiếm và phân trang
  getInspections: async (params?: GetInspectionsParams): Promise<PaginatedResult<InspectionDto>> => {
    const response = await apiClient.get<PaginatedResult<InspectionDto>>('/inspections', {
      params,
    });
    return response.data;
  },

  // Lấy chi tiết đơn kiểm tra theo Id
  getInspectionById: async (id: string): Promise<InspectionDto> => {
    const response = await apiClient.get<InspectionDto>(`/inspections/${id}`);
    return response.data;
  },

  // Lấy danh mục các mẫu FormIO Schema có sẵn
  getSchemas: async (): Promise<FormSchemaItemDto[]> => {
    const response = await apiClient.get<FormSchemaItemDto[]>('/inspections/schemas');
    return response.data;
  },

  // Lấy nội dung chi tiết của một schema theo ID
  getSchemaById: async (schemaId: string): Promise<FormIoSchema> => {
    const response = await apiClient.get<string | FormIoSchema>(`/inspections/schema/${schemaId}`);
    if (typeof response.data === 'string') {
      try {
        return JSON.parse(response.data) as FormIoSchema;
      } catch {
        return { components: [] };
      }
    }
    return response.data;
  },

  // Khởi tạo mới hồ sơ kiểm tra gắn liền với ChecklistItem (chỉ Submitter)
  createInspection: async (data: {
    checklistId: string;
    checklistItemId: string;
    objectId?: string;
    formDataJson?: string;
    submitImmediately?: boolean;
  }): Promise<InspectionDto> => {
    const response = await apiClient.post<InspectionDto>('/inspections', data);
    return response.data;
  },

  // Cập nhật dữ liệu bản nháp (Draft)
  updateInspectionDraft: async (
    id: string,
    data: { formDataJson: string }
  ): Promise<InspectionDto> => {
    const response = await apiClient.put<InspectionDto>(`/inspections/${id}`, data);
    return response.data;
  },

  // Nộp đơn kiểm tra (Submit: Draft -> Submitted)
  submitInspection: async (
    id: string,
    data?: { formDataJson?: string }
  ): Promise<InspectionDto> => {
    const response = await apiClient.post<InspectionDto>(`/inspections/${id}/submit`, data || {});
    return response.data;
  },

  // Xóa đơn kiểm tra nháp (Draft)
  deleteInspection: async (id: string): Promise<{ success: boolean }> => {
    const response = await apiClient.delete<{ success: boolean }>(`/inspections/${id}`);
    return response.data;
  },

  // Giám sát (Reviewer) thẩm tra & phê duyệt cấp 1 (Submitted -> Reviewed)
  reviewInspection: async (
    id: string,
    data?: { notes?: string }
  ): Promise<InspectionDto> => {
    const response = await apiClient.post<InspectionDto>(`/inspections/${id}/review`, data || {});
    return response.data;
  },

  // Chủ đầu tư (Approver) phê duyệt cuối cùng (Reviewed -> Approved)
  approveInspection: async (
    id: string,
    data?: { notes?: string }
  ): Promise<InspectionDto> => {
    const response = await apiClient.post<InspectionDto>(`/inspections/${id}/approve`, data || {});
    return response.data;
  },

  // Từ chối phiếu nghiệm thu (Reviewer hoặc Approver) -> Rejected
  rejectInspection: async (
    id: string,
    data: { reason: string }
  ): Promise<InspectionDto> => {
    const response = await apiClient.post<InspectionDto>(`/inspections/${id}/reject`, data);
    return response.data;
  },

  // Lấy lịch sử thẩm tra / kiểm toán (Audit Trail)
  getInspectionHistory: async (id: string): Promise<InspectionAuditHistoryDto[]> => {
    const response = await apiClient.get<InspectionAuditHistoryDto[]>(`/inspections/${id}/history`);
    return response.data;
  },

  // Lấy danh sách Object từ bản vẽ để gán vào đơn kiểm tra
  getObjects: async (drawingFileId?: string): Promise<ConstructionObjectDto[]> => {
    const response = await apiClient.get<ConstructionObjectDto[]>('/objects', {
      params: drawingFileId ? { drawingFileId } : undefined,
    });
    return response.data;
  },

  // Upload ảnh hiện trường hoặc tệp đính kèm (hỗ trợ JPG/PNG/WEBP/HEIC/PDF, tối đa 15MB)
  uploadAttachment: async (file: File): Promise<InspectionAttachmentDto> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<InspectionAttachmentDto>('/inspections/upload-attachment', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
