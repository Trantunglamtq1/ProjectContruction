import { LockOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import axios from 'axios';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDefaultRouteForRole } from '../../components/guards/RouteGuards';
import { useAuth } from '../../contexts/AuthContext';
import { authApi, type LoginDto } from '../../services/authApi';

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values: LoginDto) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await authApi.login({
        username: values.username,
        password: values.password,
      });

      // Save token and decoded claims to AuthContext
      login(response.token, response);

      // Determine navigation target strictly separated based on user role
      const rawRole = response.user.roleName;
      const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;
      const targetRoute = getDefaultRouteForRole(role);
      navigate(targetRoute, { replace: true });
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const status = error.response.status;
          if (status === 502 || status === 504) {
            setErrorMessage('Lỗi kết nối máy chủ (502 Bad Gateway). Dịch vụ đang khởi động. Vui lòng thử lại sau.');
          } else if (status >= 500) {
            setErrorMessage(`Lỗi máy chủ nội bộ (${status}). Vui lòng thử lại sau.`);
          } else if (error.response.data && typeof error.response.data === 'object') {
            const errorData = error.response.data as Record<string, unknown>;
            const msg = errorData.detail || errorData.message || errorData.title || 'Tên đăng nhập hoặc mật khẩu không chính xác.';
            setErrorMessage(typeof msg === 'string' ? msg : 'Tên đăng nhập hoặc mật khẩu không chính xác.');
          } else {
            setErrorMessage('Tên đăng nhập hoặc mật khẩu không chính xác.');
          }
        } else {
          setErrorMessage('Không thể kết nối đến máy chủ. Vui lòng thử lại hoặc liên hệ quản trị viên.');
        }
      } else {
        setErrorMessage('Đã xảy ra lỗi không xác định.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-page"
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Space direction="horizontal" align="center" style={{ marginBottom: 8 }}>
          <SafetyOutlined style={{ fontSize: 32, color: '#1D4ED8' }} />
          <Title level={2} style={{ margin: 0, color: '#182230', fontWeight: 700 }}>
            ConstructInspect
          </Title>
        </Space>
        <div>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Hệ thống Quản lý Nghiệm thu & Checklist Công trình
          </Text>
        </div>
      </div>

      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 8,

          border: '1px solid #E4E7ED',
        }}
        styles={{ body: { padding: '32px 28px' } }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: '#182230', fontWeight: 600 }}>
            Đăng nhập
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Đăng nhập để vào hệ thống quản lý nghiệm thu
          </Text>
        </div>

        {errorMessage && (
          <Alert
            message={errorMessage}
            type="error"
            showIcon
            style={{ marginBottom: 20, borderRadius: 4 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"

          onFinish={onFinish}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label="Tài khoản"
            rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
          >
            <Input
              autoComplete="username"
              prefix={<UserOutlined style={{ color: '#667085' }} />}
              placeholder="Nhập tên đăng nhập"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
          >
            <Input.Password
              autoComplete="current-password"
              prefix={<LockOutlined style={{ color: '#667085' }} />}
              placeholder="Mật khẩu"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              style={{
                backgroundColor: '#1D4ED8',
                height: 42,
                fontWeight: 600,
              }}
            >
              Đăng nhập
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Chưa có tài khoản?{' '}
            </Text>
            <Link to="/auth/register" style={{ color: '#1D4ED8', fontWeight: 500 }}>
              Đăng ký ngay
            </Link>
          </div>
        </Form>
      </Card>

    </div>
  );
};
