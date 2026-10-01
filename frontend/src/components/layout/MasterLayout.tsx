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

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export const MasterLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    window.location.href = '/auth/login';
  };

  // Tag color mapping by role per design spec
  const getRoleTagColor = (role: UserRole) => {
    switch (role) {
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

  // Build menu items strictly separated based on user role
  const getMenuItems = (): MenuProps['items'] => {
    if (!user || !user.role) return [];

    switch (user.role) {
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
            <Tag color={getRoleTagColor(user?.role || null)} style={{ marginLeft: 6, fontWeight: 500 }}>
              {user?.role || 'Chưa gán quyền'}
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
        {user?.role && (
          <Sider
            width={220}
            style={{
              backgroundColor: '#FFFFFF',
              borderRight: '1px solid #E4E7ED',
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              onClick={({ key }) => navigate(key)}
              items={getMenuItems()}
              style={{ height: '100%', borderRight: 0, paddingTop: 8 }}
            />
          </Sider>
        )}

        <Content
          style={{
            backgroundColor: '#F5F7FA',
            padding: '24px',
            minHeight: 'calc(100vh - 64px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
