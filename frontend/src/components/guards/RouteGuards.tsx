import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types/auth';

export const LoadingScreen: React.FC = () => (
  <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
    <Spin size="large" />
  </div>
);

export const getDefaultRouteForRole = (role: UserRole | string | string[] | null | undefined): string => {
  const actualRole = Array.isArray(role) ? role[0] : role;
  switch (actualRole) {
    case 'Admin':
      return '/admin/users';
    case 'Submitter':
      return '/submitter/drawings';
    case 'Reviewer':
      return '/reviewer/inspections';
    case 'Approver':
      return '/approver/inspections';
    default:
      return '/pending-approval';
  }
};

// Redirects to /auth/login if not authenticated
export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  const currentRole = ((Array.isArray(user?.role) ? user?.role[0] : user?.role) as UserRole) || null;

  // If user has no role, always force redirect to /pending-approval
  if (user && !currentRole && location.pathname !== '/pending-approval') {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
};

// Route only accessible to users with specific roles
export const RoleGuard: React.FC<{ allowedRoles: UserRole[]; children: React.ReactNode }> = ({
  allowedRoles,
  children,
}) => {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  const currentRole = ((Array.isArray(user?.role) ? user?.role[0] : user?.role) as UserRole) || null;

  if (!user || !currentRole || !allowedRoles.includes(currentRole)) {
    const targetRoute = getDefaultRouteForRole(currentRole);
    return <Navigate to={targetRoute} replace />;
  }

  return <>{children}</>;
};

// Public only guard: logged in users should not see /auth/login or /auth/register
export const PublicOnlyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated && user) {
    const currentRole = ((Array.isArray(user?.role) ? user?.role[0] : user?.role) as UserRole) || null;
    const targetRoute = getDefaultRouteForRole(currentRole);
    return <Navigate to={targetRoute} replace />;
  }

  return <>{children}</>;
};
