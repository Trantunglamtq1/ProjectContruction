import {
  CompassOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Input, Space, Table, Tag, Typography } from 'antd';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import { QueryState } from '../../components/ui/QueryState';
import { drawingApi, type DrawingFileDto } from '../../services/drawingApi';

const { Text } = Typography;

export const ApproverDrawingListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');

  const handleOpenViewport = (drawing: DrawingFileDto) => {
    navigate(`/approver/drawings/${drawing.id}/viewport`);
  };

  const {
    data: drawings = [],
    error: listError,
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
      title: 'Số cấu kiện',
      dataIndex: 'objectCount',
      key: 'objectCount',
      width: 180,
      align: 'center' as const,
      render: (count: number) => (
        <Tag style={{ fontWeight: 500 }}>
          {count} cấu kiện
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
            Mở bản vẽ
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
    <div className="data-page">
      <PageHeader title="Bản vẽ" count={`${drawings.length} bản vẽ`} />
      {listError && <QueryState error={listError} retry={() => refetch()} entity="bản vẽ" />}

      <Card className="list-surface">
        <div className="list-toolbar">
          <Input
            placeholder="Tra cứu bản vẽ theo tên..."
            prefix={<SearchOutlined style={{ color: '#667085' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
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
          pagination={{ pageSize: 10 }}

          size="middle"
        />
      </Card>
    </div>
  );
};
