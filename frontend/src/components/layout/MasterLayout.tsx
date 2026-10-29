import React, { useState, useEffect } from 'react';
import { Layout, Menu, Typography, Avatar, Tag, Button, Space } from 'antd';
import type { MenuProps } from 'antd';
import {
  SafetyOutlined,
  UserOutlined,
  LogoutOutlined,
  TeamOutlined,
  FilePdfOutlined,
  FileDoneOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types/auth';
import { NotificationBell } from './NotificationBell';

const { Header, Sider, Content, Footer } = Layout;
const { Text } = Typography;

export const MasterLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isViewportPage = location.pathname.includes('/viewport');
  const [collapsed, setCollapsed] = useState<boolean>(isViewportPage);

  useEffect(() => {
    setCollapsed(isViewportPage);
  }, [isViewportPage]);

  // Tự động active Menu item tương ứng kể cả khi đang xem trang con (như Viewport)
  const getActiveMenuKey = () => {
    const path = location.pathname;
    if (path.includes('/drawings')) {
      if (path.startsWith('/submitter')) return '/submitter/drawings';
      if (path.startsWith('/reviewer')) return '/reviewer/drawings';
      if (path.startsWith('/approver')) return '/approver/drawings';
      return '/submitter/drawings';
    }
    if (path.includes('/checklists')) {
      if (path.startsWith('/submitter')) return '/submitter/checklists';
      if (path.startsWith('/reviewer')) return '/reviewer/checklists';
      if (path.startsWith('/approver')) return '/approver/checklists';
    }
    if (path.includes('/inspections')) {
      if (path.startsWith('/submitter')) return '/submitter/inspections';
      if (path.startsWith('/reviewer')) return '/reviewer/inspections';
      if (path.startsWith('/approver')) return '/approver/inspections';
    }
    if (path.startsWith('/admin/users')) return '/admin/users';
    return path;
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/auth/login';
  };

  // Tag color mapping by role per design spec
  const getRoleTagColor = (role: UserRole | string | string[] | null) => {
    const actualRole = Array.isArray(role) ? role[0] : role;
    switch (actualRole) {
      case 'Admin':
        return 'purple';
      case 'Submitter':
        return 'blue';
      case 'Reviewer':
        return 'cyan';
      case 'Approver':
        return 'orange';
      default:
        return 'default';
    }
  };

  const currentRole = ((Array.isArray(user?.role) ? user?.role[0] : user?.role) as UserRole) || null;

  // Build menu items strictly separated based on user role
  const getMenuItems = (): MenuProps['items'] => {
    if (!user || !currentRole) return [];

    switch (currentRole) {
      case 'Admin':
        return [
          {
            key: '/admin/users',
            icon: <TeamOutlined />,
            label: 'Quản lý người dùng',
          },
        ];

      case 'Submitter':
        return [
          {
            key: '/submitter/drawings',
            icon: <FilePdfOutlined />,
            label: 'Bản vẽ & Viewport',
          },
          {
            key: '/submitter/checklists',
            icon: <CheckSquareOutlined />,
            label: 'Checklist & Form.io',
          },
          {
            key: '/submitter/inspections',
            icon: <FileDoneOutlined />,
            label: 'Hồ sơ Inspection',
          },
        ];

      case 'Reviewer':
        return [
          {
            key: '/reviewer/drawings',
            icon: <FilePdfOutlined />,
            label: 'Bản vẽ công trình',
          },
          {
            key: '/reviewer/inspections',
            icon: <FileDoneOutlined />,
            label: 'Thẩm tra Inspection',
          },
          {
            key: '/reviewer/checklists',
            icon: <CheckSquareOutlined />,
            label: 'Quản lý Checklist',
          },
        ];

      case 'Approver':
        return [
          {
            key: '/approver/drawings',
            icon: <FilePdfOutlined />,
            label: 'Bản vẽ dự án',
          },
          {
            key: '/approver/inspections',
            icon: <FileDoneOutlined />,
            label: 'Phê duyệt nghiệm thu',
          },
          {
            key: '/approver/checklists',
            icon: <CheckSquareOutlined />,
            label: 'Tra cứu Checklist',
          },
        ];

      default:
        return [];
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FFFFFF',
          padding: '0 24px',
          height: 64,
          borderBottom: '1px solid #E4E7ED',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SafetyOutlined style={{ fontSize: 26, color: '#1677FF' }} />
          <Text strong style={{ fontSize: 18, color: '#1F2937', letterSpacing: '-0.01em' }}>
            ConstructInspect
          </Text>
          <span style={{ color: '#D9D9D9', margin: '0 8px' }}>|</span>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Hệ thống Quản lý Nghiệm thu Công trình
          </Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <NotificationBell />
          <div style={{ width: 1, height: 24, backgroundColor: '#E5E7EB' }} />
          <Space orientation="horizontal" size={8} align="center">
            <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: '#1677FF' }} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text strong style={{ fontSize: 13, lineHeight: '18px', color: '#1F2937' }}>
                {user?.fullName || user?.username}
              </Text>
              <Text type="secondary" style={{ fontSize: 11, lineHeight: '14px' }}>
                @{user?.username}
              </Text>
            </div>
            <Tag color={getRoleTagColor(currentRole)} style={{ marginLeft: 6, fontWeight: 500 }}>
              {currentRole || 'Chưa gán quyền'}
            </Tag>
          </Space>

          <Button
            type="text"
            danger
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{ fontSize: 13, fontWeight: 500 }}
          >
            Đăng xuất
          </Button>
        </div>
      </Header>

      <Layout>
        {currentRole && (
          <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={(val) => setCollapsed(val)}
            width={220}
            collapsedWidth={isViewportPage ? 0 : 80}
            style={{
              backgroundColor: '#FFFFFF',
              borderRight: '1px solid #E4E7ED',
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={[getActiveMenuKey()]}
              onClick={({ key }) => navigate(key)}
              items={getMenuItems()}
              style={{ height: '100%', borderRight: 0, paddingTop: 8 }}
            />
          </Sider>
        )}

        <Layout style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 64px)' }}>
          <Content
            style={{
              backgroundColor: isViewportPage ? '#0f172a' : '#F5F7FA',
              padding: isViewportPage ? 0 : '24px',
              height: isViewportPage ? 'calc(100vh - 64px)' : undefined,
              minHeight: isViewportPage ? undefined : 'calc(100vh - 64px - 54px)',
              overflow: isViewportPage ? 'hidden' : 'auto',
              flex: 1,
            }}
          >
            <Outlet />
          </Content>

          {!isViewportPage && (
            <Footer
              style={{
                textAlign: 'center',
                padding: '16px 24px',
                backgroundColor: '#FFFFFF',
                borderTop: '1px solid #E4E7ED',
                color: '#8C8C8C',
                fontSize: 13,
              }}
            >
              ConstructInspect © {new Date().getFullYear()} — Hệ thống Quản lý & Giám sát Nghiệm thu Công trình
            </Footer>
          )}
        </Layout>
      </Layout>
    </Layout>
  );
};
