import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StopOutlined,
  UserAddOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import React, { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { QueryState } from '../../components/ui/QueryState';
import { roleLabels } from '../../config/statuses';
import { useAuth } from '../../contexts/AuthContext';
import { userApi } from '../../services/userApi';
import type { UserDto } from '../../types/auth';

const { Text } = Typography;

export const UserManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State for Assigning / Changing Role
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleForm] = Form.useForm();
  const selectedRoleId = Form.useWatch('roleId', roleForm);

  // Queries
  const {
    data: users = [],
    error: listError,
    isLoading: isLoadingUsers,
    refetch: refetchUsers,
    isRefetching,
  } = useQuery({
    queryKey: ['admin-users'],
    queryFn: userApi.getUsers,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: userApi.getRoles,
  });

  // Mutation: Assign / Change Role
  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string | null }) =>
      userApi.assignRole(userId, roleId),
    onSuccess: (updatedUser) => {
      message.success(`Đã cập nhật vai trò cho người dùng "${updatedUser.username}" thành công.`);
      setIsRoleModalOpen(false);
      setSelectedUser(null);
      roleForm.resetFields();

      // Cập nhật ngay lập tức vào state cache của React Query để bảng thay đổi tức thì (0ms)
      queryClient.setQueryData<UserDto[]>(['admin-users'], (oldUsers = []) =>
        oldUsers.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u))
      );
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      const errorMsg =
        error?.response?.data?.message || 'Có lỗi xảy ra khi cập nhật vai trò người dùng.';
      message.error(errorMsg);
    },
  });

  // Mutation: Update Active / Inactive Status
  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      userApi.updateStatus(userId, isActive),
    onSuccess: (updatedUser) => {
      const actionName = updatedUser.isActive ? 'Kích hoạt' : 'Vô hiệu hóa';
      message.success(`${actionName} tài khoản "${updatedUser.username}" thành công.`);

      // Cập nhật ngay lập tức vào state cache của React Query để bảng thay đổi tức thì (0ms)
      queryClient.setQueryData<UserDto[]>(['admin-users'], (oldUsers = []) =>
        oldUsers.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u))
      );
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error: any) => {
      const errorMsg =
        error?.response?.data?.message || 'Có lỗi xảy ra khi cập nhật trạng thái tài khoản.';
      message.error(errorMsg);
    },
  });

  // Open Modal to assign or change role
  const handleOpenRoleModal = (user: UserDto) => {
    setSelectedUser(user);
    roleForm.setFieldsValue({
      roleId: user.roleId || null,
    });
    setIsRoleModalOpen(true);
  };

  const handleRoleSubmit = async () => {
    try {
      const values = await roleForm.validateFields();
      if (!selectedUser) return;
      assignRoleMutation.mutate({
        userId: selectedUser.id,
        roleId: values.roleId !== undefined ? values.roleId : null,
      });
    } catch {
      // Validate error
    }
  };

  const handleToggleStatus = (user: UserDto) => {
    updateStatusMutation.mutate({
      userId: user.id,
      isActive: !user.isActive,
    });
  };

  // Filter Logic
  const filteredUsers = users.filter((u) => {
    // Search by username, fullName, or email
    const term = searchText.trim().toLowerCase();
    const matchText =
      !term ||
      u.username.toLowerCase().includes(term) ||
      u.fullName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term);

    // Filter by role
    let matchRole = true;
    if (roleFilter === 'UNASSIGNED') {
      matchRole = !u.roleName;
    } else if (roleFilter !== 'ALL') {
      matchRole = u.roleName === roleFilter;
    }

    // Filter by status
    let matchStatus = true;
    if (statusFilter === 'ACTIVE') {
      matchStatus = u.isActive === true;
    } else if (statusFilter === 'INACTIVE') {
      matchStatus = u.isActive === false;
    }

    return matchText && matchRole && matchStatus;
  });

  // Role Tag Helper
  const renderRoleTag = (roleName: string | null) => {
    switch (roleName) {
      case 'Admin':
        return <Tag icon={<SafetyCertificateOutlined />}>{roleLabels.Admin}</Tag>;
      case 'Submitter':
        return <Tag>{roleLabels.Submitter}</Tag>;
      case 'Reviewer':
        return <Tag>{roleLabels.Reviewer}</Tag>;
      case 'Approver':
        return <Tag>{roleLabels.Approver}</Tag>;
      default:
        return <Tag color="default">Chưa gán vai trò</Tag>;
    }
  };

  // Table Columns
  const columns = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Tên đăng nhập',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: UserDto) => {
        const isSelf = record.id === currentUser?.id;
        return (
          <Space orientation="horizontal" size={6}>
            <Text strong>{text}</Text>
            {isSelf && <Tag color="purple">Bạn</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Họ và tên',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (text: string) => text || '—',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (text: string) => text || '—',
    },
    {
      title: 'Vai trò hiện tại',
      dataIndex: 'roleName',
      key: 'roleName',
      width: 140,
      render: (roleName: string | null) => renderRoleTag(roleName),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 130,
      align: 'center' as const,
      render: (isActive: boolean) => (
        <Badge
          status={isActive ? 'success' : 'error'}
          text={
            <span style={{ color: isActive ? '#166534' : '#B42318', fontWeight: 500 }}>
              {isActive ? 'Hoạt động' : 'Đã khóa'}
            </span>
          }
        />
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (dateStr: string) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 220,
      align: 'center' as const,
      render: (_: any, record: UserDto) => {
        const isSelf = record.id === currentUser?.id;
        const hasRole = !!record.roleId;

        return (
          <Space orientation="horizontal" size={8}>
            {/* Gán Role / Đổi Role */}
            <Tooltip
              title={
                isSelf
                  ? 'Không thể tự đổi vai trò của chính mình để tránh mất quyền quản trị'
                  : hasRole
                  ? 'Đổi vai trò người dùng'
                  : 'Gán vai trò nghiệp vụ'
              }
            >
              <Button aria-label={
                isSelf
                  ? 'Không thể tự đổi vai trò của chính mình để tránh mất quyền quản trị'
                  : hasRole
                  ? 'Đổi vai trò người dùng'
                  : 'Gán vai trò nghiệp vụ'
              }
                size="small"
                type="primary"
                ghost={hasRole}
                icon={hasRole ? <EditOutlined /> : <UserAddOutlined />}
                disabled={isSelf}
                onClick={() => handleOpenRoleModal(record)}
              >
                {hasRole ? 'Đổi vai trò' : 'Gán vai trò'}
              </Button>
            </Tooltip>

            {/* Vô hiệu hóa / Kích hoạt tài khoản */}
            <Tooltip
              title={
                isSelf
                  ? 'Không thể tự vô hiệu hóa tài khoản của chính mình'
                  : record.isActive
                  ? 'Vô hiệu hóa tài khoản này'
                  : 'Kích hoạt lại tài khoản này'
              }
            >
              <Popconfirm
                title={record.isActive ? 'Vô hiệu hóa tài khoản?' : 'Kích hoạt tài khoản?'}
                description={
                  record.isActive
                    ? `Người dùng "${record.username}" sẽ không thể đăng nhập vào hệ thống nữa.`
                    : `Người dùng "${record.username}" sẽ được phép đăng nhập lại bình thường.`
                }
                okText="Đồng ý"
                cancelText="Hủy"
                okButtonProps={{ danger: record.isActive }}
                disabled={isSelf}
                onConfirm={() => handleToggleStatus(record)}
              >
                <Button
                  size="small"
                  danger={record.isActive}
                  type={record.isActive ? 'default' : 'primary'}

                  icon={record.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
                  disabled={isSelf}
                  loading={updateStatusMutation.isPending && updateStatusMutation.variables?.userId === record.id}
                >
                  {record.isActive ? 'Khóa' : 'Mở khóa'}
                </Button>
              </Popconfirm>
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="data-page">
      {/* Page Header */}
      <PageHeader title="Người dùng" count={`${filteredUsers.length} người dùng`} />
      {listError && <QueryState error={listError} retry={() => refetchUsers()} entity="người dùng" />}

      {/* KPI Statistic Cards */}

      {/* Filter Card */}
      <Card className="list-surface">
        <Space wrap size={[16, 12]} style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap size={12}>
            {/* Search Input */}
            <Input
              placeholder="Tìm theo tên đăng nhập, họ tên, email..."
              prefix={<SearchOutlined style={{ color: '#667085' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear={{ clearIcon: <CloseCircleOutlined aria-label="Xóa tìm kiếm" /> }}
              style={{ width: 280 }}
            />

            {/* Role Filter */}
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              style={{ width: 170 }}
              options={[
                { value: 'ALL', label: 'Tất cả vai trò' },
                { value: 'Admin', label: roleLabels.Admin },
                { value: 'Submitter', label: roleLabels.Submitter },
                { value: 'Reviewer', label: roleLabels.Reviewer },
                { value: 'Approver', label: roleLabels.Approver },
                { value: 'UNASSIGNED', label: 'Chưa gán vai trò' },
              ]}
            />

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 170 }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'ACTIVE', label: 'Đang hoạt động' },
                { value: 'INACTIVE', label: 'Đã vô hiệu hóa' },
              ]}
            />
          </Space>

          <Button
            icon={<ReloadOutlined spin={isRefetching} />}
            onClick={() => refetchUsers()}
          >
            Làm mới
          </Button>
        </Space>
      </Card>

      {/* Users Table */}
      <Card className="list-surface">
        <Table locale={{ emptyText: listError ? null : <QueryState filtered={Boolean(searchText || roleFilter !== 'ALL' || statusFilter !== 'ALL')} entity="người dùng" /> }} scroll={{ x: 1100 }}
          dataSource={filteredUsers}
          columns={columns}
          rowKey="id"
          loading={isLoadingUsers}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng cộng ${total} người dùng`,
          }}

          size="middle"
        />
      </Card>

      {/* Modal Gán / Đổi Role */}
      <Modal
        title={
          <Space>
            <UserOutlined style={{ color: '#1D4ED8' }} />
            <span>
              {selectedUser?.roleId ? 'Đổi vai trò người dùng' : 'Gán vai trò người dùng'}:{' '}
              <Text strong>{selectedUser?.fullName || selectedUser?.username}</Text>
            </span>
          </Space>
        }
        open={isRoleModalOpen}
        onOk={handleRoleSubmit}
        onCancel={() => {
          setIsRoleModalOpen(false);
          setSelectedUser(null);
          roleForm.resetFields();
        }}
        confirmLoading={assignRoleMutation.isPending}
        okText="Lưu vai trò"
        cancelText="Hủy"
        destroyOnClose
      >
        <div style={{ marginTop: 16, marginBottom: 16 }}>
          <Text type="secondary">
            Chọn vai trò nghiệp vụ phù hợp để cấp quyền cho người dùng trên hệ thống quản lý nghiệm thu:
          </Text>
        </div>

        <Form form={roleForm} layout="vertical">
          <Form.Item name="roleId" label="Vai trò" rules={[{ required: false }]}>
            <Radio.Group style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {roles.map((r) => {
                  const isSelected = selectedRoleId === r.id;
                  return (
                    <Card
                      key={r.id}
                      size="small"
                      onClick={() => roleForm.setFieldValue('roleId', r.id)}
                      style={{
                        cursor: 'pointer',
                        borderRadius: 6,
                        backgroundColor: isSelected ? '#E6F4FF' : '#FAFAFA',
                        borderColor: isSelected ? '#1D4ED8' : '#E4E7ED',
                        borderWidth: isSelected ? 2 : 1,
                        transition: 'all 0.2s',
                      }}
                    >
                      <Radio value={r.id}>
                        <Space>
                          <Text strong style={{ color: isSelected ? '#1D4ED8' : '#1F2937' }}>{roleLabels[r.name] || r.name}</Text>
                        </Space>
                        {r.description && (
                          <div style={{ marginTop: 4, color: '#667085', fontSize: 13, paddingLeft: 24 }}>
                            {r.description}
                          </div>
                        )}
                      </Radio>
                    </Card>
                  );
                })}

                {/* Tùy chọn Hủy gán Role (Về trạng thái chờ) */}
                {(() => {
                  const isRevokeSelected = selectedRoleId === null;
                  return (
                    <Card
                      size="small"
                      onClick={() => roleForm.setFieldValue('roleId', null)}
                      style={{
                        cursor: 'pointer',
                        borderRadius: 6,
                        backgroundColor: isRevokeSelected ? '#FFF1F0' : '#FAFAFA',
                        borderColor: isRevokeSelected ? '#FFA39E' : '#E4E7ED',
                        borderWidth: isRevokeSelected ? 2 : 1,
                        transition: 'all 0.2s',
                      }}
                    >
                      <Radio value={null}>
                        <Space>
                          <Text strong type="danger">
                            Hủy gán quyền (Thu hồi toàn bộ vai trò)
                          </Text>
                        </Space>
                        <div style={{ marginTop: 4, color: '#CF1322', fontSize: 13, paddingLeft: 24 }}>
                          Người dùng sẽ quay về màn hình chờ gán quyền và không truy cập được dữ liệu nghiệp vụ.
                        </div>
                      </Radio>
                    </Card>
                  );
                })()}
              </Space>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
