import React, { useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Typography, Tag, Alert } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  EyeOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export const SubmitterInspectionListPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Sample data conforming to Inspection Schema
  const sampleInspections = [
    {
      id: 'ins-001',
      code: 'INSP-2026-001',
      objectName: 'Cột C12 - Tầng 3 (Trục A-B)',
      drawingName: 'test_sample_drawing.pdf',
      status: 'Submitted',
      createdAt: '2026-10-01T08:30:00Z',
      createdBy: 'Submitter',
    },
    {
      id: 'ins-002',
      code: 'INSP-2026-002',
      objectName: 'Dầm D05 - Tầng 2',
      drawingName: 'test_sample_drawing.pdf',
      status: 'Draft',
      createdAt: '2026-10-01T09:15:00Z',
      createdBy: 'Submitter',
    },
  ];

  const renderStatusTag = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Tag color="success">Đã phê duyệt</Tag>;
      case 'Submitted':
        return <Tag color="warning">Chờ thẩm tra</Tag>;
      case 'UnderReview':
        return <Tag color="processing">Đang thẩm tra</Tag>;
      case 'Rejected':
        return <Tag color="error">Từ chối / Cần sửa</Tag>;
      default:
        return <Tag color="default">Bản nháp (Draft)</Tag>;
    }
  };

  const columns = [
    {
      title: 'Mã hồ sơ',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Hạng mục / Cấu kiện (Object)',
      dataIndex: 'objectName',
      key: 'objectName',
      render: (text: string) => text,
    },
    {
      title: 'Bản vẽ liên kết',
      dataIndex: 'drawingName',
      key: 'drawingName',
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      align: 'center' as const,
      render: (status: string) => renderStatusTag(status),
    },
    {
      title: 'Ngày tạo/nộp',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (dateStr: string) => new Date(dateStr).toLocaleString('vi-VN'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Space size={8}>
          {record.status === 'Draft' ? (
            <Button size="small" type="primary" ghost icon={<EditOutlined />}>
              Sửa / Nộp
            </Button>
          ) : (
            <Button size="small" icon={<EyeOutlined />}>
              Xem chi tiết
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        message={
          <Space>
            <Tag color="blue" style={{ fontWeight: 600 }}>SUBMITTER WORKSPACE</Tag>
            <Text strong>Danh sách Form Inspection (Hồ sơ nghiệm thu)</Text>
          </Space>
        }
        description="Quản lý toàn bộ hồ sơ nghiệm thu kỹ thuật bạn đã tạo trên các cấu kiện Object. Bạn có thể chỉnh sửa bản nháp hoặc theo dõi phản hồi thẩm tra từ Tư vấn giám sát."
        type="info"
        showIcon
      />

      <Card style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Space size={12}>
            <Input
              placeholder="Tìm theo mã hồ sơ, tên cấu kiện..."
              prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 280 }}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 170 }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'Draft', label: 'Bản nháp' },
                { value: 'Submitted', label: 'Chờ thẩm tra' },
                { value: 'UnderReview', label: 'Đang thẩm tra' },
                { value: 'Approved', label: 'Đã phê duyệt' },
                { value: 'Rejected', label: 'Cần sửa đổi' },
              ]}
            />
          </Space>

          <Space size={8}>
            <Button icon={<ReloadOutlined />}>Làm mới</Button>
            <Button type="primary" icon={<PlusOutlined />}>
              + Tạo mới Inspection
            </Button>
          </Space>
        </div>

        <Table
          dataSource={sampleInspections}
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
