import React from 'react';
import { Card, Table, Tag, Space, Typography, Alert, Button, Input } from 'antd';
import {
  CheckSquareOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export const ReviewerChecklistPage: React.FC = () => {
  const sampleChecklists = [
    {
      id: 'chk-001',
      name: 'Kiểm tra công tác cốt thép cột',
      objectName: 'Cột C12 - Tầng 3',
      totalItems: 8,
      passedItems: 7,
      status: 'InProgress',
      createdBy: 'Tư Vấn Giám Sát',
    },
    {
      id: 'chk-002',
      name: 'Kiểm tra độ thẳng đứng ván khuôn',
      objectName: 'Cột C12 - Tầng 3',
      totalItems: 5,
      passedItems: 5,
      status: 'Completed',
      createdBy: 'Tư Vấn Giám Sát',
    },
  ];

  const columns = [
    {
      title: 'Tên danh mục kiểm tra',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <CheckSquareOutlined style={{ color: '#1677FF' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Cấu kiện liên kết (Object)',
      dataIndex: 'objectName',
      key: 'objectName',
    },
    {
      title: 'Tiến độ tiêu chí',
      key: 'progress',
      render: (_: any, record: any) => `${record.passedItems} / ${record.totalItems} tiêu chuẩn đạt`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'Completed' ? 'success' : 'processing'}>
          {status === 'Completed' ? 'Đã hoàn thành' : 'Đang thực hiện'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: () => <Button size="small" type="link">Chi tiết tiêu chí</Button>,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        message={
          <Space>
            <Tag color="orange" style={{ fontWeight: 600 }}>REVIEWER WORKSPACE</Tag>
            <Text strong>Quản lý Checklist Nghiệm thu</Text>
          </Space>
        }
        description="Tư vấn giám sát tạo và quản lý bộ tiêu chí kiểm tra cho từng cấu kiện công trình trước khi tiến hành nghiệm thu các bước thi công tiếp theo."
        type="warning"
        showIcon
      />

      <Card style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input
            placeholder="Tìm kiếm danh mục checklist..."
            prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
            style={{ width: 280 }}
          />
          <Space>
            <Button icon={<ReloadOutlined />}>Làm mới</Button>
            <Button type="primary" icon={<PlusOutlined />}>
              + Tạo Checklist mới
            </Button>
          </Space>
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
