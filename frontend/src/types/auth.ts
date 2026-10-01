export type UserRole = 'Admin' | 'Submitter' | 'Reviewer' | 'Approver' | null;

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  roleId?: string | null;
  isActive: boolean;
}

export interface UserDto {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleId: string | null;
  roleName: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface RoleDto {
  id: string;
  name: string;
  description?: string;
  userCount: number;
}

export interface AuthResponseDto {
  token: string;
  expiresAt: string;
  user: UserDto;
}

export interface CurrentUserDto {
  id: string;
  username: string;
  email: string;
  fullName: string;
  roleId: string | null;
  roleName: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface DecodedToken {
  sub?: string;
  name?: string;
  email?: string;
  role?: string;
  fullName?: string;
  exp?: number;
  [key: string]: unknown;
}
