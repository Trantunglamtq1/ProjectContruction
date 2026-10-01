import apiClient from './apiClient';
import type { ObjectDto } from './drawingApi';

export interface CreateObjectPayload {
  drawingFileId: string;
  pageNumber: number;
  markerCoordinates: string;
  name: string;
  createdBy?: string;
}

export const objectApi = {
  createObject: async (payload: CreateObjectPayload): Promise<ObjectDto> => {
    const response = await apiClient.post<ObjectDto>('/objects', payload);
    return response.data;
  },

  getObjectsByDrawing: async (drawingFileId: string): Promise<ObjectDto[]> => {
    const response = await apiClient.get<ObjectDto[]>('/objects', {
      params: { drawingFileId },
    });
    return response.data;
  },

  getObjectById: async (id: string): Promise<ObjectDto> => {
    const response = await apiClient.get<ObjectDto>(`/objects/${id}`);
    return response.data;
  },
};
