import React, { useState } from 'react';
import {
  Card,
  Table,
  Upload,
  Button,
  Space,
  Input,
  Typography,
  Tag,
  message,
  Alert,
  Popconfirm,
} from 'antd';
import {
  InboxOutlined,
  FilePdfOutlined,
  SearchOutlined,
  ReloadOutlined,
  CompassOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { drawingApi, type DrawingFileDto } from '../../services/drawingApi';
import { useAuth } from '../../contexts/AuthContext';
import { DrawingViewportModal } from '../../components/viewport/DrawingViewportModal';

const { Text } = Typography;
const { Dragger } = Upload;

export const SubmitterDrawingListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [viewportDrawing, setViewportDrawing] = useState<DrawingFileDto | null>(null);
  const [isViewportOpen, setIsViewportOpen] = useState(false);

  const handleOpenViewport = (drawing: DrawingFileDto) => {
    setViewportDrawing(drawing);
    setIsViewportOpen(true);
  };

  // Fetch drawings query
  const {
    data: drawings = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['submitter-drawings', searchText],
    queryFn: () => drawingApi.getDrawings(searchText),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => drawingApi.uploadDrawing(file, user?.fullName || user?.username),
    onSuccess: (data) => {
      message.success(`Upload bản vẽ "${data.fileName}" thành công!`);
      queryClient.invalidateQueries({ queryKey: ['submitter-drawings'] });
    },
    onError: (error: any) => {
      const errMsg = error?.response?.data?.message || 'Có lỗi xảy ra khi tải lên bản vẽ.';
      message.error(errMsg);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => drawingApi.deleteDrawing(id),
    onSuccess: () => {
      message.success('Đã xóa bản vẽ và các cấu kiện liên quan thành công!');
      queryClient.invalidateQueries({ queryKey: ['submitter-drawings'] });
    },
    onError: (error: any) => {
      const errMsg = error?.response?.data?.message || 'Không thể xóa bản vẽ. Vui lòng thử lại!';
      message.error(errMsg);
    },
  });

  const handleCustomUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    try {
      await uploadMutation.mutateAsync(file as File);
      onSuccess?.('ok');
    } catch (err) {
      onError?.(err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Tên bản vẽ (PDF)',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (text: string) => (
        <Space>
          <FilePdfOutlined style={{ color: '#FF4D4F', fontSize: 18 }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Kích thước',
      dataIndex: 'fileSizeBytes',
      key: 'fileSizeBytes',
      width: 120,
      render: (bytes: number) => formatFileSize(bytes),
    },
    {
      title: 'Người tải lên',
      dataIndex: 'uploadedBy',
      key: 'uploadedBy',
      width: 160,
      render: (text: string) => <Tag color="blue">{text || 'Submitter'}</Tag>,
    },
    {
      title: 'Ngày tải',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      width: 170,
      render: (dateStr: string) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
      },
    },
    {
      title: 'Số Object đã tạo',
      dataIndex: 'objectCount',
      key: 'objectCount',
      width: 150,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color={count > 0 ? 'cyan' : 'default'} style={{ fontSize: 13, padding: '2px 10px' }}>
          {count} Object
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 300,
      align: 'center' as const,
      render: (_: any, record: DrawingFileDto) => (
        <Space size={8}>
          <Button
            type="primary"
            size="small"
            icon={<CompassOutlined />}
            onClick={() => handleOpenViewport(record)}
          >
            Mở Viewport
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => {
              const link = document.createElement('a');
              link.href = record.fileUrl;
              link.download = record.fileName;
              link.target = '_blank';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            Tải về
          </Button>
          <Popconfirm
            title="Xác nhận xóa bản vẽ"
            description={
              <div style={{ maxWidth: 260 }}>
                Bạn có chắc chắn muốn xóa bản vẽ <b>{record.fileName}</b>?
                <br />
                <span style={{ color: '#FF4D4F', fontSize: 12 }}>
                  Lưu ý: Các cấu kiện đã khoanh trên bản vẽ này cũng sẽ bị xóa.
                </span>
              </div>
            }
            okText="Xóa bản vẽ"
            cancelText="Hủy"
            okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleteMutation.isPending && deleteMutation.variables === record.id}
            >
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Role Banner */}
      <Alert
        message={
          <Space>
            <Tag color="blue" style={{ fontWeight: 600 }}>SUBMITTER WORKSPACE</Tag>
            <Text strong>Không gian làm việc Kỹ sư hiện trường</Text>
          </Space>
        }
        description="Tại giao diện này, bạn có thể tải lên các bản vẽ thiết kế/thi công định dạng PDF, mở Viewport để khoanh vùng marker tạo Object và khởi tạo hồ sơ nghiệm thu."
        type="info"
        showIcon
      />

      {/* Upload Box */}
      <Card
        title={
          <Space>
            <FilePdfOutlined style={{ color: '#1677FF' }} />
            <span>Tải lên bản vẽ công trình mới (Chỉ nhận PDF, tối đa 100MB)</span>
          </Space>
        }
        style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
      >
        <Dragger
          name="file"
          accept=".pdf,application/pdf"
          multiple={false}
          showUploadList={false}
          customRequest={handleCustomUpload}
          disabled={uploadMutation.isPending}
          style={{ padding: '20px 0', background: '#FAFCFF', border: '1px dashed #91CAFF', borderRadius: 8 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ fontSize: 48, color: '#1677FF' }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500, color: '#1F2937' }}>
            Nhấp hoặc kéo thả file PDF bản vẽ vào đây để tải lên
          </p>
          <p className="ant-upload-hint" style={{ color: '#8C8C8C' }}>
            Hệ thống hỗ trợ bản vẽ kiến trúc, kết cấu, MEP định dạng PDF phục vụ Viewport khoanh vùng Object.
          </p>
        </Dragger>
      </Card>

      {/* Search and Table */}
      <Card style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input
            placeholder="Tìm kiếm bản vẽ theo tên..."
            prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 320 }}
          />
          <Button icon={<ReloadOutlined spin={isRefetching} />} onClick={() => refetch()}>
            Làm mới
          </Button>
        </div>

        <Table
          dataSource={drawings}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showTotal: (total) => `Tổng cộng ${total} bản vẽ` }}
          bordered
          size="middle"
        />
      </Card>

      {/* INTERACTIVE DRAWING VIEWPORT MODAL */}
      <DrawingViewportModal
        open={isViewportOpen}
        drawing={viewportDrawing}
        onClose={() => setIsViewportOpen(false)}
        onObjectCreated={() => refetch()}
      />
    </div>
  );
};
