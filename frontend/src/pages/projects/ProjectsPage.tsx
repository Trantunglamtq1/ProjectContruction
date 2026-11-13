import { PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { App, Button, Card, Empty, Form, Input, Modal, Space, Table } from 'antd';
import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';
import { QueryState } from '../../components/ui/QueryState';
import { ProjectMembersDrawer } from '../../components/projects/ProjectMembersDrawer';
import { useAuth } from '../../contexts/AuthContext';
import { useProject } from '../../contexts/ProjectContext';
import { projectApi, type ProjectDto } from '../../services/projectApi';

export function ProjectsPage() {
  const { user } = useAuth();
  const admin = user?.role === 'Admin';
  const { projects, loading, error, refresh, selectProject } = useProject();
  const { message } = App.useApp();
  const [creating, setCreating] = useState(false);
  const [managed, setManaged] = useState<ProjectDto | null>(null);
  const [form] = Form.useForm<{ code: string; name: string }>();
  const failed = () => { message.error('Không thể lưu thay đổi. Vui lòng kiểm tra quyền và thử lại.'); };
  const create = useMutation({ mutationFn: projectApi.create, onSuccess: () => { refresh(); setCreating(false); form.resetFields(); message.success('Đã tạo dự án.'); }, onError: failed });
  return <div className="data-page">
    <PageHeader title="Dự án" count={`${projects.length} dự án`} actions={admin ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Tạo dự án</Button> : undefined} />
    {error ? <QueryState error={error} retry={refresh} entity="dự án" /> : <Card className="list-surface">
      <Table<ProjectDto> rowKey="id" loading={loading} dataSource={projects} pagination={false} locale={{ emptyText: <Empty description={admin ? 'Chưa có dự án.' : 'Bạn chưa được phân công vào dự án nào. Liên hệ quản trị viên để được cấp quyền.'} /> }} columns={[
        { title: 'Mã dự án', dataIndex: 'code', width: 180 }, { title: 'Tên dự án', dataIndex: 'name' },
        { title: 'Thao tác', key: 'actions', width: 280, render: (_, project) => <Space>{!admin && <Button onClick={() => selectProject(project.id)}>Mở dự án</Button>}{admin && <Button icon={<TeamOutlined />} onClick={() => setManaged(project)}>Thành viên</Button>}</Space> },
      ]} />
    </Card>}
    <Modal title="Tạo dự án" open={creating} onCancel={() => setCreating(false)} onOk={() => form.submit()} confirmLoading={create.isPending} okText="Tạo dự án" cancelText="Hủy" destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={values => create.mutate(values)}>
        <Form.Item label="Mã dự án" name="code" rules={[{ required: true, whitespace: true, max: 50 }]}><Input maxLength={50} /></Form.Item>
        <Form.Item label="Tên dự án" name="name" rules={[{ required: true, whitespace: true, max: 200 }]}><Input maxLength={200} /></Form.Item>
      </Form>
    </Modal>
    {admin && managed && <ProjectMembersDrawer key={managed.id} project={managed} onClose={() => setManaged(null)} />}
  </div>;
}
