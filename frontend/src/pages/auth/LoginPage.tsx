import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, Checkbox, Alert, Space } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getDefaultRouteForRole } from '../../components/guards/RouteGuards';
import { authApi, type LoginDto } from '../../services/authApi';
import axios from 'axios';

const { Title, Text } = Typography;

export const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values: LoginDto & { remember: boolean }) => {
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
      if (axios.isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data;
        const msg = errorData.detail || errorData.message || errorData.title || 'Sai tài khoản hoặc mật khẩu';
        setErrorMessage(typeof msg === 'string' ? msg : 'Sai tài khoản hoặc mật khẩu');
      } else {
        setErrorMessage('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại dịch vụ Backend.');
      }
    } finally {
      setLoading(false);
    }
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
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          border: '1px solid #E4E7ED',
        }}
        bodyStyle={{ padding: '32px 28px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: '#1F2937', fontWeight: 600 }}>
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
          initialValues={{ remember: true }}
          onFinish={onFinish}
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label="Tài khoản"
            rules={[{ required: true, message: 'Vui lòng nhập tài khoản hoặc username' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#8C8C8C' }} />}
              placeholder="VD: admin hoặc tên đăng nhập"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#8C8C8C' }} />}
              placeholder="Mật khẩu"
              size="large"
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox style={{ color: '#595959' }}>Ghi nhớ đăng nhập</Checkbox>
            </Form.Item>
          </div>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              style={{
                backgroundColor: '#1677FF',
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
            <Link to="/auth/register" style={{ color: '#1677FF', fontWeight: 500 }}>
              Đăng ký ngay
            </Link>
          </div>
        </Form>
      </Card>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Tài khoản Admin mặc định: <code style={{ fontFamily: 'JetBrains Mono' }}>admin</code> / <code style={{ fontFamily: 'JetBrains Mono' }}>Admin@123</code>
        </Text>
      </div>
    </div>
  );
};
