import {
  CheckSquareOutlined,
  FileDoneOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Card,
  Input,
  Progress,
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

export const ApproverChecklistPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlChecklistId = searchParams.get('checklistId');

  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
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

  const getStatusTag = (status: ChecklistStatus) => <StatusBadge domain="checklist" status={status} />;

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
      title: 'Tiến độ hoàn thành',
      key: 'progress',
      width: 220,
      render: (_: any, record: ChecklistDto) => (
        <div style={{ minWidth: 150 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
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
              <Text style={{ color: '#166534', fontWeight: 600 }}>{record.reviewedBy}</Text>
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
    <div className="data-page">
      <PageHeader title="Kế hoạch kiểm tra" count={`${filteredChecklists.length} kế hoạch`} actions={<Button icon={<FileDoneOutlined />} onClick={() => navigate('/approver/inspections')}>Hồ sơ nghiệm thu</Button>} />
      {listError && <QueryState error={listError} retry={() => refetch()} entity="kế hoạch kiểm tra" />}

      {/* Bảng danh sách Checklist với bộ lọc Tab & Tìm kiếm */}
      <Card className="list-surface">
        <div className="list-toolbar">
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

      {/* Modal Chi tiết Checklist */}
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
