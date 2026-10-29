import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Tabs,
  Badge,
} from 'antd';
import {
  CheckSquareOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FieldTimeOutlined,
  SafetyCertificateOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { checklistApi } from '../../services/checklistApi';
import type { ChecklistDto, ChecklistStatus } from '../../types/checklist';
import { ChecklistDetailModal } from '../../components/checklists/ChecklistDetailModal';

const { Text } = Typography;

export const ReviewerChecklistPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlChecklistId = searchParams.get('checklistId');

  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('PENDING'); // Mặc định mở tab Chờ thẩm tra
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    if (urlChecklistId) {
      setSelectedChecklistId(urlChecklistId);
      setDetailModalOpen(true);
      setActiveTab('ALL');
    }
  }, [urlChecklistId]);

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
  const pendingCount = checklists.filter((c) => c.status === 'PendingSupervisor').length;
  const approvedCount = checklists.filter((c) => c.status === 'Approved' || c.status === 'InProgress').length;
  const rejectedCount = checklists.filter((c) => c.status === 'Rejected').length;
  const completedCount = checklists.filter((c) => c.status === 'Completed').length;

  // Lọc dữ liệu theo tab và từ khóa tìm kiếm
  const filteredChecklists = checklists.filter((item) => {
    if (activeTab === 'PENDING' && item.status !== 'PendingSupervisor') return false;
    if (activeTab === 'APPROVED' && item.status !== 'Approved' && item.status !== 'InProgress') return false;
    if (activeTab === 'REJECTED' && item.status !== 'Rejected') return false;
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
        return <Tag color="processing" icon={<FieldTimeOutlined />}>Chờ thẩm tra</Tag>;
      case 'Approved':
        return <Tag color="cyan">Đã duyệt (Khóa cấu trúc)</Tag>;
      case 'Rejected':
        return <Tag color="error">Đã từ chối</Tag>;
      case 'InProgress':
        return <Tag color="warning">Đang nghiệm thu</Tag>;
      case 'Completed':
        return <Tag color="success">Hoàn thành</Tag>;
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
            <CheckSquareOutlined style={{ color: '#fa8c16' }} />
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
      title: 'Tiêu chuẩn & Mẫu Form',
      key: 'itemsInfo',
      width: 180,
      render: (_: any, record: ChecklistDto) => (
        <Space direction="vertical" size={2} style={{ fontSize: 12 }}>
          <div>
            <Text strong>{record.itemsCount}</Text> tiêu chuẩn kiểm tra
          </div>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Tiến độ: {record.itemsCompletedCount}/{record.itemsCount} đạt
          </Text>
        </Space>
      ),
    },
    {
      title: 'Kỹ sư lập & Trình duyệt',
      key: 'creator',
      width: 200,
      render: (_: any, record: ChecklistDto) => (
        <Space direction="vertical" size={2} style={{ fontSize: 12 }}>
          <div>
            <Text type="secondary">Kỹ sư: </Text>
            <Text strong>{record.createdBy}</Text>
          </div>
          {record.workflowInstanceId && (
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              Workflow: {record.workflowInstanceId.substring(0, 16)}...
            </div>
          )}
        </Space>
      ),
    },
    {
      title: 'Thao tác Thẩm định',
      key: 'actions',
      width: 160,
      align: 'center' as const,
      render: (_: any, record: ChecklistDto) => (
        <Button
          type={record.status === 'PendingSupervisor' ? 'primary' : 'default'}
          style={
            record.status === 'PendingSupervisor'
              ? { backgroundColor: '#fa8c16', borderColor: '#fa8c16' }
              : undefined
          }
          size="small"
          icon={record.status === 'PendingSupervisor' ? <SafetyCertificateOutlined /> : undefined}
          onClick={() => {
            setSelectedChecklistId(record.id);
            setDetailModalOpen(true);
          }}
        >
          {record.status === 'PendingSupervisor' ? 'Thẩm định & Duyệt' : 'Xem chi tiết'}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Banner giới thiệu phân hệ Reviewer */}
      <Alert
        message={
          <Space>
            <Tag color="orange" style={{ fontWeight: 600 }}>
              TƯ VẤN GIÁM SÁT (REVIEWER WORKSPACE)
            </Tag>
            <Text strong>Thẩm Định & Phê Duyệt Kế Hoạch Checklist</Text>
          </Space>
        }
        description="Kiểm tra các tiêu chí và cấu trúc Form.io do Kỹ sư lập. Tư vấn giám sát có quyền can thiệp chỉnh sửa trực tiếp, bổ sung/xóa tiêu chí trước khi Phê duyệt để khóa cứng cấu trúc hoặc Từ chối kèm lý do."
        type="warning"
        showIcon
        action={
          <Button
            size="small"
            icon={<FileDoneOutlined />}
            onClick={() => navigate('/reviewer/inspections')}
          >
            Đến Form Inspection
          </Button>
        }
      />

      {/* Thẻ thống kê KPI */}
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Kế hoạch Chờ Thẩm Định"
              value={pendingCount}
              valueStyle={{ color: '#fa8c16', fontWeight: 700 }}
              prefix={<FieldTimeOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Đã duyệt (Khóa cấu trúc)"
              value={approvedCount}
              valueStyle={{ color: '#13c2c2' }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Đã yêu cầu sửa đổi (Từ chối)"
              value={rejectedCount}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <Statistic
              title="Công trình Hoàn thành 100%"
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
              {
                key: 'PENDING',
                label: (
                  <Badge count={pendingCount} offset={[10, 0]} color="#fa8c16">
                    <span>Chờ thẩm định</span>
                  </Badge>
                ),
              },
              { key: 'APPROVED', label: `Đã phê duyệt (${approvedCount})` },
              { key: 'REJECTED', label: `Đã từ chối (${rejectedCount})` },
              { key: 'COMPLETED', label: `Đã hoàn thành (${completedCount})` },
              { key: 'ALL', label: `Tất cả (${totalCount})` },
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
            if (searchParams.get('checklistId')) {
              searchParams.delete('checklistId');
              setSearchParams(searchParams, { replace: true });
            }
            refetch();
          }}
          onRefresh={() => refetch()}
        />
      )}
    </div>
  );
};
