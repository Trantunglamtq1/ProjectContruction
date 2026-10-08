import React, { useState } from 'react';
import { Card, Form, Input, Button, Typography, message, Space, Alert } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, IdcardOutlined, SafetyOutlined, CheckCircleOutlined, RedoOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, type RegisterDto } from '../../services/authApi';
import { useAuth } from '../../contexts/AuthContext';
import { getDefaultRouteForRole } from '../../components/guards/RouteGuards';
import axios from 'axios';

const { Title, Text } = Typography;

export const RegisterPage: React.FC = () => {
  const [form] = Form.useForm();
  const [otpForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [step, setStep] = useState<'register' | 'otp'>('register');
  const [registeredInfo, setRegisteredInfo] = useState<{ username: string; email: string } | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const onRegisterFinish = async (values: RegisterDto & { confirmPassword: string }) => {
    setLoading(true);
    try {
      await authApi.register({
        username: values.username,
        email: values.email,
        fullName: values.fullName,
        password: values.password,
      });

      setRegisteredInfo({
        username: values.username,
        email: values.email,
      });
      setStep('otp');
      message.success('Đăng ký thành công! Mã xác thực đã được gửi về email của bạn.');
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data;
        const errorMsg = errorData.detail || errorData.message || errorData.title || 'Đăng ký không thành công';

        if (typeof errorMsg === 'string') {
          if (errorMsg.toLowerCase().includes('username') || errorMsg.toLowerCase().includes('tên đăng nhập')) {
            form.setFields([{ name: 'username', errors: [errorMsg] }]);
            return;
          }
        }
        message.error(typeof errorMsg === 'string' ? errorMsg : 'Đăng ký không thành công');
      } else {
        message.error('Có lỗi xảy ra, vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onOtpFinish = async (values: { otpCode: string }) => {
    if (!registeredInfo) return;
    setOtpLoading(true);
    try {
      const response = await authApi.confirmEmail({
        username: registeredInfo.username,
        otpCode: values.otpCode,
      });

      message.success('Kích hoạt tài khoản thành công!');
      login(response.token, response);

      const rawRole = response.user.roleName;
      const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;
      const targetRoute = getDefaultRouteForRole(role);
      navigate(targetRoute, { replace: true });
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data;
        const errorMsg = errorData.detail || errorData.message || errorData.title || 'Mã xác thực không hợp lệ';
        otpForm.setFields([{ name: 'otpCode', errors: [typeof errorMsg === 'string' ? errorMsg : 'Mã không đúng'] }]);
      } else {
        message.error('Lỗi xác thực, vui lòng kiểm tra lại.');
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!registeredInfo) return;
    setResending(true);
    try {
      const res = await authApi.resendOtp(registeredInfo.username);
      message.success(res.message || 'Đã gửi lại mã xác thực mới vào email của bạn!');
    } catch {
      message.error('Không thể gửi lại mã lúc này. Vui lòng thử lại sau.');
    } finally {
      setResending(false);
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
          maxWidth: 460,
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          border: '1px solid #E4E7ED',
        }}
        bodyStyle={{ padding: '32px 28px' }}
      >
        {step === 'register' ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Title level={3} style={{ margin: 0, color: '#1F2937', fontWeight: 600 }}>
                Đăng ký tài khoản
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Đăng ký để tham gia quy trình nghiệm thu công trình
              </Text>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={onRegisterFinish}
              requiredMark={false}
              scrollToFirstError
            >
              <Form.Item
                name="fullName"
                label="Họ và tên"
                rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
              >
                <Input prefix={<IdcardOutlined style={{ color: '#8C8C8C' }} />} placeholder="VD: Nguyễn Văn A" size="large" />
              </Form.Item>

              <Form.Item
                name="username"
                label="Tên đăng nhập"
                rules={[
                  { required: true, message: 'Vui lòng nhập tên đăng nhập' },
                  { min: 3, message: 'Tên đăng nhập tối thiểu 3 ký tự' },
                  { pattern: /^[a-zA-Z0-9_]+$/, message: 'Chỉ chứa chữ cái, số và dấu gạch dưới' },
                ]}
              >
                <Input prefix={<UserOutlined style={{ color: '#8C8C8C' }} />} placeholder="VD: nguyenvana" size="large" />
              </Form.Item>

              <Form.Item
                name="email"
                label="Email (Nhận mã xác thực)"
                rules={[
                  { required: true, message: 'Vui lòng nhập email thật để nhận mã xác thực' },
                  { type: 'email', message: 'Địa chỉ email không đúng định dạng' },
                ]}
              >
                <Input prefix={<MailOutlined style={{ color: '#8C8C8C' }} />} placeholder="VD: an.nguyen@gmail.com" size="large" />
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
                  Đăng ký tài khoản
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
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <CheckCircleOutlined style={{ fontSize: 48, color: '#52C41A', marginBottom: 12 }} />
              <Title level={3} style={{ margin: 0, color: '#1F2937', fontWeight: 600 }}>
                Xác thực Email
              </Title>
              <Text type="secondary" style={{ fontSize: 13, marginTop: 4, display: 'block' }}>
                Mã xác thực OTP 6 số đã được gửi tới email:
              </Text>
              <Text strong style={{ color: '#1677FF', fontSize: 14 }}>
                {registeredInfo?.email}
              </Text>
            </div>

            <Alert
              type="info"
              showIcon
              message="Kiểm tra hòm thư của bạn"
              description="Vui lòng kiểm tra hộp thư đến (hoặc hòm thư Spam/Rác) để lấy mã xác thực gồm 6 chữ số."
              style={{ marginBottom: 20 }}
            />

            <Form
              form={otpForm}
              layout="vertical"
              onFinish={onOtpFinish}
              requiredMark={false}
            >
              <Form.Item
                name="otpCode"
                label="Mã xác thực OTP (6 chữ số)"
                rules={[
                  { required: true, message: 'Vui lòng nhập mã OTP' },
                  { len: 6, message: 'Mã OTP phải có đúng 6 chữ số' },
                ]}
              >
                <Input
                  placeholder="VD: 123456"
                  size="large"
                  maxLength={6}
                  style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 700 }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 12 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  loading={otpLoading}
                  style={{
                    backgroundColor: '#1677FF',
                    height: 42,
                    fontWeight: 600,
                  }}
                >
                  Xác nhận & Vào hệ thống
                </Button>
              </Form.Item>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <Button
                  type="link"
                  icon={<RedoOutlined />}
                  onClick={handleResendOtp}
                  loading={resending}
                  style={{ padding: 0, fontSize: 13 }}
                >
                  Gửi lại mã OTP
                </Button>

                <Link to="/auth/login" style={{ fontSize: 13, color: '#8C8C8C' }}>
                  Quay lại Đăng nhập
                </Link>
              </div>
            </Form>
          </>
        )}
      </Card>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          © 2026 ConstructInspect Enterprise. Chuẩn nghiệm thu công trình.
        </Text>
      </div>
    </div>
  );
};
