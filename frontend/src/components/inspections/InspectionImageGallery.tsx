import React, { useState } from 'react';
import {
  Upload,
  Typography,
  Space,
  Button,
  Popconfirm,
  Image,
  message,
  Spin,
  Empty,
  Tag,
} from 'antd';
import {
  CloudUploadOutlined,
  DeleteOutlined,
  FilePdfOutlined,
  PictureOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { InspectionAttachmentDto } from '../../types/inspection';
import { inspectionApi } from '../../services/inspectionApi';

const { Text } = Typography;
const { Dragger } = Upload;

interface InspectionImageGalleryProps {
  attachments: InspectionAttachmentDto[];
  onChange?: (updatedAttachments: InspectionAttachmentDto[]) => void;
  readonly?: boolean;
}

export const InspectionImageGallery: React.FC<InspectionImageGalleryProps> = ({
  attachments = [],
  onChange,
  readonly = false,
}) => {
  const [uploading, setUploading] = useState<boolean>(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isImageFile = (att: InspectionAttachmentDto) => {
    const ext = att.originalName.toLowerCase();
    return (
      att.contentType?.startsWith('image/') ||
      ext.endsWith('.jpg') ||
      ext.endsWith('.jpeg') ||
      ext.endsWith('.png') ||
      ext.endsWith('.webp') ||
      ext.endsWith('.heic')
    );
  };

  const handleUploadFile = async (file: File) => {
    const isLt15M = file.size / 1024 / 1024 < 15;
    if (!isLt15M) {
      message.error(`Tệp "${file.name}" vượt quá dung lượng 15MB.`);
      return Upload.LIST_IGNORE;
    }

    setUploading(true);
    try {
      const uploaded = await inspectionApi.uploadAttachment(file);
      const nextList = [...attachments, uploaded];
      onChange?.(nextList);
      message.success(`Tải lên "${file.name}" thành công!`);
    } catch {
      message.error(`Không thể tải lên tệp "${file.name}".`);
    } finally {
      setUploading(false);
    }

    return false; // Ngăn Ant Design tự động POST request mặc định
  };

  const handleDelete = (index: number) => {
    const nextList = attachments.filter((_, i) => i !== index);
    onChange?.(nextList);
    message.success('Đã xóa tệp đính kèm.');
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: false,
    accept: '.jpg,.jpeg,.png,.webp,.heic,.pdf',
    beforeUpload: (file) => handleUploadFile(file as File),
  };

  return (
    <div style={{ marginTop: 12 }}>
      {/* Header trạng thái đính kèm */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Space>
          <PictureOutlined style={{ color: '#1677FF', fontSize: 16 }} />
          <Text strong style={{ fontSize: 14, color: '#1F1F1F' }}>
            Ảnh hiện trường & Minh chứng kỹ thuật
          </Text>
          <Tag color={attachments.length > 0 ? 'processing' : 'default'}>
            {attachments.length} tệp
          </Tag>
        </Space>
        {!readonly && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Hỗ trợ JPG, PNG, WEBP, HEIC (Tối đa 15MB/tệp)
          </Text>
        )}
      </div>

      {/* Lưới Bento Grid Gallery */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {/* Card Upload Dragger (Chỉ hiện khi editable) */}
        {!readonly && (
          <div
            style={{
              minHeight: 140,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 8,
              overflow: 'hidden',
              border: '1.5px dashed #B8D6FF',
              backgroundColor: '#FAFCFF',
              transition: 'all 0.2s',
            }}
          >
            <Dragger
              {...uploadProps}
              style={{
                padding: '12px 8px',
                height: '100%',
                border: 'none',
                background: 'transparent',
              }}
              disabled={uploading}
            >
              {uploading ? (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 28 }} spin />} />
                  <div style={{ marginTop: 8, fontSize: 12, color: '#1677FF' }}>
                    Đang tải lên MinIO...
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <CloudUploadOutlined style={{ fontSize: 32, color: '#1677FF', marginBottom: 4 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1677FF' }}>
                    Thêm ảnh hiện trường
                  </div>
                  <div style={{ fontSize: 11, color: '#8C8C8C', marginTop: 2 }}>
                    Kéo thả hoặc bấm chọn
                  </div>
                </div>
              )}
            </Dragger>
          </div>
        )}

        {/* Danh sách các ảnh đã tải */}
        <Image.PreviewGroup>
          {attachments.map((att, idx) => {
            const isImg = isImageFile(att);
            return (
              <div
                key={att.storedFileName || idx}
                style={{
                  position: 'relative',
                  height: 140,
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid #E8E8E8',
                  backgroundColor: '#F5F5F5',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                {/* Phần hiển thị ảnh hoặc file icon */}
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FAFAFA',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {isImg ? (
                    <Image
                      src={att.fileUrl}
                      alt={att.originalName}
                      style={{
                        width: '100%',
                        height: 105,
                        objectFit: 'cover',
                        cursor: 'pointer',
                      }}
                      fallback="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23ccc'><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'>Lỗi ảnh</text></svg>"
                    />
                  ) : (
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        color: '#FF4D4F',
                      }}
                    >
                      <FilePdfOutlined style={{ fontSize: 36, marginBottom: 4 }} />
                      <Text style={{ fontSize: 11, color: '#595959' }}>Xem PDF</Text>
                    </a>
                  )}

                  {/* Nút hành động nổi lên khi hover */}
                  {!readonly && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        zIndex: 2,
                      }}
                    >
                      <Popconfirm
                        title="Xóa tệp này?"
                        description="Bạn có chắc chắn muốn bỏ ảnh này ra khỏi hồ sơ?"
                        onConfirm={() => handleDelete(idx)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          type="primary"
                          danger
                          shape="circle"
                          size="small"
                          icon={<DeleteOutlined />}
                          style={{
                            opacity: 0.85,
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          }}
                        />
                      </Popconfirm>
                    </div>
                  )}
                </div>

                {/* Footer thông tin tên & dung lượng */}
                <div
                  style={{
                    padding: '4px 8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    color: '#FFF',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 10,
                  }}
                >
                  <span
                    style={{
                      maxWidth: 110,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={att.originalName}
                  >
                    {att.originalName}
                  </span>
                  <span style={{ color: '#D9D9D9', marginLeft: 4 }}>
                    {formatFileSize(att.size)}
                  </span>
                </div>
              </div>
            );
          })}
        </Image.PreviewGroup>
      </div>

      {/* Hiển thị khi danh sách rỗng ở chế độ readonly */}
      {readonly && attachments.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Chưa có ảnh hiện trường hoặc tệp minh chứng nào được đính kèm."
          style={{ padding: '24px 0' }}
        />
      )}
    </div>
  );
};
