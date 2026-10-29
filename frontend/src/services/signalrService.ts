import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr';
import type { RealtimeNotification } from '../types/notification';

type NotificationListener = (notification: RealtimeNotification) => void;

class SignalRService {
  private connection: HubConnection | null = null;
  private listeners: Set<NotificationListener> = new Set();
  private isStarting = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private clearRetryTimer() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private buildConnection(): HubConnection {
    const conn = new HubConnectionBuilder()
      .withUrl('/hubs/notifications', {
        accessTokenFactory: () => localStorage.getItem('token') || '',
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx) => {
          const delays = [0, 2000, 5000, 10000, 30000];
          return delays[Math.min(ctx.previousRetryCount, delays.length - 1)];
        },
      })
      .configureLogging(LogLevel.Warning)
      .build();

    conn.on('ReceiveNotification', (notification: RealtimeNotification) => {
      this.listeners.forEach((fn) => {
        try { fn(notification); } catch { /* ignore */ }
      });
    });

    conn.onreconnecting(() => console.warn('[SignalR] Reconnecting...'));
    conn.onreconnected(() => console.log('[SignalR] Reconnected.'));
    conn.onclose((err) => {
      console.warn('[SignalR] Connection closed:', err?.message ?? '');
      // Schedule retry if we still have a token
      if (localStorage.getItem('token')) {
        this.retryTimer = setTimeout(() => this.ensureConnected(), 5000);
      }
    });

    return conn;
  }

  /** Ensures one stable connection exists. Safe to call multiple times. */
  public async ensureConnected(): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Already connected or connecting — nothing to do
    const state = this.connection?.state;
    if (
      state === HubConnectionState.Connected ||
      state === HubConnectionState.Connecting ||
      state === HubConnectionState.Reconnecting
    ) {
      return;
    }

    if (this.isStarting) return;
    this.isStarting = true;
    this.clearRetryTimer();

    try {
      if (!this.connection || this.connection.state === HubConnectionState.Disconnected) {
        this.connection = this.buildConnection();
      }

      await this.connection.start();
      console.log('[SignalR] Connected. State:', this.connection.state);
    } catch (err) {
      console.warn('[SignalR] Failed to connect:', err);
      // Retry after 5s
      this.retryTimer = setTimeout(() => {
        this.isStarting = false;
        this.ensureConnected();
      }, 5000);
      return;
    } finally {
      this.isStarting = false;
    }
  }

  /** Only call on logout */
  public async disconnect(): Promise<void> {
    this.clearRetryTimer();
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) {
      try {
        await this.connection.stop();
      } catch { /* ignore */ }
    }
    this.connection = null;
    this.isStarting = false;
    console.log('[SignalR] Disconnected.');
  }

  public subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getState(): HubConnectionState | null {
    return this.connection?.state ?? null;
  }
}

export const signalRService = new SignalRService();
