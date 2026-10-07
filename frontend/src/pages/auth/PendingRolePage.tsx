import React, { useState, useEffect } from 'react';
import { Result, Button, Card, Typography, message, Space } from 'antd';
import { ClockCircleOutlined, ReloadOutlined, LogoutOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { getDefaultRouteForRole } from '../../components/guards/RouteGuards';
import type { UserRole } from '../../types/auth';

const { Title, Text, Paragraph } = Typography;

export const PendingRolePage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const [checking, setChecking] = useState(false);

  // Auto poll every 3 seconds: When Admin assigns a role, redirect automatically without F5
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const updatedUser = await refreshUser();
        const rawRole = updatedUser?.roleName;
        const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;
        if (role) {
          message.success(`Tài khoản đã được phê duyệt vai trò: ${role}`);
          const target = getDefaultRouteForRole(role as UserRole);
          window.location.href = target;
        }
      } catch {
        // Ignore background polling errors
      }
    }, 3000);

    return () => clearInterval(timer);
  }, [refreshUser]);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      const updatedUser = await refreshUser();
      const rawRole = updatedUser?.roleName;
      const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;
      if (role) {
        message.success(`Tài khoản đã được gán vai trò: ${role}`);
        const target = getDefaultRouteForRole(role as UserRole);
        window.location.href = target;
      } else {
        message.info('Tài khoản của bạn vẫn đang chờ Admin phê duyệt vai trò.');
      }
    } catch {
      message.error('Không thể kiểm tra trạng thái lúc này. Vui lòng thử lại sau.');
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/auth/login';
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F7FA',
        padding: '24px 16px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Space direction="horizontal" align="center" style={{ marginBottom: 8 }}>
          <SafetyOutlined style={{ fontSize: 32, color: '#1677FF' }} />
          <Title level={2} style={{ margin: 0, color: '#1F2937', fontWeight: 700 }}>
            ConstructInspect
          </Title>
        </Space>
      </div>

      <Card
        style={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          border: '1px solid #E4E7ED',
          textAlign: 'center',
        }}
        bodyStyle={{ padding: '36px 32px' }}
      >
        <Result
          icon={<ClockCircleOutlined style={{ color: '#FAAD14', fontSize: 64 }} />}
          title={
            <span style={{ fontSize: 20, fontWeight: 600, color: '#1F2937' }}>
              Tài khoản đang chờ phê duyệt
            </span>
          }
          subTitle={
            <div style={{ marginTop: 8 }}>
              <Paragraph style={{ color: '#595959', fontSize: 14, marginBottom: 8 }}>
                Chào mừng <strong style={{ color: '#1F2937' }}>{user?.fullName || user?.username}</strong>!
              </Paragraph>
              <Paragraph style={{ color: '#8C8C8C', fontSize: 13, marginBottom: 0 }}>
                Tài khoản của bạn đã được đăng ký thành công nhưng đang chờ Quản trị viên (Admin) phân quyền vai trò (Submitter / Reviewer / Approver).
              </Paragraph>
            </div>
          }
          extra={[
            <Button
              key="refresh"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={checking}
              size="large"
              style={{
                borderRadius: 4,
                borderColor: '#D9D9D9',
                color: '#1F2937',
              }}
            >
              Tải lại trang kiểm tra
            </Button>,
            <Button
              key="logout"
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              size="large"
              style={{
                color: '#8C8C8C',
              }}
            >
              Đăng xuất
            </Button>,
          ]}
        />
      </Card>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Bạn cần liên hệ Quản trị viên hệ thống để được cấp quyền sử dụng các phân hệ.
        </Text>
      </div>
    </div>
  );
};
