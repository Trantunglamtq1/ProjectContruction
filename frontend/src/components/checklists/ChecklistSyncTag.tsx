import { Tag } from 'antd';
import type { ChecklistDto } from '../../types/checklist';

export function ChecklistSyncTag({ status }: { status: ChecklistDto['workflowSyncStatus'] }) {
  if (status === 'Synchronized') return null;
  return <Tag color="warning">{status === 'Pending' ? 'Đang đồng bộ' : status === 'Retrying' ? 'Lỗi đồng bộ, đang thử lại' : 'Cần khôi phục'}</Tag>;
}
