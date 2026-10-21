import React, { useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Typography,
  Alert,
  Button,
  Input,
  Row,
  Col,
  Statistic,
  Progress,
  Tabs,
} from 'antd';
import {
  CheckSquareOutlined,
  SearchOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { checklistApi } from '../../services/checklistApi';
import type { ChecklistDto, ChecklistStatus } from '../../types/checklist';
import { ChecklistDetailModal } from '../../components/checklists/ChecklistDetailModal';

const { Text } = Typography;

export const SubmitterChecklistPage: React.FC = () => {
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Query danh sách Checklist từ backend
  const {
    data: checklists = [],
    isLoading,
    refetch,
  } = useQuery<ChecklistDto[]>({
    queryKey: ['checklists'],
    queryFn: () => checklistApi.getChecklists(),
  });

  // Thống kê nhanh
  const totalCount = checklists.length;
  const draftCount = checklists.filter((c) => c.status === 'Draft').length;
  const pendingCount = checklists.filter((c) => c.status === 'PendingSupervisor').length;
  const approvedCount = checklists.filter((c) => c.status === 'Approved' || c.status === 'InProgress').length;
  const rejectedCount = checklists.filter((c) => c.status === 'Rejected').length;
  const completedCount = checklists.filter((c) => c.status === 'Completed').length;

  // Lọc dữ liệu theo tab và từ khóa tìm kiếm
  const filteredChecklists = checklists.filter((item) => {
    // Lọc theo tab
    if (activeTab === 'DRAFT' && item.status !== 'Draft') return false;
    if (activeTab === 'PENDING' && item.status !== 'PendingSupervisor') return false;
    if (activeTab === 'APPROVED' && item.status !== 'Approved' && item.status !== 'InProgress') return false;
    if (activeTab === 'REJECTED' && item.status !== 'Rejected') return false;
    if (activeTab === 'COMPLETED' && item.status !== 'Completed') return false;

    // Lọc theo từ khóa
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      const matchName = item.name.toLowerCase().includes(kw);
      const matchObject = (item.objectName || '').toLowerCase().includes(kw);
      const matchCode = (item.objectCode || '').toLowerCase().includes(kw);
      return matchName || matchObject || matchCode;
    }
    return true;
  });

  const getStatusTag = (status: ChecklistStatus) => {
    switch (status) {
      case 'Draft':
        return <Tag color="default">Bản nháp</Tag>;
      case 'PendingSupervisor':
        return <Tag color="processing">Chờ Giám Sát duyệt</Tag>;
      case 'Approved':
        return <Tag color="cyan">Đã duyệt (Khóa cấu trúc)</Tag>;
      case 'Rejected':
        return <Tag color="error">Cần sửa lại</Tag>;
      case 'InProgress':
        return <Tag color="warning">Đang nghiệm thu</Tag>;
      case 'Completed':
        return <Tag color="success">Hoàn thành 100%</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Tên Checklist & Cấu kiện',
      key: 'name',
      render: (_: any, record: ChecklistDto) => (
        <Space direction="vertical" size={2}>
          <Space>
            <CheckSquareOutlined style={{ color: '#1677ff' }} />
            <Text strong style={{ fontSize: 14 }}>
              {record.name}
            </Text>
          </Space>
          <Space size={6}>
            <Tag color="geekblue" style={{ fontSize: 11, margin: 0 }}>
              {record.objectCode}
            </Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.objectName}
            </Text>
          </Space>
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      render: (status: ChecklistStatus, record: ChecklistDto) => (
        <Space direction="vertical" size={2}>
          {getStatusTag(status)}
          {record.canFillInspection && (
            <Text type="secondary" style={{ fontSize: 10, color: '#52c41a' }}>
              ✓ Đã mở khóa điền phiếu
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Tiến độ tiêu chí',
      key: 'progress',
      width: 200,
      render: (_: any, record: ChecklistDto) => (
        <div style={{ minWidth: 140 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
            <span>{record.itemsCompletedCount}/{record.itemsCount} đạt</span>
            <span>{record.progressPercentage}%</span>
          </div>
          <Progress
            percent={record.progressPercentage}
            size="small"
            status={record.status === 'Completed' ? 'success' : 'normal'}
            strokeColor={record.status === 'Completed' ? '#52c41a' : '#1677ff'}
          />
        </div>
      ),
    },
    {
      title: 'Người tạo & Thẩm định',
      key: 'actors',
      width: 200,
      render: (_: any, record: ChecklistDto) => (
        <Space direction="vertical" size={2} style={{ fontSize: 12 }}>
          <div>
            <Text type="secondary">Tạo bởi: </Text>
            <Text strong>{record.createdBy}</Text>
          </div>
          {record.reviewedBy && (
            <div>
              <Text type="secondary">Giám sát: </Text>
              <Text style={{ color: '#722ed1' }}>{record.reviewedBy}</Text>
            </div>
          )}
        </Space>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      align: 'center' as const,
      render: (_: any, record: ChecklistDto) => (
        <Button
          type="primary"
          size="small"
          onClick={() => {
            setSelectedChecklistId(record.id);
            setDetailModalOpen(true);
          }}
        >
          {record.status === 'Draft' || record.status === 'Rejected'
            ? 'Thiết kế Form'
            : 'Chi tiết'}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Banner giới thiệu phân hệ Submitter */}
      <Alert
        message={
          <Space>
            <Tag color="blue" style={{ fontWeight: 600 }}>
              KỸ SƯ HIỆN TRƯỜNG (SUBMITTER)
            </Tag>
            <Text strong>Quy trình Lập Checklist & Thiết kế Biểu mẫu Form.io</Text>
          </Space>
        }
        description="Giai đoạn 1 (Planning): Thiết lập các tiêu chí kiểm tra cho từng cấu kiện khoanh vùng và thiết kế biểu mẫu Form.io. Gửi Tư vấn giám sát phê duyệt cấu trúc trước khi tiến hành nghiệm thu thi công."
        type="info"
        showIcon
      />

      {/* Thẻ thống kê KPI */}
      <Row gutter={16}>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic title="Tổng Checklist" value={totalCount} prefix={<CheckSquareOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Bản nháp (Draft)"
              value={draftCount}
              valueStyle={{ color: '#8c8c8c' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Chờ Giám sát duyệt"
              value={pendingCount}
              valueStyle={{ color: '#1890ff' }}
              prefix={<FieldTimeOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Cần sửa lại"
              value={rejectedCount}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Đã duyệt (Nghiệm thu)"
              value={approvedCount}
              valueStyle={{ color: '#13c2c2' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Hoàn thành 100%"
              value={completedCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Bảng danh sách Checklist với bộ lọc Tab & Tìm kiếm */}
      <Card style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key)}
            style={{ marginBottom: 0 }}
            items={[
              { key: 'ALL', label: `Tất cả (${totalCount})` },
              { key: 'DRAFT', label: `Bản nháp (${draftCount})` },
              { key: 'PENDING', label: `Chờ duyệt (${pendingCount})` },
              { key: 'REJECTED', label: `Cần sửa lại (${rejectedCount})` },
              { key: 'APPROVED', label: `Đang nghiệm thu (${approvedCount})` },
              { key: 'COMPLETED', label: `Hoàn thành (${completedCount})` },
            ]}
          />
          <Space>
            <Input
              placeholder="Tìm kiếm theo tên hoặc cấu kiện..."
              prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ width: 280 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
              Làm mới
            </Button>
          </Space>
        </div>

        <Table
          dataSource={filteredChecklists}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 8, showSizeChanger: false }}
        />
      </Card>

      {/* Modal Chi tiết & Thẩm định Checklist */}
      {selectedChecklistId && (
        <ChecklistDetailModal
          open={detailModalOpen}
          checklistId={selectedChecklistId}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedChecklistId(null);
            refetch();
          }}
          onRefresh={() => refetch()}
        />
      )}
    </div>
  );
};
