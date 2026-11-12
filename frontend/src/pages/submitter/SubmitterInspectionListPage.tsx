import {
  CheckSquareOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons';
import {
  Button,
  Card,
  Input,
  message,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography
} from 'antd';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InspectionDetailDrawer } from '../../components/inspections/InspectionDetailDrawer';
import { InspectionRowActions } from '../../components/ui/InspectionRowActions';
import { PageHeader } from '../../components/ui/PageHeader';
import { QueryState } from '../../components/ui/QueryState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inspectionStatusOptions } from '../../config/statuses';
import { useAuth } from '../../contexts/AuthContext';
import { useInspectionList } from '../../hooks/useInspectionList';
import { useInspectionSearchParams } from '../../hooks/useInspectionSearchParams';
import { inspectionApi } from '../../services/inspectionApi';
import type { InspectionDto, InspectionStatus } from '../../types/inspection';

const { Text } = Typography;

export const SubmitterInspectionListPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useInspectionSearchParams();
  const urlInspectionId = searchParams.get('inspectionId');
  const { searchText, setSearchText, statusFilter, setStatusFilter, pageIndex, pageSize, setPagination, clearFilters, loading, inspections, totalCount, listError, loadData } = useInspectionList();

  // Modals state
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  useEffect(() => {
    if (urlInspectionId) {
      setSelectedInspectionId(urlInspectionId);
      setDetailDrawerVisible(true);
    } else {
      setSelectedInspectionId(null);
      setDetailDrawerVisible(false);
    }
  }, [urlInspectionId]);

  const handleDelete = async (id: string, rowVersion: string) => {
    try {
      await inspectionApi.deleteInspection(id, rowVersion);
      message.success('Đã xóa đơn kiểm tra nháp.');
      loadData();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Không thể xóa hồ sơ này.';
      message.error(msg);
    }
  };

  const handleOpenDetail = (id: string) => {
    setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('inspectionId', id); return next; });
  };

  const renderStatusTag = (status: InspectionStatus) => <StatusBadge domain="inspection" status={status} />;

  // The API counts every matching record before pagination.

  const columns = [
    {
      title: 'Mã hồ sơ',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (id: string) => (
        <div>
          <Button type="link" className="record-link" style={{ padding: 0 }} onClick={() => handleOpenDetail(id)}>
            #{id.substring(0, 8).toUpperCase()}
          </Button>
        </div>
      ),
    },
    {
      title: 'Hạng mục / Tiêu chí nghiệm thu',
      dataIndex: 'objectName',
      key: 'objectName',
      render: (text: string, record: InspectionDto) => {
        return (
          <Space direction="vertical" size={2}>
            <div style={{ fontWeight: 600, color: '#0f172a' }}>
              {record.checklistItemName || 'Tiêu chuẩn nghiệm thu'}
            </div>
            {record.checklistId ? (
              <Button aria-label="Mở kế hoạch kiểm tra"
                type="link"
                size="small"
                icon={<CheckSquareOutlined />}
                style={{ padding: 0, height: 'auto', fontSize: 12, fontWeight: 600 }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/submitter/checklists?checklistId=${record.checklistId}`);
                }}
              >
                {record.checklistName || `Mã Checklist #${record.checklistId.substring(0, 8).toUpperCase()}`}
              </Button>
            ) : (
              <div style={{ fontSize: 12, color: '#475569' }}>
                Checklist: <b>{record.checklistName || 'Checklist cấu kiện'}</b>
              </div>
            )}
            <Text type="secondary" style={{ fontSize: 12 }}>
              Cấu kiện: {text}
            </Text>
          </Space>
        );
      },
    },
    {
      title: 'Bản vẽ liên kết',
      dataIndex: 'drawingFileName',
      key: 'drawingFileName',
      width: 220,
      render: (text: string, record: InspectionDto) => (
        <Tooltip title={text}>
          <div>
            <Text ellipsis style={{ maxWidth: 200, display: 'block' }}>
              {text || '—'}
            </Text>
            <Tag style={{ fontSize: 12 }}>Trang {record.drawingPageNumber}</Tag>
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      align: 'center' as const,
      render: (status: InspectionStatus) => renderStatusTag(status),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (dateStr: string) => new Date(dateStr).toLocaleString('vi-VN'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 210,
      align: 'center' as const,
      render: (_: unknown, record: InspectionDto) => <InspectionRowActions record={record} onOpen={() => handleOpenDetail(record.id)} checklistPath="/submitter/checklists" onDelete={record.status === 'Draft' && record.submittedById === user?.id && record.workflowSyncStatus === 'Synchronized' ? () => handleDelete(record.id, record.rowVersion) : undefined} />,
    },
  ];

  return (
    <div className="data-page">

      <PageHeader title="Hồ sơ nghiệm thu" count={`${totalCount} hồ sơ`} actions={<Button icon={<CheckSquareOutlined />} onClick={() => navigate('/submitter/checklists')}>Kế hoạch kiểm tra</Button>} />
      {listError && <QueryState error={listError} retry={loadData} entity="hồ sơ" />}

      {/* Bảng dữ liệu chính */}
      <Card className="list-surface">
        <div className="list-toolbar">
          <Space size={12}>
            <Input
              placeholder="Tìm theo mã hoặc tên cấu kiện..."
              prefix={<SearchOutlined style={{ color: '#667085' }} />}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
              }}
              style={{ width: 260 }}
              allowClear={{ clearIcon: <CloseCircleOutlined aria-label="Xóa tìm kiếm" /> }}
            />
            <Select
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
              }}
              style={{ width: 180 }}
              options={[{ value: 'ALL', label: 'Tất cả trạng thái' }, ...inspectionStatusOptions]}
            />
          </Space>

          <Space size={8}>
            {(searchText || statusFilter !== 'ALL') && <Button onClick={clearFilters}>Xóa bộ lọc</Button>}
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              Làm mới
            </Button>
          </Space>
        </div>

        <Table locale={{ emptyText: listError ? null : <QueryState filtered={Boolean(searchText || statusFilter !== 'ALL')} entity="hồ sơ" /> }} scroll={{ x: 1100 }}
          dataSource={inspections}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pageIndex,
            pageSize: pageSize,
            total: totalCount,
            showSizeChanger: true,
            onChange: (page, size) => {
              setPagination(page, size);
            },
          }}

          size="middle"
        />
      </Card>

      {/* Drawer xem chi tiết, điền form động và xem lịch sử */}
      <InspectionDetailDrawer
        visible={detailDrawerVisible}
        inspectionId={selectedInspectionId}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedInspectionId(null);
          if (searchParams.get('inspectionId')) {
            setSearchParams(previous => { const next = new URLSearchParams(previous); next.delete('inspectionId'); return next; }, { replace: true });
          }
        }}
        onUpdated={loadData}
        isSubmitterRole={true}
      />
    </div>
  );
};
