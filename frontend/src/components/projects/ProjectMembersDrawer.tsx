import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Drawer, Popconfirm, Select, Space, Table, Typography } from 'antd';
import { useState } from 'react';
import { roleLabels } from '../../config/statuses';
import { projectApi, type ProjectDto, type ProjectMemberDto } from '../../services/projectApi';
import { assignProjectMembers, eligibleProjectUsers } from '../../services/projectMembers';
import { userApi } from '../../services/userApi';
import { QueryState } from '../ui/QueryState';

export function ProjectMembersDrawer({ project, onClose }: { project: ProjectDto; onClose: () => void }) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const membersKey = ['project-members', project.id];
  const members = useQuery({ queryKey: membersKey, queryFn: () => projectApi.members(project.id) });
  const users = useQuery({ queryKey: ['admin-users'], queryFn: userApi.getUsers });
  const eligible = eligibleProjectUsers(users.data ?? [], members.data ?? []);
  const selection = selectedIds.filter(id => eligible.some(user => user.id === id));
  const unavailable = !members.isSuccess || !users.isSuccess || members.isFetching || users.isFetching;

  const assign = useMutation({
    mutationFn: (ids: string[]) => assignProjectMembers(project.id, ids, projectApi.assign),
    onSuccess: result => {
      // Use server-confirmed rows immediately, even if the subsequent refresh fails.
      queryClient.setQueryData<ProjectMemberDto[]>(membersKey, current => {
        const rows = new Map((current ?? []).map(member => [member.userId, member]));
        result.succeeded.forEach(member => rows.set(member.userId, member));
        return [...rows.values()];
      });
      setSelectedIds(result.failedIds);
      if (!result.failedIds.length) message.success(`Đã thêm ${result.succeeded.length} thành viên.`);
      else if (result.succeeded.length) message.warning(`Đã thêm ${result.succeeded.length} thành viên; ${result.failedIds.length} người chưa thêm được. Vui lòng thử lại.`);
      else message.error('Chưa thêm được thành viên nào. Vui lòng thử lại.');
      void queryClient.invalidateQueries({ queryKey: membersKey });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => projectApi.revoke(project.id, id),
    onSuccess: (_, id) => {
      setSelectedIds(current => current.filter(selected => selected !== id));
      queryClient.setQueryData<ProjectMemberDto[]>(membersKey, current => current?.filter(member => member.userId !== id));
      void queryClient.invalidateQueries({ queryKey: membersKey });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: () => { message.error('Không thể thu hồi quyền. Vui lòng thử lại.'); },
  });

  return <Drawer title={`Thành viên · ${project.name}`} open onClose={onClose} size={640} destroyOnHidden>
    <Typography.Paragraph type="secondary">Thành viên giữ nguyên vai trò nghiệp vụ. Thu hồi phân công có hiệu lực với các yêu cầu tiếp theo.</Typography.Paragraph>
    <Space.Compact style={{ width: '100%', marginBottom: 20 }}>
      <Select mode="multiple" allowClear maxTagCount="responsive" style={{ flex: 1, minWidth: 0 }} aria-label="Chọn kỹ sư" placeholder="Chọn một hoặc nhiều kỹ sư"
        showSearch optionFilterProp="label" value={selection} onChange={setSelectedIds} loading={users.isFetching || members.isFetching}
        disabled={unavailable || assign.isPending} notFoundContent="Không còn kỹ sư phù hợp"
        options={eligible.map(user => ({ value: user.id, label: `${user.fullName || user.username} · ${roleLabels[user.roleName ?? ''] ?? user.roleName}` }))} />
      <Button type="primary" disabled={!selection.length || unavailable} loading={assign.isPending} onClick={() => assign.mutate(selection)}>
        Phân công{selection.length ? ` (${selection.length})` : ''}
      </Button>
    </Space.Compact>
    {(members.error || users.error) && <QueryState error={members.error || users.error} retry={() => { void members.refetch(); void users.refetch(); }} entity="thành viên" />}
    <Table rowKey="userId" loading={members.isFetching} dataSource={members.data ?? []} pagination={false} columns={[
      { title: 'Kỹ sư', render: (_, member) => <div><strong>{member.fullName || member.username}</strong><div>{member.email}</div></div> },
      { title: 'Vai trò', render: (_, member) => roleLabels[member.roleName] ?? member.roleName },
      { title: '', render: (_, member) => <Popconfirm title="Thu hồi quyền truy cập dự án?" okText="Thu hồi" cancelText="Hủy" onConfirm={() => revoke.mutateAsync(member.userId)}>
        <Button danger disabled={assign.isPending} loading={revoke.isPending}>Thu hồi</Button>
      </Popconfirm> },
    ]} />
  </Drawer>;
}
