import React, { useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Typography, Tag, Alert, Badge } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export const ReviewerInspectionListPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const reviewerInspections = [
    {
      id: 'ins-001',
      code: 'INSP-2026-001',
      objectName: 'Cột C12 - Tầng 3 (Trục A-B)',
      submitter: 'KySuHienTruong_Demo',
      drawingName: 'test_sample_drawing.pdf',
      status: 'Submitted',
      submittedAt: '2026-10-01T08:30:00Z',
    },
    {
      id: 'ins-003',
      code: 'INSP-2026-003',
      objectName: 'Sàn S01 - Khu vực hành lang',
      submitter: 'NguyenVanA',
      drawingName: 'test_sample_drawing.pdf',
      status: 'UnderReview',
      submittedAt: '2026-10-01T10:00:00Z',
    },
  ];

  const columns = [
    {
      title: 'Mã hồ sơ',
      dataIndex: 'code',
      key: 'code',
      width: 150,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Cấu kiện kiểm tra',
      dataIndex: 'objectName',
      key: 'objectName',
      render: (text: string) => text,
    },
    {
      title: 'Kỹ sư nộp hồ sơ',
      dataIndex: 'submitter',
      key: 'submitter',
      width: 180,
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Bản vẽ',
      dataIndex: 'drawingName',
      key: 'drawingName',
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      align: 'center' as const,
      render: (status: string) => {
        if (status === 'Submitted') {
          return <Badge status="warning" text={<span style={{ fontWeight: 500, color: '#FAAD14' }}>Chờ thẩm tra</span>} />;
        }
        if (status === 'UnderReview') {
          return <Badge status="processing" text={<span style={{ fontWeight: 500, color: '#1677FF' }}>Đang thẩm tra</span>} />;
        }
        if (status === 'Reviewed') {
          return <Badge status="success" text={<span style={{ fontWeight: 500, color: '#52C41A' }}>Đã duyệt (Chờ CĐT)</span>} />;
        }
        if (status === 'Rejected') {
          return <Badge status="error" text={<span style={{ fontWeight: 500, color: '#FF4D4F' }}>Đã từ chối</span>} />;
        }
        return <Tag>{status}</Tag>;
      },
    },
    {
      title: 'Thời gian nộp',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 170,
      render: (dateStr: string) => new Date(dateStr).toLocaleString('vi-VN'),
    },
    {
      title: 'Quyết định Thẩm tra (Cấp 1)',
      key: 'actions',
      width: 260,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Space size={8}>
          {record.status !== 'Reviewed' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                style={{ backgroundColor: '#52C41A', borderColor: '#52C41A' }}
              >
                Phê duyệt (Cấp 1)
              </Button>
              <Button size="small" danger icon={<CloseCircleOutlined />}>
                Yêu cầu sửa
              </Button>
            </>
          )}
          {record.status === 'Reviewed' && (
            <Tag color="green">Đã chuyển sang Approver</Tag>
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
            <Tag color="orange" style={{ fontWeight: 600 }}>REVIEWER WORKSPACE</Tag>
            <Text strong>Thẩm tra & Đánh giá Form Inspection</Text>
          </Space>
        }
        description="Khu vực thẩm tra kỹ thuật của Tư vấn giám sát: Kiểm tra hồ sơ nghiệm thu, đối chiếu với danh mục Checklist và xác nhận đạt yêu cầu kỹ thuật trước khi chuyển lên Cấp phê duyệt (Approver)."
        type="warning"
        showIcon
      />

      <Card style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Space size={12}>
            <Input
              placeholder="Tìm theo mã hồ sơ hoặc cấu kiện..."
              prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 280 }}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 180 }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'Submitted', label: 'Chờ thẩm tra' },
                { value: 'UnderReview', label: 'Đang thẩm tra' },
              ]}
            />
          </Space>
          <Button icon={<ReloadOutlined />}>Làm mới</Button>
        </div>

        <Table
          dataSource={reviewerInspections}
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
