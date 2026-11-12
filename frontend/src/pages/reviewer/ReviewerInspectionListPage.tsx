import {
  CheckSquareOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { Button, Card, Input, Select, Space, Table, Tag, Typography } from 'antd';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { InspectionDetailDrawer } from '../../components/inspections/InspectionDetailDrawer';
import { InspectionRowActions } from '../../components/ui/InspectionRowActions';
import { PageHeader } from '../../components/ui/PageHeader';
import { QueryState } from '../../components/ui/QueryState';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { inspectionStatusOptions } from '../../config/statuses';
import { useInspectionList } from '../../hooks/useInspectionList';
import { useInspectionSearchParams } from '../../hooks/useInspectionSearchParams';
import type { InspectionDto, InspectionStatus } from '../../types/inspection';

const { Text } = Typography;

export const ReviewerInspectionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useInspectionSearchParams();
  const urlInspectionId = searchParams.get('inspectionId');
  const { searchText, setSearchText, statusFilter, setStatusFilter, pageIndex, pageSize, setPagination, clearFilters, loading, inspections, totalCount, listError, loadData } = useInspectionList();

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

  const handleOpenDetail = (id: string) => {
    setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('inspectionId', id); return next; });
  };

  const columns = [
    {
      title: 'Mã hồ sơ',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (id: string) => (
        <Button type="link" className="record-link" style={{ padding: 0 }} onClick={() => handleOpenDetail(id)}>
          #{id.substring(0, 8).toUpperCase()}
        </Button>
      ),
    },
    {
      title: 'Cấu kiện kiểm tra',
      dataIndex: 'objectName',
      key: 'objectName',
      render: (text: string, record: InspectionDto) => (
        <Space direction="vertical" size={2}>
          <Text strong>{text}</Text>
          {record.checklistId ? (
            <Button aria-label="Mở kế hoạch kiểm tra"
              type="link"
              size="small"
              icon={<CheckSquareOutlined />}
              style={{ padding: 0, height: 'auto', fontSize: 12, fontWeight: 600 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/reviewer/checklists?checklistId=${record.checklistId}`);
              }}
            >
              {record.checklistName || `Mã Checklist #${record.checklistId.substring(0, 8).toUpperCase()}`}
            </Button>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>Checklist: Chưa gán</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Kỹ sư nộp hồ sơ',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      width: 170,
      render: (text: string) => <Tag color="blue">{text || 'Kỹ sư hiện trường'}</Tag>,
    },
    {
      title: 'Bản vẽ',
      dataIndex: 'drawingFileName',
      key: 'drawingFileName',
      render: (text: string, record: InspectionDto) => (
        <Space direction="vertical" size={1}>
          <Text type="secondary">{text || '—'}</Text>
          {record.drawingPageNumber && (
            <Tag style={{ fontSize: 12 }}>Trang {record.drawingPageNumber}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      align: 'center' as const,
      render: (status: InspectionStatus) => <StatusBadge status={status} />,
    },
    {
      title: 'Ngày nộp',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 170,
      render: (dateStr: string) => (dateStr ? new Date(dateStr).toLocaleString('vi-VN') : '—'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 200,
      align: 'center' as const,
      render: (_: unknown, record: InspectionDto) => <InspectionRowActions record={record} onOpen={() => handleOpenDetail(record.id)} checklistPath="/reviewer/checklists" />,
    },
  ];

  return (
    <div className="data-page">
      <PageHeader title="Hồ sơ nghiệm thu" count={`${totalCount} hồ sơ`} actions={<Button icon={<CheckSquareOutlined />} onClick={() => navigate('/reviewer/checklists')}>Kế hoạch kiểm tra</Button>} />
      {listError && <QueryState error={listError} retry={loadData} entity="hồ sơ" />}

      <Card className="list-surface">
        <div className="list-toolbar">
          <Space size={12}>
            <Input
              placeholder="Tìm theo mã hồ sơ hoặc cấu kiện..."
              prefix={<SearchOutlined style={{ color: '#667085' }} />}
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value);
              }}
              style={{ width: 280 }}
            />
            <Select
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
              }}
              style={{ width: 180 }}
              options={[{ value: 'ALL', label: 'Tất cả trạng thái' }, ...inspectionStatusOptions]}
            />
          </Space>
          <Space>{(searchText || statusFilter !== 'ALL') && <Button onClick={clearFilters}>Xóa bộ lọc</Button>}<Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Làm mới
          </Button></Space>
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
        isSubmitterRole={false}
      />
    </div>
  );
};
