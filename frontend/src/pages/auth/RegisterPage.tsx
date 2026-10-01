import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, message, Space } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, IdcardOutlined, SafetyOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, type RegisterDto } from '../../services/authApi';
import axios from 'axios';

const { Title, Text } = Typography;

export const RegisterPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values: RegisterDto & { confirmPassword: string }) => {
    setLoading(true);
    try {
      await authApi.register({
        username: values.username,
        email: values.email,
        fullName: values.fullName,
        password: values.password,
      });

      message.success('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
      navigate('/auth/login');
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data;
        const errorMsg = errorData.detail || errorData.message || errorData.title || 'Đăng ký không thành công';

        // Check if error corresponds to username or email conflict
        if (typeof errorMsg === 'string') {
          if (errorMsg.toLowerCase().includes('username') || errorMsg.toLowerCase().includes('tên đăng nhập')) {
            form.setFields([{ name: 'username', errors: [errorMsg] }]);
            return;
          }
          if (errorMsg.toLowerCase().includes('email')) {
            form.setFields([{ name: 'email', errors: [errorMsg] }]);
            return;
          }
        }
        message.error(errorMsg);
      } else {
        message.error('Có lỗi xảy ra, vui lòng thử lại.');
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
          maxWidth: 440,
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          border: '1px solid #E4E7ED',
        }}
        bodyStyle={{ padding: '32px 28px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, color: '#1F2937', fontWeight: 600 }}>
            Đăng ký tài khoản
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Tạo tài khoản kỹ sư mới để tham gia quy trình nghiệm thu
          </Text>
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark="optional">
          <Form.Item
            name="username"
            label="Tên đăng nhập"
            rules={[
              { required: true, message: 'Vui lòng nhập tên đăng nhập' },
              { min: 3, message: 'Tên đăng nhập phải có ít nhất 3 ký tự' },
            ]}
          >
            <Input prefix={<UserOutlined style={{ color: '#8C8C8C' }} />} placeholder="VD: kisu_an" size="large" />
          </Form.Item>

          <Form.Item
            name="fullName"
            label="Họ và tên"
            rules={[{ required: true, message: 'Vui lòng nhập họ và tên đầy đủ' }]}
          >
            <Input prefix={<IdcardOutlined style={{ color: '#8C8C8C' }} />} placeholder="VD: Nguyễn Văn An" size="large" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Địa chỉ email không đúng định dạng' },
            ]}
          >
            <Input prefix={<MailOutlined style={{ color: '#8C8C8C' }} />} placeholder="VD: an.nguyen@congtrinh.vn" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Mật khẩu"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu' },
              { min: 6, message: 'Mật khẩu phải chứa ít nhất 6 ký tự' },
            ]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#8C8C8C' }} />} placeholder="Nhập ít nhất 6 ký tự" size="large" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Xác nhận mật khẩu"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận mật khẩu' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#8C8C8C' }} />} placeholder="Nhập lại mật khẩu" size="large" />
          </Form.Item>

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
              Đăng ký
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Đã có tài khoản?{' '}
            </Text>
            <Link to="/auth/login" style={{ color: '#1677FF', fontWeight: 500 }}>
              Đăng nhập ngay
            </Link>
          </div>
        </Form>
      </Card>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          © 2026 ConstructInspect Enterprise. Chuẩn nghiệm thu công trình.
        </Text>
      </div>
    </div>
  );
};
