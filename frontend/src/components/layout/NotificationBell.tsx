import React, { useState } from 'react';
import { Popover, Badge, Button, List, Typography, Space, Empty } from 'antd';
import {
  BellOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  CheckOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useRealtimeNotifications } from '../../contexts/NotificationContext';
import type { RealtimeNotification } from '../../types/notification';

const { Text } = Typography;

export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useRealtimeNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />;
      case 'error':
        return <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />;
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14', fontSize: 16 }} />;
      default:
        return <InfoCircleOutlined style={{ color: '#1677ff', fontSize: 16 }} />;
    }
  };

  const handleItemClick = (item: RealtimeNotification) => {
    markAsRead(item.id);
    if (item.targetUrl) {
      setOpen(false);
      navigate(item.targetUrl);
    }
  };

  const popoverContent = (
    <div style={{ width: 340 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 8,
          marginBottom: 8,
          borderBottom: '1px solid #F0F0F0',
        }}
      >
        <Space size={6}>
          <Text strong style={{ fontSize: 14 }}>Thông báo hệ thống</Text>
          {unreadCount > 0 && <Badge count={unreadCount} style={{ backgroundColor: '#1677FF' }} />}
        </Space>
        <Space size={4}>
          {unreadCount > 0 && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={markAllAsRead}
              style={{ fontSize: 12, padding: '0 4px' }}
            >
              Đã đọc
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={clearAll}
              style={{ fontSize: 12, padding: '0 4px' }}
            >
              Xóa
            </Button>
          )}
        </Space>
      </div>

      {notifications.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Chưa có thông báo nào"
          style={{ margin: '20px 0' }}
        />
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={notifications}
          style={{ maxHeight: 360, overflowY: 'auto' }}
          renderItem={(item) => (
            <List.Item
              onClick={() => handleItemClick(item)}
              style={{
                padding: '10px 8px',
                cursor: 'pointer',
                backgroundColor: item.isRead ? '#FFFFFF' : '#F0F7FF',
                borderRadius: 6,
                marginBottom: 6,
                transition: 'background 0.2s',
              }}
            >
              <List.Item.Meta
                avatar={getIcon(item.type)}
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text strong={!item.isRead} style={{ fontSize: 13, color: '#1F2937' }}>
                      {item.title}
                    </Text>
                  </div>
                }
                description={
                  <div>
                    <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                      {item.content}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10, color: '#8C8C8C', marginTop: 4, display: 'block' }}>
                      {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                      - {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
    >
      <Badge count={unreadCount} overflowCount={99} offset={[-2, 6]}>
        <Button
          type="text"
          shape="circle"
          icon={<BellOutlined style={{ fontSize: 18, color: '#4B5563' }} />}
          style={{ width: 36, height: 36 }}
        />
      </Badge>
    </Popover>
  );
};
