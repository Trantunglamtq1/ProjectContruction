import apiClient from './apiClient';
import type { UserDto, RoleDto } from '../types/auth';

export const userApi = {
  getUsers: async (): Promise<UserDto[]> => {
    const response = await apiClient.get<UserDto[]>('/users');
    return response.data;
  },

  getRoles: async (): Promise<RoleDto[]> => {
    const response = await apiClient.get<RoleDto[]>('/users/roles');
    return response.data;
  },

  assignRole: async (userId: string, roleId: string | null): Promise<UserDto> => {
    const response = await apiClient.put<UserDto>(`/users/${userId}/role`, { roleId });
    return response.data;
  },

  updateStatus: async (userId: string, isActive: boolean): Promise<UserDto> => {
    const response = await apiClient.patch<UserDto>(`/users/${userId}/status`, { isActive });
    return response.data;
  },
};
