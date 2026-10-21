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
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { checklistApi } from '../../services/checklistApi';
import type { ChecklistDto, ChecklistStatus } from '../../types/checklist';
import { ChecklistDetailModal } from '../../components/checklists/ChecklistDetailModal';

const { Text } = Typography;

export const ApproverChecklistPage: React.FC = () => {
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

  const totalCount = checklists.length;
  const approvedCount = checklists.filter((c) => c.status === 'Approved' || c.status === 'InProgress').length;
  const completedCount = checklists.filter((c) => c.status === 'Completed').length;

  const filteredChecklists = checklists.filter((item) => {
    if (activeTab === 'APPROVED' && item.status !== 'Approved' && item.status !== 'InProgress') return false;
    if (activeTab === 'COMPLETED' && item.status !== 'Completed') return false;

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
        return <Tag color="cyan">Đã duyệt cấu trúc</Tag>;
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
      title: 'Tên danh mục kiểm tra & Cấu kiện',
      key: 'name',
      render: (_: any, record: ChecklistDto) => (
        <Space direction="vertical" size={2}>
          <Space>
            <CheckSquareOutlined style={{ color: '#52c41a' }} />
            <Text strong style={{ fontSize: 14 }}>
              {record.name}
            </Text>
          </Space>
          <Space size={6}>
            <Tag color="cyan" style={{ fontSize: 11, margin: 0 }}>
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
      render: (status: ChecklistStatus) => getStatusTag(status),
    },
    {
      title: 'Tiến độ hoàn thành',
      key: 'progress',
      width: 220,
      render: (_: any, record: ChecklistDto) => (
        <div style={{ minWidth: 150 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
            <span>{record.itemsCompletedCount}/{record.itemsCount} tiêu chí đạt</span>
            <span>{record.progressPercentage}%</span>
          </div>
          <Progress
            percent={record.progressPercentage}
            size="small"
            status={record.status === 'Completed' ? 'success' : 'normal'}
            strokeColor={record.status === 'Completed' ? '#52c41a' : '#13c2c2'}
          />
        </div>
      ),
    },
    {
      title: 'Nhân sự tham gia',
      key: 'actors',
      width: 220,
      render: (_: any, record: ChecklistDto) => (
        <Space direction="vertical" size={2} style={{ fontSize: 12 }}>
          <div>
            <Text type="secondary">Kỹ sư lập: </Text>
            <Text strong>{record.createdBy}</Text>
          </div>
          {record.reviewedBy && (
            <div>
              <Text type="secondary">Giám sát duyệt: </Text>
              <Text style={{ color: '#52c41a', fontWeight: 600 }}>{record.reviewedBy}</Text>
            </div>
          )}
        </Space>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      align: 'center' as const,
      render: (_: any, record: ChecklistDto) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedChecklistId(record.id);
            setDetailModalOpen(true);
          }}
        >
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Banner giới thiệu phân hệ Approver */}
      <Alert
        message={
          <Space>
            <Tag color="green" style={{ fontWeight: 600 }}>
              CHỦ ĐẦU TƯ / QUẢN LÝ DỰ ÁN (APPROVER WORKSPACE)
            </Tag>
            <Text strong>Giám Sát Tiến Độ Nghiệm Thu Theo Checklist Công Trình</Text>
          </Space>
        }
        description="Theo dõi toàn bộ các danh mục kiểm tra kỹ thuật của dự án, tiến độ hoàn thành các tiêu chuẩn thi công và kết quả nghiệm thu giữa Tư vấn giám sát và Kỹ sư nhà thầu."
        type="success"
        showIcon
      />

      {/* Thẻ thống kê KPI */}
      <Row gutter={16}>
        <Col span={8}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Tổng số Danh mục Checklist"
              value={totalCount}
              prefix={<CheckSquareOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Đang thi công & Nghiệm thu"
              value={approvedCount}
              valueStyle={{ color: '#13c2c2' }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Hạng mục Đạt 100% Hoàn Thành"
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
              { key: 'ALL', label: `Tất cả danh mục (${totalCount})` },
              { key: 'APPROVED', label: `Đang thi công (${approvedCount})` },
              { key: 'COMPLETED', label: `Đã hoàn thành (${completedCount})` },
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

      {/* Modal Chi tiết Checklist */}
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
