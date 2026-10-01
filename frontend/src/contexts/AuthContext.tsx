import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { message } from 'antd';
import type { User, UserRole, AuthResponseDto, CurrentUserDto } from '../types/auth';
import { authApi } from '../services/authApi';
import { getDefaultRouteForRole } from '../components/guards/RouteGuards';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, resData: AuthResponseDto) => void;
  logout: () => void;
  refreshUser: () => Promise<CurrentUserDto | null>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper function to extract user role from decoded token
  const extractRoleFromToken = (decoded: Record<string, unknown>): UserRole => {
    const roleClaim =
      decoded['role'] ||
      decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
    return (roleClaim as UserRole) || null;
  };

  // Synchronize user profile from backend on app launch
  const refreshUser = useCallback(async (): Promise<CurrentUserDto | null> => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    try {
      const currentUserData = await authApi.getCurrentUser();
      const updatedUser: User = {
        id: currentUserData.id,
        username: currentUserData.username,
        email: currentUserData.email,
        fullName: currentUserData.fullName,
        role: (currentUserData.roleName as UserRole) || null,
        roleId: currentUserData.roleId,
        isActive: currentUserData.isActive ?? true,
      };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return currentUserData;
    } catch {
      logout();
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Background role & active status sync: auto-detect role changes and account status without F5
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(async () => {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) return;

      try {
        const currentData = await authApi.getCurrentUser();

        // 1. Check if account got deactivated
        if (currentData.isActive === false) {
          message.error('Tài khoản của bạn đã bị vô hiệu hóa bởi Quản trị viên.');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
          window.location.href = '/auth/login';
          return;
        }

        // 2. Check if role has changed
        const newRole = (currentData.roleName as UserRole) || null;
        if (user && user.role !== newRole) {
          const updatedUser: User = {
            ...user,
            role: newRole,
            roleId: currentData.roleId,
            fullName: currentData.fullName,
            isActive: currentData.isActive ?? true,
          };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));

          message.info(`Vai trò của bạn đã được cập nhật: ${newRole || 'Chờ gán quyền'}`);
          const targetRoute = getDefaultRouteForRole(newRole);
          window.location.href = targetRoute;
        }
      } catch {
        // Silently ignore background poll errors
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [token, user]);

  const login = (jwtToken: string, resData: AuthResponseDto) => {
    localStorage.setItem('token', jwtToken);
    setToken(jwtToken);

    try {
      const decoded: Record<string, unknown> = jwtDecode(jwtToken);
      const roleFromToken = extractRoleFromToken(decoded);
      const role = roleFromToken || (resData.user.roleName as UserRole) || null;
      const sub = (decoded['sub'] as string) || (decoded['nameid'] as string) || resData.user.id;

      const loggedUser: User = {
        id: sub,
        username: resData.user.username,
        email: resData.user.email,
        fullName: resData.user.fullName,
        role,
        roleId: resData.user.roleId,
        isActive: resData.user.isActive ?? true,
      };

      setUser(loggedUser);
      localStorage.setItem('user', JSON.stringify(loggedUser));
    } catch {
      const fallbackUser: User = {
        id: resData.user.id,
        username: resData.user.username,
        email: resData.user.email,
        fullName: resData.user.fullName,
        role: (resData.user.roleName as UserRole) || null,
        roleId: resData.user.roleId,
        isActive: resData.user.isActive ?? true,
      };
      setUser(fallbackUser);
      localStorage.setItem('user', JSON.stringify(fallbackUser));
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        refreshUser,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
