import { PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Drawer, Empty, Form, Input, Modal, Popconfirm, Select, Space, Table, Typography } from 'antd';
import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { QueryState } from '../../components/ui/QueryState';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { roleLabels } from '../../config/statuses';
import { projectApi, type ProjectDto } from '../../services/projectApi';
import { userApi } from '../../services/userApi';

export function ProjectsPage() {
  const { user } = useAuth();
  const admin = user?.role === 'Admin';
  const { projects, loading, error, refresh, selectProject } = useProject();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [managed, setManaged] = useState<ProjectDto | null>(null);
  const [selectedUser, setSelectedUser] = useState<string>();
  const [form] = Form.useForm<{ code: string; name: string }>();
  const members = useQuery({ queryKey: ['project-members', managed?.id], queryFn: () => projectApi.members(managed!.id), enabled: admin && !!managed });
  const users = useQuery({ queryKey: ['admin-users'], queryFn: userApi.getUsers, enabled: admin && !!managed });
  const failed = () => { message.error('Không thể lưu thay đổi. Vui lòng kiểm tra quyền và thử lại.'); };
  const create = useMutation({ mutationFn: projectApi.create, onSuccess: () => { refresh(); setCreating(false); form.resetFields(); message.success('Đã tạo dự án.'); }, onError: failed });
  const assign = useMutation({ mutationFn: (id: string) => projectApi.assign(managed!.id, id), onSuccess: () => { setSelectedUser(undefined); void members.refetch(); }, onError: failed });
  const revoke = useMutation({ mutationFn: (id: string) => projectApi.revoke(managed!.id, id), onSuccess: () => { void members.refetch(); void queryClient.invalidateQueries({ queryKey: ['projects'] }); }, onError: failed });
  const eligible = (users.data ?? []).filter(u => u.isActive && ['Submitter', 'Reviewer', 'Approver'].includes(u.roleName ?? '') && !members.data?.some(m => m.userId === u.id));
  return <div className="data-page">
    <PageHeader title="Dự án" count={`${projects.length} dự án`} actions={admin ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Tạo dự án</Button> : undefined} />
    {error ? <QueryState error={error} retry={refresh} entity="dự án" /> : <Card className="list-surface">
      <Table<ProjectDto> rowKey="id" loading={loading} dataSource={projects} pagination={false} locale={{ emptyText: <Empty description={admin ? 'Chưa có dự án.' : 'Bạn chưa được phân công vào dự án nào. Liên hệ quản trị viên để được cấp quyền.'} /> }} columns={[
        { title: 'Mã dự án', dataIndex: 'code', width: 180 }, { title: 'Tên dự án', dataIndex: 'name' },
        { title: 'Thao tác', key: 'actions', width: 280, render: (_, project) => <Space>{!admin && <Button onClick={() => selectProject(project.id)}>Mở dự án</Button>}{admin && <Button icon={<TeamOutlined />} onClick={() => { setManaged(project); setSelectedUser(undefined); }}>Thành viên</Button>}</Space> },
      ]} />
    </Card>}
    <Modal title="Tạo dự án" open={creating} onCancel={() => setCreating(false)} onOk={() => form.submit()} confirmLoading={create.isPending} okText="Tạo dự án" cancelText="Hủy" destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={values => create.mutate(values)}>
        <Form.Item label="Mã dự án" name="code" rules={[{ required: true, whitespace: true, max: 50 }]}><Input maxLength={50} /></Form.Item>
        <Form.Item label="Tên dự án" name="name" rules={[{ required: true, whitespace: true, max: 200 }]}><Input maxLength={200} /></Form.Item>
      </Form>
    </Modal>
    <Drawer title={`Thành viên · ${managed?.name ?? ''}`} open={!!managed} onClose={() => setManaged(null)} size={640} destroyOnHidden>
      <Typography.Paragraph type="secondary">Thành viên giữ nguyên vai trò nghiệp vụ. Thu hồi phân công có hiệu lực với các yêu cầu tiếp theo.</Typography.Paragraph>
      <Space.Compact style={{ width: '100%', marginBottom: 20 }}>
        <Select style={{ flex: 1 }} aria-label="Chọn kỹ sư" placeholder="Chọn kỹ sư đang hoạt động" showSearch optionFilterProp="label" value={selectedUser} onChange={setSelectedUser} loading={users.isFetching}
          options={eligible.map(u => ({ value: u.id, label: `${u.fullName || u.username} · ${roleLabels[u.roleName ?? ''] ?? u.roleName}` }))} />
        <Button type="primary" disabled={!selectedUser || members.isFetching} loading={assign.isPending} onClick={() => selectedUser && assign.mutate(selectedUser)}>Phân công</Button>
      </Space.Compact>
      {(members.error || users.error) && <QueryState error={members.error || users.error} retry={() => { void members.refetch(); void users.refetch(); }} entity="thành viên" />}
      <Table rowKey="userId" loading={members.isFetching} dataSource={members.data ?? []} pagination={false} columns={[
        { title: 'Kỹ sư', render: (_, m) => <div><strong>{m.fullName || m.username}</strong><div>{m.email}</div></div> },
        { title: 'Vai trò', render: (_, m) => roleLabels[m.roleName] ?? m.roleName },
        { title: '', render: (_, m) => <Popconfirm title="Thu hồi quyền truy cập dự án?" okText="Thu hồi" cancelText="Hủy" onConfirm={() => revoke.mutateAsync(m.userId)}><Button danger loading={revoke.isPending}>Thu hồi</Button></Popconfirm> },
      ]} />
    </Drawer>
  </div>;
}
