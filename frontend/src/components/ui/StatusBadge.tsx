import { Tag } from 'antd';
import { getStatusPresentation, type StatusDomain } from '../../config/statuses';
export function StatusBadge({ status, domain = 'inspection' }: { status?: string | null; domain?: StatusDomain }) {
  if (domain === 'sync' && (!status || status === 'Synchronized')) return null;
  const { label, tone } = getStatusPresentation(domain, status);
  return <Tag className={`status-badge status-${tone}`}><span className="status-dot" aria-hidden="true" />{label}</Tag>;
}
