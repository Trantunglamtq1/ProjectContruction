import React from 'react';
import { Card, Typography } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

export const DrawingListPage: React.FC = () => {
  return (
    <Card style={{ borderRadius: 8, border: '1px solid #E4E7ED' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <FilePdfOutlined style={{ fontSize: 24, color: '#1677FF' }} />
        <Title level={4} style={{ margin: 0 }}>Danh sách bản vẽ công trình</Title>
      </div>
      <Text type="secondary">
        Màn hình 05 & 06 sẽ được triển khai chi tiết ở Tuần 2 (Ngày 8 & 9).
      </Text>
    </Card>
  );
};
