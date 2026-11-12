import type { ChecklistDto } from '../../types/checklist';
import { StatusBadge } from '../ui/StatusBadge';

export function ChecklistSyncTag({ status }: { status: ChecklistDto['workflowSyncStatus'] }) {
  return <StatusBadge domain="sync" status={status} />;
}
