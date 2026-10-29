export interface RealtimeNotification {
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
