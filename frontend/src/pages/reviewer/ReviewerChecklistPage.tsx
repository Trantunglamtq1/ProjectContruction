import { getSelectedProjectId } from '../../services/projectScope';
import {
  CheckSquareOutlined,
  FileDoneOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  Input,
  Space,
  Table,
  Tabs,
  Tag,
  Typography
} from 'antd';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChecklistDetailModal } from '../../components/checklists/ChecklistDetailModal';
import { ChecklistSyncTag } from '../../components/checklists/ChecklistSyncTag';
import { PageHeader } from '../../components/ui/PageHeader';
import { QueryState } from '../../components/ui/QueryState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { checklistApi } from '../../services/checklistApi';
import type { ChecklistDto, ChecklistStatus } from '../../types/checklist';

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
    error: listError,
    isLoading,
    refetch,
  } = useQuery<ChecklistDto[]>({
    queryKey: ['checklists', getSelectedProjectId()],
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

  const getStatusTag = (status: ChecklistStatus) => <StatusBadge domain="checklist" status={status} />;

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
            <Tag style={{ fontSize: 12, margin: 0 }}>
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
      render: (status: ChecklistStatus, record: ChecklistDto) => <Space direction="vertical" size={2}>{getStatusTag(status)}<ChecklistSyncTag status={record.workflowSyncStatus} /></Space>,
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
          <Text type="secondary" style={{ fontSize: 12 }}>
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
            <div style={{ fontSize: 12, color: '#667085' }}>
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
    <div className="data-page">
      <PageHeader title="Kế hoạch kiểm tra" count={`${filteredChecklists.length} kế hoạch`} actions={<Button icon={<FileDoneOutlined />} onClick={() => navigate('/reviewer/inspections')}>Hồ sơ nghiệm thu</Button>} />
      {listError && <QueryState error={listError} retry={() => refetch()} entity="kế hoạch kiểm tra" />}

      {/* Bảng danh sách Checklist với bộ lọc Tab & Tìm kiếm */}
      <Card className="list-surface">
        <div className="list-toolbar">
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
              prefix={<SearchOutlined style={{ color: '#667085' }} />}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{ width: 280 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading}>
              Làm mới
            </Button>
          </Space>
        </div>

        <Table locale={{ emptyText: listError ? null : <QueryState filtered={Boolean(searchKeyword || activeTab !== 'ALL')} entity="kế hoạch kiểm tra" /> }}
          dataSource={filteredChecklists}
          scroll={{ x: 1150 }}
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
