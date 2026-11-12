import type { ReactNode } from 'react';
export function PageHeader({ title, count, actions }: { title: string; count?: string; actions?: ReactNode }) {
  return <div className="page-heading"><div className="page-heading-title"><h1>{title}</h1>{count && <span className="page-count">{count}</span>}</div>{actions && <div className="page-heading-actions">{actions}</div>}</div>;
}
