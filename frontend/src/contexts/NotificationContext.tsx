import { App } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { notificationApi } from '../services/notificationApi';
import { signalRService } from '../services/signalrService';
import { PROJECT_ACCESS_CHANGED, PROJECT_ACCESS_DENIED } from '../services/projectScope';
import type { RealtimeNotification } from '../types/notification';
import { useAuth } from './AuthContext';

type Notifications = { notifications: RealtimeNotification[]; unreadCount: number; markAsRead: (id: string) => void;
  markAllAsRead: () => void; clearAll: () => void; refreshNotifications: () => Promise<void> };
const Context = createContext<Notifications | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { notification } = App.useApp();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const generation = useRef(0);
  const fetchNotifications = useCallback(async () => {
    const revision = ++generation.current;
    if (!localStorage.getItem('token')) return;
    try {
      const data = await notificationApi.getMyNotifications();
      if (revision !== generation.current) return;
      setNotifications(data.items); setUnreadCount(data.unreadCount);
    } catch { if (revision === generation.current) { setNotifications([]); setUnreadCount(0); } }
  }, []);

  useEffect(() => {
    ++generation.current; setNotifications([]); setUnreadCount(0);
    // Remove the old cross-user/project persistent cache; only server-visible rows are displayed.
    localStorage.removeItem('app_notifications_list');
    if (!user?.id) { void signalRService.disconnect(); return; }
    void fetchNotifications();
    const unsubscribe = signalRService.subscribe(async item => {
      const revision = ++generation.current;
      try {
        const visible = await notificationApi.getMyNotifications();
        if (revision !== generation.current) return;
        setNotifications(visible.items); setUnreadCount(visible.unreadCount);
        if (visible.items.some(n => n.id === item.id)) notification.open({ message: item.title, description: item.content, duration: 6 });
        for (const key of ['inspections', 'checklists', 'checklists-for-object', 'checklist-summary-object']) void queryClient.invalidateQueries({ queryKey: [key] });
      } catch { /* A stale realtime payload cannot bypass the history visibility check. */ }
    });
    const clear = () => { ++generation.current; setNotifications([]); setUnreadCount(0); notification.destroy(); void fetchNotifications(); };
    window.addEventListener(PROJECT_ACCESS_CHANGED, clear); window.addEventListener(PROJECT_ACCESS_DENIED, clear);
    void signalRService.ensureConnected();
    const timer = window.setInterval(() => { void fetchNotifications(); }, 30000);
    return () => {
      ++generation.current; unsubscribe(); clearInterval(timer);
      window.removeEventListener(PROJECT_ACCESS_CHANGED, clear); window.removeEventListener(PROJECT_ACCESS_DENIED, clear);
      void signalRService.disconnect();
    };
  }, [user?.id, fetchNotifications, notification, queryClient]);

  const mutate = async (operation: () => Promise<unknown>) => { try { await operation(); } catch { /* Refresh the visible server state on failure. */ } finally { await fetchNotifications(); } };
  return <Context.Provider value={{ notifications, unreadCount, refreshNotifications: fetchNotifications,
    markAsRead: id => { void mutate(() => notificationApi.markAsRead(id)); },
    markAllAsRead: () => { void mutate(notificationApi.markAllAsRead); }, clearAll: () => { void mutate(notificationApi.clearAll); } }}>{children}</Context.Provider>;
}

export function useRealtimeNotifications() {
  const context = useContext(Context);
  if (!context) throw new Error('NotificationProvider is required');
  return context;
}
