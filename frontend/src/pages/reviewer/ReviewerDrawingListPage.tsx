import React, { useState } from 'react';
import { Card, Table, Button, Space, Input, Typography, Tag, Alert } from 'antd';
import {
  FilePdfOutlined,
  SearchOutlined,
  ReloadOutlined,
  CompassOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { drawingApi, type DrawingFileDto } from '../../services/drawingApi';
import { DrawingViewportModal } from '../../components/viewport/DrawingViewportModal';

const { Text } = Typography;

export const ReviewerDrawingListPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [viewportDrawing, setViewportDrawing] = useState<DrawingFileDto | null>(null);
  const [isViewportOpen, setIsViewportOpen] = useState(false);

  const handleOpenViewport = (drawing: DrawingFileDto) => {
    setViewportDrawing(drawing);
    setIsViewportOpen(true);
  };

  const {
    data: drawings = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['reviewer-drawings', searchText],
    queryFn: () => drawingApi.getDrawings(searchText),
  });

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center' as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Tên bản vẽ công trình',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (text: string) => (
        <Space>
          <FilePdfOutlined style={{ color: '#FAAD14', fontSize: 18 }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Kỹ sư tải lên',
      dataIndex: 'uploadedBy',
      key: 'uploadedBy',
      width: 170,
      render: (text: string) => <Tag color="blue">{text || 'Submitter'}</Tag>,
    },
    {
      title: 'Ngày cập nhật',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      width: 170,
      render: (dateStr: string) => new Date(dateStr).toLocaleString('vi-VN'),
    },
    {
      title: 'Object giám sát',
      dataIndex: 'objectCount',
      key: 'objectCount',
      width: 150,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color="orange" style={{ fontWeight: 500 }}>
          {count} Object
        </Tag>
      ),
    },
    {
      title: 'Thao tác thẩm tra',
      key: 'actions',
      width: 280,
      align: 'center' as const,
      render: (_: any, record: DrawingFileDto) => (
        <Space size={8}>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<CompassOutlined />}
            onClick={() => handleOpenViewport(record)}
          >
            Xem Viewport
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
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        message={
          <Space>
            <Tag color="orange" style={{ fontWeight: 600 }}>REVIEWER WORKSPACE</Tag>
            <Text strong>Không gian làm việc Tư vấn giám sát - Bản vẽ dự án</Text>
          </Space>
        }
        description="Chế độ giám sát: Bạn có quyền xem bản vẽ, đối chiếu các vùng khoanh Object do kỹ sư hiện trường đánh dấu và kiểm tra tính tuân thủ hồ sơ nghiệm thu."
        type="warning"
        showIcon
      />

      <Card style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input
            placeholder="Tìm kiếm bản vẽ công trình..."
            prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
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
          pagination={{ pageSize: 10 }}
          bordered
          size="middle"
        />
      </Card>

      {/* REVIEWER VIEWPORT MODAL */}
      <DrawingViewportModal
        open={isViewportOpen}
        drawing={viewportDrawing}
        onClose={() => setIsViewportOpen(false)}
        onObjectCreated={() => refetch()}
      />
    </div>
  );
};
