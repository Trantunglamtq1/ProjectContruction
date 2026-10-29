import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Table, Button, Space, Input, Select, Typography, Tag, Alert, Badge, message } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  CheckSquareOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { inspectionApi } from '../../services/inspectionApi';
import { InspectionDetailDrawer } from '../../components/inspections/InspectionDetailDrawer';
import type { InspectionDto, InspectionStatus } from '../../types/inspection';

const { Text } = Typography;

export const ApproverInspectionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlInspectionId = searchParams.get('inspectionId');
  const urlSearch = searchParams.get('search');

  const [loading, setLoading] = useState(false);
  const [inspections, setInspections] = useState<InspectionDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [searchText, setSearchText] = useState(urlSearch || '');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  useEffect(() => {
    if (urlInspectionId) {
      setSelectedInspectionId(urlInspectionId);
      setDetailDrawerVisible(true);
    }
  }, [urlInspectionId]);

  useEffect(() => {
    if (urlSearch && urlSearch !== searchText) {
      setSearchText(urlSearch);
    }
  }, [urlSearch]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inspectionApi.getInspections({
        pageNumber: pageIndex,
        pageSize: pageSize,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: searchText.trim() || undefined,
      });
      setInspections(res.items || []);
      setTotalCount(res.totalCount || 0);
    } catch {
      message.error('Không thể tải danh sách hồ sơ kiểm tra.');
    } finally {
      setLoading(false);
    }
  }, [pageIndex, pageSize, statusFilter, searchText]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDetail = (id: string) => {
    setSelectedInspectionId(id);
    setDetailDrawerVisible(true);
  };

  const columns = [
    {
      title: 'Mã hồ sơ',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (id: string) => (
        <Text strong style={{ color: '#1677FF', cursor: 'pointer' }} onClick={() => handleOpenDetail(id)}>
          #{id.substring(0, 8).toUpperCase()}
        </Text>
      ),
    },
    {
      title: 'Hạng mục / Cấu kiện nghiệm thu',
      dataIndex: 'objectName',
      key: 'objectName',
      render: (text: string, record: InspectionDto) => (
        <Space direction="vertical" size={2}>
          <Text strong>{text}</Text>
          {record.checklistId ? (
            <Button
              type="link"
              size="small"
              icon={<CheckSquareOutlined />}
              style={{ padding: 0, height: 'auto', fontSize: 12, fontWeight: 600 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/approver/checklists?checklistId=${record.checklistId}`);
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
      title: 'Kỹ sư / Giám sát',
      key: 'participants',
      width: 200,
      render: (_: any, record: InspectionDto) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: 12 }}>Kỹ sư: <Tag color="blue" style={{ margin: 0 }}>{record.submittedBy || 'Kỹ sư'}</Tag></Text>
          {record.reviewedBy && (
            <Text style={{ fontSize: 12 }}>Giám sát: <Tag color="orange" style={{ margin: 0 }}>{record.reviewedBy}</Tag></Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Bản vẽ',
      dataIndex: 'drawingFileName',
      key: 'drawingFileName',
      render: (text: string, record: InspectionDto) => (
        <Space direction="vertical" size={1}>
          <Text type="secondary">{text || '—'}</Text>
          {record.drawingPageNumber && (
            <Tag style={{ fontSize: 10 }}>Trang {record.drawingPageNumber}</Tag>
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
      render: (status: InspectionStatus) => {
        if (status === 'Submitted') {
          return <Badge status="warning" text={<span style={{ fontWeight: 500, color: '#FAAD14' }}>Chờ thẩm tra</span>} />;
        }
        if (status === 'UnderReview') {
          return <Badge status="processing" text={<span style={{ fontWeight: 500, color: '#1677FF' }}>Đang thẩm tra</span>} />;
        }
        if (status === 'Reviewed') {
          return <Badge status="processing" text={<span style={{ fontWeight: 600, color: '#1677FF' }}>Chờ CĐT duyệt</span>} />;
        }
        if (status === 'Approved') {
          return <Badge status="success" text={<span style={{ fontWeight: 600, color: '#52C41A' }}>Đã nghiệm thu</span>} />;
        }
        if (status === 'Rejected') {
          return <Badge status="error" text={<span style={{ fontWeight: 500, color: '#FF4D4F' }}>Đã từ chối</span>} />;
        }
        return <Tag>{status}</Tag>;
      },
    },
    {
      title: 'Thời gian',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (dateStr: string) => (dateStr ? new Date(dateStr).toLocaleString('vi-VN') : '—'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 200,
      align: 'center' as const,
      render: (_: any, record: InspectionDto) => (
        <Space size={6}>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetail(record.id)}
          >
            Xem phiếu
          </Button>
          {record.checklistId ? (
            <Button
              size="small"
              type="dashed"
              icon={<CheckSquareOutlined />}
              onClick={() => navigate(`/approver/checklists?checklistId=${record.checklistId}`)}
            >
              Checklist
            </Button>
          ) : (
            <Button
              size="small"
              icon={<CheckSquareOutlined />}
              onClick={() => navigate('/approver/checklists')}
            >
              Checklist
            </Button>
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
            <Text strong>Danh sách Hồ sơ Nghiệm thu (Chủ Đầu Tư)</Text>
          </Space>
        }
        description="Danh sách hồ sơ nghiệm thu kỹ thuật hiện trường. Bạn có thể nhấn vào từng hồ sơ để xem chi tiết form hoặc nhấn nút Checklist để đối chiếu trực tiếp trong Kế hoạch Checklist cấu kiện."
        type="info"
        showIcon
        action={
          <Button
            size="small"
            type="primary"
            icon={<CheckSquareOutlined />}
            onClick={() => navigate('/approver/checklists')}
          >
            Đến Tra cứu Checklist
          </Button>
        }
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
                { value: 'Reviewed', label: 'Chờ CĐT duyệt' },
                { value: 'Approved', label: 'Đã nghiệm thu' },
                { value: 'Submitted', label: 'Chờ thẩm tra' },
                { value: 'Rejected', label: 'Đã từ chối' },
              ]}
            />
          </Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            Làm mới
          </Button>
        </div>

        <Table
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
              setPageIndex(page);
              setPageSize(size);
            },
          }}
          bordered
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
            searchParams.delete('inspectionId');
            setSearchParams(searchParams, { replace: true });
          }
        }}
        onUpdated={loadData}
        isSubmitterRole={false}
      />
    </div>
  );
};
