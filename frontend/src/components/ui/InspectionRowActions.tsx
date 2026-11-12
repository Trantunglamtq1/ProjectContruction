import { MoreOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { InspectionDto } from '../../types/inspection';

export function InspectionRowActions({ record, onOpen, checklistPath, onDelete }: { record: InspectionDto; onOpen: () => void; checklistPath: string; onDelete?: () => void }) {
  const navigate = useNavigate();
  const { modal, message } = App.useApp();
  return <Space size={4}>
    <Button type="link" size="small" onClick={onOpen}>Mở hồ sơ</Button>
    <Dropdown trigger={['click']} menu={{ items: [
      { key: 'checklist', label: 'Mở kế hoạch kiểm tra', onClick: () => navigate(record.checklistId ? `${checklistPath}?checklistId=${record.checklistId}` : checklistPath) },
      { key: 'copy', label: 'Sao chép ID đầy đủ', onClick: async () => { try { await navigator.clipboard.writeText(record.id); message.success('Đã sao chép ID hồ sơ.'); } catch { message.error('Không thể sao chép. Hãy mở thông tin kỹ thuật để xem ID.'); } } },
      ...(onDelete ? [{ key: 'delete', label: 'Xóa bản nháp', danger: true, onClick: () => modal.confirm({ title: 'Xóa hồ sơ kiểm tra?', content: 'Bản nháp này sẽ bị xóa khỏi hệ thống.', okText: 'Xóa bản nháp', cancelText: 'Hủy', okButtonProps: { danger: true }, onOk: onDelete }) }] : []),
    ] }}><Button type="text" size="small" icon={<MoreOutlined />} aria-label={`Thao tác hồ sơ #${record.id.slice(0,8).toUpperCase()}`} /></Dropdown>
  </Space>;
}
