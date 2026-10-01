import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { themeConfig } from './config/theme';
import { AuthProvider } from './contexts/AuthContext';
import { AuthGuard, RoleGuard, PublicOnlyGuard } from './components/guards/RouteGuards';
import { MasterLayout } from './components/layout/MasterLayout';
import { RegisterPage } from './pages/auth/RegisterPage';
import { LoginPage } from './pages/auth/LoginPage';
import { PendingRolePage } from './pages/auth/PendingRolePage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { SubmitterDrawingListPage } from './pages/submitter/SubmitterDrawingListPage';
import { SubmitterInspectionListPage } from './pages/submitter/SubmitterInspectionListPage';
import { ReviewerDrawingListPage } from './pages/reviewer/ReviewerDrawingListPage';
import { ReviewerInspectionListPage } from './pages/reviewer/ReviewerInspectionListPage';
import { ReviewerChecklistPage } from './pages/reviewer/ReviewerChecklistPage';
import { ApproverDrawingListPage } from './pages/approver/ApproverDrawingListPage';
import { ApproverInspectionListPage } from './pages/approver/ApproverInspectionListPage';
import { ApproverChecklistPage } from './pages/approver/ApproverChecklistPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={themeConfig}>
        <AntdApp>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                {/* Public only routes */}
                <Route
                  path="/auth/register"
                  element={
                    <PublicOnlyGuard>
                      <RegisterPage />
                    </PublicOnlyGuard>
                  }
                />
                <Route
                  path="/auth/login"
                  element={
                    <PublicOnlyGuard>
                      <LoginPage />
                    </PublicOnlyGuard>
                  }
                />

                {/* Pending approval route */}
                <Route
                  path="/pending-approval"
                  element={<PendingRolePage />}
                />

                {/* Protected routes within MasterLayout */}
                <Route
                  element={
                    <AuthGuard>
                      <MasterLayout />
                    </AuthGuard>
                  }
                >
                  {/* ADMIN ROUTES */}
                  <Route
                    path="/admin/users"
                    element={
                      <RoleGuard allowedRoles={['Admin']}>
                        <UserManagementPage />
                      </RoleGuard>
                    }
                  />

                  {/* SUBMITTER ROUTES */}
                  <Route
                    path="/submitter/drawings"
                    element={
                      <RoleGuard allowedRoles={['Submitter']}>
                        <SubmitterDrawingListPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/submitter/inspections"
                    element={
                      <RoleGuard allowedRoles={['Submitter']}>
                        <SubmitterInspectionListPage />
                      </RoleGuard>
                    }
                  />

                  {/* REVIEWER ROUTES */}
                  <Route
                    path="/reviewer/drawings"
                    element={
                      <RoleGuard allowedRoles={['Reviewer']}>
                        <ReviewerDrawingListPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/reviewer/inspections"
                    element={
                      <RoleGuard allowedRoles={['Reviewer']}>
                        <ReviewerInspectionListPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/reviewer/checklists"
                    element={
                      <RoleGuard allowedRoles={['Reviewer']}>
                        <ReviewerChecklistPage />
                      </RoleGuard>
                    }
                  />

                  {/* APPROVER ROUTES */}
                  <Route
                    path="/approver/drawings"
                    element={
                      <RoleGuard allowedRoles={['Approver']}>
                        <ApproverDrawingListPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/approver/inspections"
                    element={
                      <RoleGuard allowedRoles={['Approver']}>
                        <ApproverInspectionListPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/approver/checklists"
                    element={
                      <RoleGuard allowedRoles={['Approver']}>
                        <ApproverChecklistPage />
                      </RoleGuard>
                    }
                  />

                  {/* Backward compatibility redirect */}
                  <Route path="/drawings" element={<Navigate to="/submitter/drawings" replace />} />
                </Route>

                {/* Root Route: If logged in, redirect to user role workspace; if not, go to login */}
                <Route
                  path="/"
                  element={
                    <PublicOnlyGuard>
                      <Navigate to="/auth/login" replace />
                    </PublicOnlyGuard>
                  }
                />

                {/* Fallback */}
                <Route
                  path="*"
                  element={
                    <PublicOnlyGuard>
                      <Navigate to="/auth/login" replace />
                    </PublicOnlyGuard>
                  }
                />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </AntdApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
