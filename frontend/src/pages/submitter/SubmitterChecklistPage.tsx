import { getSelectedProjectId } from '../../services/projectScope';
import {
  CheckSquareOutlined,
  DeleteOutlined,
  FileDoneOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Input,
  Popconfirm,
  Progress,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message
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

export const SubmitterChecklistPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlChecklistId = searchParams.get('checklistId');

  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [selectedChecklistId, setSelectedChecklistId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (urlChecklistId) {
      setSelectedChecklistId(urlChecklistId);
      setDetailModalOpen(true);
      setActiveTab('ALL');
    }
  }, [urlChecklistId]);

  // Mutation: Xóa bản nháp Checklist
  const deleteMutation = useMutation({
    mutationFn: (checklist: ChecklistDto) => checklistApi.deleteChecklist(checklist.id, checklist.rowVersion),
    onSuccess: () => {
      message.success('Đã xóa bản nháp Checklist thành công!');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
      queryClient.invalidateQueries({ queryKey: ['checklist-summary-object'] });
    },
    onError: (err: any) => {
      message.error(err.response?.data?.message || 'Lỗi khi xóa Checklist.');
    },
  });

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

  const getStatusTag = (status: ChecklistStatus) => <StatusBadge domain="checklist" status={status} />;

  const columns = [
    {
      title: 'Tên Checklist & Cấu kiện',
      key: 'name',
      render: (_: any, record: ChecklistDto) => (
        <Space direction="vertical" size={2}>
          <Space>
            <CheckSquareOutlined style={{ color: '#1D4ED8' }} />
            <Text strong style={{ fontSize: 14 }}>
              {record.name}
            </Text>
          </Space>
          <Space size={6}>
            <Tag color="geekblue" style={{ fontSize: 12, margin: 0 }}>
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
          <ChecklistSyncTag status={record.workflowSyncStatus} />
          {record.canFillInspection && (
            <Text type="secondary" style={{ fontSize: 12, color: '#166534' }}>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
            <span>{record.itemsCompletedCount}/{record.itemsCount} đạt</span>
            <span>{record.progressPercentage}%</span>
          </div>
          <Progress
            percent={record.progressPercentage}
            size="small"
            status={record.status === 'Completed' ? 'success' : 'normal'}
            strokeColor={record.status === 'Completed' ? '#52c41a' : '#1D4ED8'}
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
      width: 170,
      align: 'center' as const,
      render: (_: any, record: ChecklistDto) => (
        <Space size={6}>
          <Button
            type="primary"
            size="small"
            onClick={() => {
              setSelectedChecklistId(record.id);
              setDetailModalOpen(true);
            }}
          >
            {record.status === 'Draft' || record.status === 'Rejected'
              ? 'Thiết kế biểu mẫu'
              : 'Chi tiết'}
          </Button>
          {record.workflowSyncStatus === 'Synchronized' && (record.status === 'Draft' || record.status === 'Rejected') && (
            <Popconfirm
              title="Xóa kế hoạch Checklist?"
              description={`Bạn có chắc muốn xóa bản nháp "${record.name}" không?`}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
              onConfirm={() => deleteMutation.mutate(record)}
            >
              <Button aria-label="Xóa" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="data-page">
      <PageHeader title="Kế hoạch kiểm tra" count={`${filteredChecklists.length} kế hoạch`} actions={<Button icon={<FileDoneOutlined />} onClick={() => navigate('/submitter/inspections')}>Hồ sơ nghiệm thu</Button>} />
      {listError && <QueryState error={listError} retry={() => refetch()} entity="kế hoạch kiểm tra" />}

      {/* Bảng danh sách Checklist với bộ lọc Tab & Tìm kiếm */}
      <Card className="list-surface">
        <div className="list-toolbar">
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
