import { downloadPrivateFile } from '../../services/privateFiles';
import { getSelectedProjectId } from '../../services/projectScope';
import {
  CloseCircleOutlined,
  CompassOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Card,
  Input, Modal, Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message
} from 'antd';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { QueryState } from '../../components/ui/QueryState';
import { useAuth } from '../../contexts/AuthContext';
import { drawingApi, type DrawingFileDto } from '../../services/drawingApi';

const { Text } = Typography;
const { Dragger } = Upload;

export const SubmitterDrawingListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleOpenViewport = (drawing: DrawingFileDto) => {
    navigate(`/submitter/drawings/${drawing.id}/viewport`);
  };

  // Fetch drawings query
  const {
    data: drawings = [],
    error: listError,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['submitter-drawings', searchText, getSelectedProjectId()],
    queryFn: () => drawingApi.getDrawings(searchText),
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => drawingApi.uploadDrawing(file, user?.fullName || user?.username),
    onSuccess: (data) => {
      setUploadOpen(false);
      message.success(`Tải bản vẽ "${data.fileName}" thành công!`);
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
      title: 'Số cấu kiện',
      dataIndex: 'objectCount',
      key: 'objectCount',
      width: 150,
      align: 'center' as const,
      render: (count: number) => (
        <Tag style={{ fontSize: 13, padding: '2px 10px' }}>
          {count} cấu kiện
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
            Mở bản vẽ
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => { void downloadPrivateFile(record.fileUrl, record.fileName).catch(() => message.error('Không thể tải tệp.')); }}
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
    <div className="data-page">
      {/* Role Banner */}
      <PageHeader title="Bản vẽ" count={`${drawings.length} bản vẽ`} actions={<Button type="primary" icon={<FilePdfOutlined />} onClick={() => setUploadOpen(true)}>Tải bản vẽ</Button>} />
      {listError && <QueryState error={listError} retry={() => refetch()} entity="bản vẽ" />}

      {/* Upload Box */}
      <Modal title="Tải bản vẽ" open={uploadOpen} onCancel={() => !uploadMutation.isPending && setUploadOpen(false)} footer={null} width={{ xs: 'calc(100vw - 24px)', md: 600 }}><Card
        title={
          <Space>
            <FilePdfOutlined style={{ color: '#1D4ED8' }} />
            <span>Tải lên bản vẽ công trình mới (Chỉ nhận PDF, tối đa 100MB)</span>
          </Space>
        }
        className="list-surface"
      >
        {uploadMutation.isError && <QueryState error={uploadMutation.error} entity="bản vẽ tải lên" />}
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
            <InboxOutlined style={{ fontSize: 48, color: '#1D4ED8' }} />
          </p>
          <p className="ant-upload-text" style={{ fontSize: 16, fontWeight: 500, color: '#1F2937' }}>
            Nhấp hoặc kéo thả file PDF bản vẽ vào đây để tải lên
          </p>
          <p className="ant-upload-hint" style={{ color: '#667085' }}>
            Định dạng PDF, tối đa 100 MB.
          </p>
        </Dragger>
      </Card></Modal>

      {/* Search and Table */}
      <Card className="list-surface">
        <div className="list-toolbar">
          <Input
            placeholder="Tìm kiếm bản vẽ theo tên..."
            prefix={<SearchOutlined style={{ color: '#667085' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear={{ clearIcon: <CloseCircleOutlined aria-label="Xóa tìm kiếm" /> }}
            style={{ width: 320 }}
          />
          <Button icon={<ReloadOutlined spin={isRefetching} />} onClick={() => refetch()}>
            Làm mới
          </Button>
        </div>

        <Table locale={{ emptyText: listError ? null : <QueryState filtered={Boolean(searchText)} entity="bản vẽ" /> }} scroll={{ x: 1100 }}
          dataSource={drawings}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 10, showTotal: (total) => `Tổng cộng ${total} bản vẽ` }}

          size="middle"
        />
      </Card>
    </div>
  );
};
