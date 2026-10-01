import apiClient from './apiClient';
import type { CurrentUserDto, AuthResponseDto, UserDto } from '../types/auth';

export interface RegisterDto {
  username: string;
  email: string;
  password: string;
  fullName: string;
}

export interface LoginDto {
  username: string;
  password: string;
}

export const authApi = {
  login: async (data: LoginDto): Promise<AuthResponseDto> => {
    // Backend API LoginRequest expects usernameOrEmail and password
    const response = await apiClient.post<AuthResponseDto>('/auth/login', {
      usernameOrEmail: data.username,
      password: data.password,
    });
    return response.data;
  },

  register: async (data: RegisterDto): Promise<UserDto> => {
    const response = await apiClient.post<UserDto>('/auth/register', data);
    return response.data;
  },

  getCurrentUser: async (): Promise<CurrentUserDto> => {
    const response = await apiClient.get<CurrentUserDto>('/auth/me');
    return response.data;
  },
};
