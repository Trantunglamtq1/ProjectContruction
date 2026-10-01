import React from 'react';
import { Card, Table, Tag, Space, Typography, Alert, Button, Input } from 'antd';
import {
  CheckSquareOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export const ApproverChecklistPage: React.FC = () => {
  const sampleChecklists = [
    {
      id: 'chk-001',
      name: 'Kiểm tra công tác cốt thép cột',
      objectName: 'Cột C12 - Tầng 3',
      totalItems: 8,
      passedItems: 8,
      status: 'Completed',
      reviewer: 'Tư Vấn Giám Sát',
    },
    {
      id: 'chk-003',
      name: 'Kiểm tra công tác đổ bê tông dầm sàn',
      objectName: 'Dầm D05 - Tầng 2',
      totalItems: 6,
      passedItems: 6,
      status: 'Completed',
      reviewer: 'Tư Vấn Giám Sát',
    },
  ];

  const columns = [
    {
      title: 'Tên danh mục kiểm tra',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <CheckSquareOutlined style={{ color: '#52C41A' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Cấu kiện công trình (Object)',
      dataIndex: 'objectName',
      key: 'objectName',
    },
    {
      title: 'Đơn vị giám sát kiểm tra',
      dataIndex: 'reviewer',
      key: 'reviewer',
      render: (text: string) => <Tag color="orange">{text}</Tag>,
    },
    {
      title: 'Kết quả tiêu chí',
      key: 'progress',
      render: (_: any, record: any) => `${record.passedItems} / ${record.totalItems} tiêu chí đạt 100%`,
    },
    {
      title: 'Trạng thái nghiệm thu',
      dataIndex: 'status',
      key: 'status',
      render: () => <Tag color="success">Đã hoàn thành kiểm tra</Tag>,
    },
    {
      title: 'Tra cứu',
      key: 'actions',
      render: () => <Button size="small" type="link">Xem biên bản</Button>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        message={
          <Space>
            <Tag color="green" style={{ fontWeight: 600 }}>APPROVER WORKSPACE</Tag>
            <Text strong>Tra cứu Danh mục Checklist Công trình</Text>
          </Space>
        }
        description="Theo dõi việc hoàn thành các tiêu chí kiểm tra kỹ thuật do Tư vấn giám sát thực hiện làm cơ sở phê duyệt nghiệm thu công trình."
        type="success"
        showIcon
      />

      <Card style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input
            placeholder="Tra cứu danh mục checklist..."
            prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
            style={{ width: 280 }}
          />
          <Button icon={<ReloadOutlined />}>Làm mới</Button>
        </div>

        <Table
          dataSource={sampleChecklists}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          bordered
          size="middle"
        />
      </Card>
    </div>
  );
};
