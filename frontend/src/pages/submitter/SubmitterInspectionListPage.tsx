import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Input,
  Select,
  Typography,
  Tag,
  Alert,
  Row,
  Col,
  Statistic,
  message,
  Popconfirm,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  EyeOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { inspectionApi } from '../../services/inspectionApi';
import { CreateInspectionModal } from '../../components/inspections/CreateInspectionModal';
import { InspectionDetailDrawer } from '../../components/inspections/InspectionDetailDrawer';
import type { InspectionDto, InspectionStatus } from '../../types/inspection';

const { Text } = Typography;

export const SubmitterInspectionListPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [inspections, setInspections] = useState<InspectionDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageIndex, setPageIndex] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

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
      message.error('Không thể tải danh sách hồ sơ nghiệm thu.');
    } finally {
      setLoading(false);
    }
  }, [pageIndex, pageSize, statusFilter, searchText]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: string) => {
    try {
      await inspectionApi.deleteInspection(id);
      message.success('Đã xóa đơn kiểm tra nháp.');
      loadData();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Không thể xóa hồ sơ này.';
      message.error(msg);
    }
  };

  const handleOpenDetail = (id: string) => {
    setSelectedInspectionId(id);
    setDetailDrawerVisible(true);
  };

  const handleCreateSuccess = (newInspection: InspectionDto) => {
    setCreateModalVisible(false);
    loadData();
    // Mở ngay Drawer chi tiết để kỹ sư điền thông số kỹ thuật
    setSelectedInspectionId(newInspection.id);
    setDetailDrawerVisible(true);
  };

  const renderStatusTag = (status: InspectionStatus) => {
    switch (status) {
      case 'Approved':
        return <Tag color="success" icon={<CheckCircleOutlined />}>Đã duyệt (CĐT)</Tag>;
      case 'Reviewed':
        return <Tag color="purple" icon={<CheckCircleOutlined />}>Đạt Cấp 1</Tag>;
      case 'UnderReview':
        return <Tag color="processing" icon={<ClockCircleOutlined />}>Đang thẩm tra</Tag>;
      case 'Submitted':
        return <Tag color="warning" icon={<ClockCircleOutlined />}>Chờ thẩm tra</Tag>;
      case 'Rejected':
        return <Tag color="error" icon={<CloseCircleOutlined />}>Bị từ chối / Cần sửa</Tag>;
      default:
        return <Tag color="default" icon={<EditOutlined />}>Bản nháp (Draft)</Tag>;
    }
  };

  // Thống kê sơ bộ
  const countByStatus = (status: InspectionStatus) =>
    inspections.filter((item) => item.status === status).length;

  const columns = [
    {
      title: 'Mã hồ sơ',
      dataIndex: 'id',
      key: 'id',
      width: 140,
      render: (id: string, record: InspectionDto) => (
        <div>
          <Text strong style={{ color: '#1677FF', cursor: 'pointer' }} onClick={() => handleOpenDetail(id)}>
            #{id.substring(0, 8).toUpperCase()}
          </Text>
          {record.workflowInstanceId && (
            <div style={{ marginTop: 2 }}>
              <Tag color="purple" style={{ fontSize: 10, padding: '0 4px', margin: 0, fontFamily: 'monospace' }}>
                {record.workflowInstanceId}
              </Tag>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Hạng mục / Cấu kiện (Object)',
      dataIndex: 'objectName',
      key: 'objectName',
      render: (text: string, record: InspectionDto) => {
        let titleFromData = '';
        if (record.formDataJson) {
          try {
            const parsed = JSON.parse(record.formDataJson);
            titleFromData = parsed.inspectionTitle || '';
          } catch {
            // ignore
          }
        }
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{titleFromData || text}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Cấu kiện: {text}
            </Text>
          </div>
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
            <Tag style={{ fontSize: 11 }}>Trang {record.drawingPageNumber}</Tag>
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Mẫu kiểm tra',
      dataIndex: 'formSchemaId',
      key: 'formSchemaId',
      width: 160,
      render: (schemaId: string) => {
        let label = 'Tiêu chuẩn';
        let color = 'default';
        if (schemaId?.includes('rebar')) {
          label = 'Cốt thép';
          color = 'blue';
        } else if (schemaId?.includes('concrete')) {
          label = 'Bê tông';
          color = 'cyan';
        }
        return <Tag color={color}>{label}</Tag>;
      },
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
      title: 'Ngày tạo/nộp',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (dateStr: string) => new Date(dateStr).toLocaleString('vi-VN'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 170,
      align: 'center' as const,
      render: (_: any, record: InspectionDto) => {
        const isDraft = record.status === 'Draft';
        const isRejected = record.status === 'Rejected';

        return (
          <Space size={6}>
            {isDraft || isRejected ? (
              <Button
                size="small"
                type="primary"
                ghost={isDraft}
                danger={isRejected}
                icon={<EditOutlined />}
                onClick={() => handleOpenDetail(record.id)}
              >
                {isRejected ? 'Sửa lại' : 'Sửa / Nộp'}
              </Button>
            ) : (
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleOpenDetail(record.id)}
              >
                Xem
              </Button>
            )}

            {isDraft && (
              <Popconfirm
                title="Xóa hồ sơ kiểm tra?"
                description="Bản nháp này sẽ bị xóa hoàn toàn khỏi hệ thống."
                onConfirm={() => handleDelete(record.id)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Banner giới thiệu */}
      <Alert
        message={
          <Space>
            <Tag color="blue" style={{ fontWeight: 600 }}>
              SUBMITTER WORKSPACE
            </Tag>
            <Text strong>Quản lý Hồ sơ Nghiệm thu (Form Inspection)</Text>
          </Space>
        }
        description="Khởi tạo biên bản kiểm tra gắn với các cấu kiện Object đã khoanh vùng trên bản vẽ CAD. Bạn có thể lưu nháp nhiều lần trước khi nộp chính thức gửi Tư vấn giám sát thẩm tra."
        type="info"
        showIcon
      />

      {/* Thẻ thống kê tổng quan */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #1677FF' }}>
            <Statistic title="Tổng hồ sơ" value={totalCount} prefix={<FileDoneOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #8C8C8C' }}>
            <Statistic
              title="Bản nháp"
              value={countByStatus('Draft')}
              valueStyle={{ color: '#595959' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #FAAD14' }}>
            <Statistic
              title="Chờ thẩm tra"
              value={countByStatus('Submitted')}
              valueStyle={{ color: '#FAAD14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #722ED1' }}>
            <Statistic
              title="Đạt Cấp 1"
              value={countByStatus('Reviewed')}
              valueStyle={{ color: '#722ED1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #52C41A' }}>
            <Statistic
              title="Đã duyệt (CĐT)"
              value={countByStatus('Approved')}
              valueStyle={{ color: '#52C41A' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" style={{ borderRadius: 8, borderLeft: '4px solid #FF4D4F' }}>
            <Statistic
              title="Bị từ chối"
              value={countByStatus('Rejected')}
              valueStyle={{ color: '#FF4D4F' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Bảng dữ liệu chính */}
      <Card style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <Space size={12}>
            <Input
              placeholder="Tìm theo mã hoặc tên cấu kiện..."
              prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={() => {
                setPageIndex(1);
                loadData();
              }}
              style={{ width: 260 }}
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setPageIndex(1);
              }}
              style={{ width: 180 }}
              options={[
                { value: 'ALL', label: 'Tất cả trạng thái' },
                { value: 'Draft', label: 'Bản nháp (Draft)' },
                { value: 'Submitted', label: 'Chờ thẩm tra' },
                { value: 'UnderReview', label: 'Đang thẩm tra' },
                { value: 'Reviewed', label: 'Đạt Cấp 1' },
                { value: 'Approved', label: 'Đã phê duyệt' },
                { value: 'Rejected', label: 'Bị từ chối / Cần sửa' },
              ]}
            />
          </Space>

          <Space size={8}>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
              style={{ backgroundColor: '#1677FF', fontWeight: 600 }}
            >
              + Tạo mới Inspection
            </Button>
          </Space>
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

      {/* Modal Khởi tạo Inspection mới */}
      <CreateInspectionModal
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Drawer xem chi tiết, điền form động và xem lịch sử */}
      <InspectionDetailDrawer
        visible={detailDrawerVisible}
        inspectionId={selectedInspectionId}
        onClose={() => {
          setDetailDrawerVisible(false);
          setSelectedInspectionId(null);
        }}
        onUpdated={loadData}
        isSubmitterRole={true}
      />
    </div>
  );
};
