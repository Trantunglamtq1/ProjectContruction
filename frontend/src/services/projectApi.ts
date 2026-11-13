import apiClient from './apiClient';

export interface ProjectDto { id: string; code: string; name: string; createdAt: string }
export interface ProjectMemberDto { userId: string; username: string; fullName: string; email: string; roleName: string; assignedAt: string }

export const projectApi = {
  list: async () => (await apiClient.get<ProjectDto[]>('/projects')).data,
  create: async (data: { code: string; name: string }) => (await apiClient.post<ProjectDto>('/projects', data)).data,
  members: async (id: string) => (await apiClient.get<ProjectMemberDto[]>(`/projects/${id}/members`)).data,
  assign: async (id: string, userId: string) => (await apiClient.put<ProjectMemberDto>(`/projects/${id}/members/${userId}`)).data,
  revoke: async (id: string, userId: string) => { await apiClient.delete(`/projects/${id}/members/${userId}`); },
};
