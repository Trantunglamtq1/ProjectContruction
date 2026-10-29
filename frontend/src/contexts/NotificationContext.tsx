import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { App } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { signalRService } from '../services/signalrService';
import { notificationApi } from '../services/notificationApi';
import type { RealtimeNotification } from '../types/notification';

interface NotificationContextType {
  notifications: RealtimeNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = 'app_notifications_list';

// Inner component to safely use App.useApp() which requires being inside <AntdApp>
const NotificationProviderInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { notification } = App.useApp();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isConnectedRef = useRef(false);

  const [notifications, setNotifications] = useState<RealtimeNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Đồng bộ danh sách thông báo từ Backend Database khi user đăng nhập
  const fetchNotifications = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      const data = await notificationApi.getMyNotifications();
      if (Array.isArray(data.items)) {
        setNotifications(data.items);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.items));
      }
    } catch {
      // Fallback về localStorage nếu API tạm thời chưa sẵn sàng
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)));
    } catch { /* ignore */ }
  }, [notifications]);

  // Connect SignalR once when user logs in, disconnect on logout
  // We use user.id as stable key — NOT token (token changes every 4s poll)
  useEffect(() => {
    if (!user?.id) {
      // Logout: cleanup
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (isConnectedRef.current) {
        signalRService.disconnect();
        isConnectedRef.current = false;
      }
      setNotifications([]);
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Nạp thông báo từ database khi người dùng đăng nhập
    fetchNotifications();

    // Already set up for this user — skip
    if (isConnectedRef.current) return;

    // Register listener
    unsubscribeRef.current = signalRService.subscribe((item: RealtimeNotification) => {
      const newNotif: RealtimeNotification = {
        ...item,
        isRead: false,
        createdAt: item.createdAt || new Date().toISOString(),
      };

      setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id).slice(0, 49)]);

      // Hiển thị Ant Design toast tương ứng với type (success, info, warning, error)
      const notifType = (item.type as 'info' | 'success' | 'warning' | 'error') || 'info';
      if (typeof notification[notifType] === 'function') {
        notification[notifType]({
          message: item.title,
          description: item.content,
          placement: 'topRight',
          duration: 6,
        });
      } else {
        notification.open({
          message: item.title,
          description: item.content,
          placement: 'topRight',
          duration: 6,
        });
      }

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      queryClient.invalidateQueries({ queryKey: ['checklists-for-object'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-summary-object'] });
    });

    // Connect
    signalRService.ensureConnected();
    isConnectedRef.current = true;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, fetchNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await notificationApi.markAsRead(id);
    } catch { /* ignore */ }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await notificationApi.markAllAsRead();
    } catch { /* ignore */ }
  }, []);

  const clearAll = useCallback(async () => {
    setNotifications([]);
    localStorage.removeItem(STORAGE_KEY);
    try {
      await notificationApi.clearAll();
    } catch { /* ignore */ }
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, clearAll, refreshNotifications: fetchNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <NotificationProviderInner>{children}</NotificationProviderInner>;
};

export const useRealtimeNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useRealtimeNotifications must be used within a NotificationProvider');
  }
  return context;
};
