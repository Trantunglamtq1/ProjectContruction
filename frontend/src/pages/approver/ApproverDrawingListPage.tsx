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

export const ApproverDrawingListPage: React.FC = () => {
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
    queryKey: ['approver-drawings', searchText],
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
      title: 'Bản vẽ thi công công trình',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (text: string) => (
        <Space>
          <FilePdfOutlined style={{ color: '#52C41A', fontSize: 18 }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Đơn vị đệ trình',
      dataIndex: 'uploadedBy',
      key: 'uploadedBy',
      width: 170,
      render: (text: string) => <Tag color="blue">{text || 'Submitter'}</Tag>,
    },
    {
      title: 'Ngày lưu trữ',
      dataIndex: 'uploadedAt',
      key: 'uploadedAt',
      width: 170,
      render: (dateStr: string) => new Date(dateStr).toLocaleString('vi-VN'),
    },
    {
      title: 'Tổng số cấu kiện Object',
      dataIndex: 'objectCount',
      key: 'objectCount',
      width: 180,
      align: 'center' as const,
      render: (count: number) => (
        <Tag color="green" style={{ fontWeight: 500 }}>
          {count} Cấu kiện
        </Tag>
      ),
    },
    {
      title: 'Tra cứu hồ sơ bản vẽ',
      key: 'actions',
      width: 280,
      align: 'center' as const,
      render: (_: any, record: DrawingFileDto) => (
        <Space size={8}>
          <Button
            size="small"
            type="primary"
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
            <Text strong>Không gian làm việc Cấp Phê Duyệt / Chủ Đầu Tư - Bản vẽ</Text>
          </Space>
        }
        description="Tra cứu bản vẽ kỹ thuật phục vụ công tác đối soát hiện trường và đưa ra quyết định phê duyệt các giai đoạn thi công dự án."
        type="success"
        showIcon
      />

      <Card style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input
            placeholder="Tra cứu bản vẽ theo tên..."
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

      {/* APPROVER VIEWPORT MODAL */}
      <DrawingViewportModal
        open={isViewportOpen}
        drawing={viewportDrawing}
        onClose={() => setIsViewportOpen(false)}
        onObjectCreated={() => refetch()}
      />
    </div>
  );
};
