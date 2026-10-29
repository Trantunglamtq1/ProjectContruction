import apiClient from './apiClient';
import type { RealtimeNotification } from '../types/notification';

export interface NotificationsResponse {
  items: RealtimeNotification[];
  unreadCount: number;
}

export const notificationApi = {
  getMyNotifications: async (): Promise<NotificationsResponse> => {
    const res = await apiClient.get<NotificationsResponse>('/notifications');
    return res.data;
  },

  markAsRead: async (id: string): Promise<void> => {
    await apiClient.put(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await apiClient.put('/notifications/read-all');
  },

  clearAll: async (): Promise<void> => {
    await apiClient.delete('/notifications');
  },
};
