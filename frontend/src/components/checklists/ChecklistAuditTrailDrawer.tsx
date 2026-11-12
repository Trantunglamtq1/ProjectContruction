import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  FileDoneOutlined,
  LinkOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { Card, Drawer, Empty, Space, Tag, Timeline, Typography } from 'antd';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import React from 'react';
import { checklistAuditActionLabels, roleLabels } from '../../config/statuses';
import type { ChecklistAuditHistoryDto } from '../../types/checklist';
import { StatusBadge } from '../ui/StatusBadge';

dayjs.extend(utc);

const { Text, Paragraph } = Typography;

interface ChecklistAuditTrailDrawerProps {
  open: boolean;
  onClose: () => void;
  auditHistories: ChecklistAuditHistoryDto[];
  checklistName?: string;
}

export const ChecklistAuditTrailDrawer: React.FC<ChecklistAuditTrailDrawerProps> = ({
  open,
  onClose,
  auditHistories,
  checklistName,
}) => {
  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CreateDraft':
        return <EditOutlined style={{ color: '#1890ff', fontSize: 16 }} />;
      case 'SubmitForApproval':
        return <SendOutlined style={{ color: '#fa8c16', fontSize: 16 }} />;
      case 'SupervisorApprove':
        return <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />;
      case 'SupervisorReject':
        return <CloseCircleOutlined style={{ color: '#f5222d', fontSize: 16 }} />;
      case 'SupervisorModify':
        return <EditOutlined style={{ color: '#722ed1', fontSize: 16 }} />;
      case 'LinkInspection':
        return <LinkOutlined style={{ color: '#13c2c2', fontSize: 16 }} />;
      default:
        return <FileDoneOutlined style={{ color: '#8c8c8c', fontSize: 16 }} />;
    }
  };



  // Sắp xếp lịch sử theo thời gian giảm dần (mới nhất trên cùng)
  const sortedHistories = [...(auditHistories || [])].sort((a, b) =>
    dayjs.utc(b.createdAt).diff(dayjs.utc(a.createdAt))
  );

  return (
    <Drawer
      title={
        <Space direction="vertical" size={2}>
          <Space>
            <ClockCircleOutlined style={{ color: '#1677ff' }} />
            <Text strong>Lịch sử kế hoạch</Text>
          </Space>
          {checklistName && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Checklist: {checklistName}
            </Text>
          )}
        </Space>
      }
      placement="right"
      size="min(100vw, 520px)"
      className="detail-overlay"
      zIndex={1400}
      onClose={onClose}
      open={open}
      styles={{ body: { backgroundColor: '#fafafa', padding: 20 } }}
    >
      {sortedHistories.length === 0 ? (
        <Empty description="Chưa có bản ghi nhật ký nào." />
      ) : (
        <Timeline
          mode="left"
          items={sortedHistories.map((item) => ({
            dot: getActionIcon(item.action),
            children: (
              <Card
                size="small"
                style={{
                  marginBottom: 12,
                  borderRadius: 8,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  border: '1px solid #e8e8e8',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Tag style={{ fontWeight: 600 }}>
                    {checklistAuditActionLabels[item.action] || item.action}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {dayjs.utc(item.createdAt).local().format('DD/MM/YYYY HH:mm:ss')}
                  </Text>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Text strong style={{ fontSize: 13 }}>{item.actorName}</Text>
                  <Tag style={{ fontSize: 12, margin: 0 }}>
                    {roleLabels[item.actorRole] || item.actorRole}
                  </Tag>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12 }}>
                  <Text type="secondary">Trạng thái:</Text>
                  <StatusBadge domain="checklist" status={item.fromStatus} />
                  <Text type="secondary">→</Text>
                  <StatusBadge domain="checklist" status={item.toStatus} />
                </div>

                {item.comment && (
                  <Paragraph
                    style={{
                      margin: 0,
                      padding: '6px 8px',
                      backgroundColor: '#f5f5f5',
                      borderRadius: 4,
                      fontSize: 12,
                      color: item.action === 'SupervisorReject' ? '#cf1322' : '#595959',
                      borderLeft: item.action === 'SupervisorReject' ? '3px solid #ff4d4f' : '3px solid #d9d9d9',
                    }}
                  >
                    {item.comment}
                  </Paragraph>
                )}
              </Card>
            ),
          }))}
        />
      )}
    </Drawer>
  );
};
