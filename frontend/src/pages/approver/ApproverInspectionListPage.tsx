import React, { useState } from 'react';
import { Card, Table, Button, Space, Input, Select, Typography, Tag, Alert, Modal, Form } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;

export const ApproverInspectionListPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<any>(null);
  const [form] = Form.useForm();

  const approverInspections = [
    {
      id: 'ins-003',
      code: 'INSP-2026-003',
      objectName: 'Sàn S01 - Khu vực sảnh chính',
      submitter: 'KySuHienTruong_Demo',
      reviewer: 'TuVanGiamSat_Demo',
      drawingName: 'test_sample_drawing.pdf',
      status: 'Reviewed',
      reviewedAt: '2026-10-01T10:30:00Z',
    },
    {
      id: 'ins-004',
      code: 'INSP-2026-004',
      objectName: 'Dầm D02 - Trục 1-2',
      submitter: 'KySuHienTruong_Demo',
      reviewer: 'TuVanGiamSat_Demo',
      drawingName: 'test_sample_drawing.pdf',
      status: 'Approved',
      reviewedAt: '2026-10-01T08:00:00Z',
    },
  ];

  const handleOpenReject = (record: any) => {
    setSelectedInspection(record);
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    await form.validateFields();
    setRejectModalOpen(false);
    setSelectedInspection(null);
    form.resetFields();
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
      title: 'Hạng mục nghiệm thu',
      dataIndex: 'objectName',
      key: 'objectName',
      render: (text: string) => text,
    },
    {
      title: 'Tư vấn giám sát (Reviewer)',
      dataIndex: 'reviewer',
      key: 'reviewer',
      width: 190,
      render: (text: string) => (
        <Space>
          <Tag color="orange">{text}</Tag>
          <Tag color="green">Đã thẩm tra</Tag>
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 180,
      align: 'center' as const,
      render: (status: string) => {
        if (status === 'Reviewed') {
          return <Tag color="processing">Chờ CĐT phê duyệt</Tag>;
        }
        if (status === 'Approved') {
          return <Tag color="success">Đã nghiệm thu chính thức</Tag>;
        }
        if (status === 'Rejected') {
          return <Tag color="error">Đã từ chối</Tag>;
        }
        return <Tag>{status}</Tag>;
      },
    },
    {
      title: 'Thời điểm Reviewer duyệt',
      dataIndex: 'reviewedAt',
      key: 'reviewedAt',
      width: 190,
      render: (dateStr: string) => new Date(dateStr).toLocaleString('vi-VN'),
    },
    {
      title: 'Quyết định phê duyệt cuối (Cấp 2)',
      key: 'actions',
      width: 250,
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Space size={8}>
          <Button size="small" icon={<EyeOutlined />}>
            Hồ sơ
          </Button>
          {record.status === 'Reviewed' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckCircleOutlined />}
                style={{ backgroundColor: '#52C41A', borderColor: '#52C41A' }}
              >
                Chấp thuận duyệt
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleOpenReject(record)}
              >
                Từ chối
              </Button>
            </>
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
            <Tag color="green" style={{ fontWeight: 600 }}>APPROVER WORKSPACE</Tag>
            <Text strong>Cấp Phê duyệt Nghiệm thu Cuối cùng (Cấp 2 - Chủ Đầu Tư)</Text>
          </Space>
        }
        description="Quy trình 2 cấp: Chỉ những hồ sơ ĐÃ ĐƯỢC Tư vấn giám sát (Reviewer) thẩm tra & phê duyệt đạt yêu cầu mới được chuyển tiếp tới đây để Chủ đầu tư ra quyết định nghiệm thu chính thức."
        type="success"
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
              style={{ width: 170 }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'UnderReview', label: 'Chờ cấp duyệt' },
                { value: 'Approved', label: 'Đã phê duyệt' },
                { value: 'Rejected', label: 'Đã từ chối' },
              ]}
            />
          </Space>
          <Button icon={<ReloadOutlined />}>Làm mới</Button>
        </div>

        <Table
          dataSource={approverInspections}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          bordered
          size="middle"
        />
      </Card>

      <Modal
        title={
          <Space>
            <CloseCircleOutlined style={{ color: '#FF4D4F' }} />
            <span>Từ chối phê duyệt hồ sơ: {selectedInspection?.code}</span>
          </Space>
        }
        open={rejectModalOpen}
        onOk={handleConfirmReject}
        onCancel={() => setRejectModalOpen(false)}
        okText="Xác nhận từ chối"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="reason"
            label="Lý do từ chối / Yêu cầu khắc phục"
            rules={[{ required: true, message: 'Vui lòng nhập lý do từ chối phê duyệt' }]}
          >
            <TextArea rows={4} placeholder="Nhập chi tiết các điểm kỹ thuật chưa đạt hoặc sai sót so với bản vẽ thiết kế..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
