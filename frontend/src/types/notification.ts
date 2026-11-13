export interface RealtimeNotification {
  projectId?: string | null;
  id: string;
  title: string;
  content: string;
  type: 'info' | 'success' | 'warning' | 'error';
  targetUrl?: string;
  referenceId?: string;
  referenceType?: 'Inspection' | 'Checklist';
  createdAt: string;
  isRead?: boolean;
}
