import apiClient from './apiClient';

export interface DrawingFileDto {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
  objectCount: number;
}

export interface ObjectDto {
  id: string;
  drawingFileId: string;
  drawingFileName: string;
  pageNumber: number;
  markerCoordinates: string;
  name: string;
  createdBy: string;
  createdAt: string;
  inspectionCount: number;
  checklistCount: number;
}

export interface DrawingFileDetailDto extends DrawingFileDto {
  objects: ObjectDto[];
}

export const drawingApi = {
  getDrawings: async (search?: string): Promise<DrawingFileDto[]> => {
    const params = search ? { search } : {};
    const response = await apiClient.get<DrawingFileDto[]>('/drawings', { params });
    return response.data;
  },

  getDrawingById: async (id: string): Promise<DrawingFileDetailDto> => {
    const response = await apiClient.get<DrawingFileDetailDto>(`/drawings/${id}`);
    return response.data;
  },

  getDrawingByName: async (fileName: string): Promise<DrawingFileDetailDto> => {
    const response = await apiClient.get<DrawingFileDetailDto>(`/drawings/by-name/${encodeURIComponent(fileName)}`);
    return response.data;
  },

  uploadDrawing: async (file: File, uploadedBy?: string): Promise<DrawingFileDto> => {
    const formData = new FormData();
    formData.append('file', file);
    if (uploadedBy) {
      formData.append('uploadedBy', uploadedBy);
    }
    const response = await apiClient.post<DrawingFileDto>('/drawings/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteDrawing: async (id: string): Promise<void> => {
    await apiClient.delete(`/drawings/${id}`);
  },
};
