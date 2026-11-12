import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntdApp, ConfigProvider, message } from 'antd';
import viVN from 'antd/es/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route, RouterProvider } from 'react-router-dom';
import { AuthGuard, PublicOnlyGuard, RoleGuard } from './components/guards/RouteGuards';
import { MasterLayout } from './components/layout/MasterLayout';
import { themeConfig } from './config/theme';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { UnsavedChangesProvider } from './contexts/UnsavedChangesContext';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { ApproverChecklistPage } from './pages/approver/ApproverChecklistPage';
import { ApproverDrawingListPage } from './pages/approver/ApproverDrawingListPage';
import { ApproverInspectionListPage } from './pages/approver/ApproverInspectionListPage';
import { LoginPage } from './pages/auth/LoginPage';
import { PendingRolePage } from './pages/auth/PendingRolePage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DrawingViewportPage } from './pages/drawings/DrawingViewportPage';
import { ReviewerChecklistPage } from './pages/reviewer/ReviewerChecklistPage';
import { ReviewerDrawingListPage } from './pages/reviewer/ReviewerDrawingListPage';
import { ReviewerInspectionListPage } from './pages/reviewer/ReviewerInspectionListPage';
import { SubmitterChecklistPage } from './pages/submitter/SubmitterChecklistPage';
import { SubmitterDrawingListPage } from './pages/submitter/SubmitterDrawingListPage';
import { SubmitterInspectionListPage } from './pages/submitter/SubmitterInspectionListPage';

// Cấu hình thông báo toàn hệ thống: tối đa 1 thông báo hiển thị cùng lúc để tránh spam / rối mắt
message.config({
  maxCount: 1,
  duration: 2,
});
dayjs.locale('vi');
ConfigProvider.config({ holderRender: children => <ConfigProvider theme={themeConfig} locale={viVN}>{children}</ConfigProvider> });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const router = createBrowserRouter(createRoutesFromElements(<Route element={<UnsavedChangesProvider><Outlet /></UnsavedChangesProvider>}>
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
                    path="/submitter/drawings/:id/viewport"
                    element={
                      <RoleGuard allowedRoles={['Submitter']}>
                        <DrawingViewportPage />
                      </RoleGuard>
                    }
                  />
                  <Route
                    path="/submitter/checklists"
                    element={
                      <RoleGuard allowedRoles={['Submitter']}>
                        <SubmitterChecklistPage />
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
                    path="/reviewer/drawings/:id/viewport"
                    element={
                      <RoleGuard allowedRoles={['Reviewer']}>
                        <DrawingViewportPage />
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
                    path="/approver/drawings/:id/viewport"
                    element={
                      <RoleGuard allowedRoles={['Approver']}>
                        <DrawingViewportPage />
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

                  {/* Unified Direct Drawing Viewport Route */}
                  <Route
                    path="/drawings/:id/viewport"
                    element={
                      <RoleGuard allowedRoles={['Submitter', 'Reviewer', 'Approver', 'Admin']}>
                        <DrawingViewportPage />
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
              </Route>));

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={themeConfig} locale={viVN}>
        <AntdApp message={{ maxCount: 1, duration: 2 }}>
          <AuthProvider>
            <NotificationProvider>
              <RouterProvider router={router} />
          </NotificationProvider>
        </AuthProvider>
      </AntdApp>
    </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
