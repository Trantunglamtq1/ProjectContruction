import React, { useState, useMemo } from 'react';
import {
  Modal,
  Space,
  Typography,
  Tag,
  Button,
  Input,
  Segmented,
  Tooltip,
  Popconfirm,
  message,
} from 'antd';
import {
  FilePdfOutlined,
  CheckCircleOutlined,
  UnorderedListOutlined,
  RightOutlined,
  SearchOutlined,
  AppstoreOutlined,
  AimOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { objectApi, type CreateObjectPayload } from '../../services/objectApi';
import type { DrawingFileDto } from '../../services/drawingApi';
import { SmartDrawingViewport } from './SmartDrawingViewport';
import type { Point, SavedObjectData } from './cv/types';
import { pointsToSmoothSvgPath } from './cv/curveFitting';

const { Text } = Typography;

export interface DrawingViewportModalProps {
  open: boolean;
  drawing: DrawingFileDto | null;
  onClose: () => void;
  onObjectCreated?: () => void;
}

export function parseMarkerCoords(coordsStr: string): {
  type?: 'polygon' | 'rect';
  points?: Point[];
  svgPath?: string;
  code?: string;
  status?: 'PENDING' | 'PASS' | 'FAIL' | 'IN_PROGRESS';
  x: number;
  y: number;
  width: number;
  height: number;
  containerWidth?: number;
  containerHeight?: number;
} | null {
  try {
    const obj = JSON.parse(coordsStr);
    let points: Point[] | undefined = undefined;

    if (Array.isArray(obj.points) && obj.points.length >= 3) {
      points = obj.points.map((p: any) => ({
        x: Number(p.x ?? p.X ?? 0),
        y: Number(p.y ?? p.Y ?? 0),
      }));
    }

    let x = Number(obj.x ?? obj.X ?? 0);
    let y = Number(obj.y ?? obj.Y ?? 0);
    let width = Number(obj.width ?? obj.Width ?? 0);
    let height = Number(obj.height ?? obj.Height ?? 0);

    if (points && points.length >= 3 && (width <= 0 || height <= 0)) {
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      x = Math.min(...xs);
      y = Math.min(...ys);
      width = Math.max(1, Math.max(...xs) - x);
      height = Math.max(1, Math.max(...ys) - y);
    }

    if (width <= 0 || height <= 0) return null;

    return {
      type: obj.type || 'polygon',
      points,
      svgPath: obj.svgPath,
      code: obj.code,
      status: obj.status,
      x,
      y,
      width,
      height,
      containerWidth: obj.containerWidth ? Number(obj.containerWidth) : undefined,
      containerHeight: obj.containerHeight ? Number(obj.containerHeight) : undefined,
    };
  } catch {
    return null;
  }
}

export const DrawingViewportModal: React.FC<DrawingViewportModalProps> = ({
  open,
  drawing,
  onClose,
  onObjectCreated,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSubmitter = user?.role === 'Submitter';

  // State sidebar danh sách cấu kiện & định vị
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Query danh sách objects của bản vẽ từ SQL Server
  const { data: objects = [] } = useQuery({
    queryKey: ['drawing-objects', drawing?.id],
    queryFn: () => (drawing ? objectApi.getObjectsByDrawing(drawing.id) : Promise.resolve([])),
    enabled: !!drawing && open,
  });

  // Mutation tạo cấu kiện mới (mặc định luôn luôn là PENDING - Chờ nghiệm thu)
  const createObjectMutation = useMutation({
    mutationFn: (payload: CreateObjectPayload) => objectApi.createObject(payload),
    onSuccess: (newObj) => {
      message.success(`Đã lưu cấu kiện "${newObj.name}" thành công!`);
      queryClient.invalidateQueries({ queryKey: ['drawing-objects', drawing?.id] });
      queryClient.invalidateQueries({ queryKey: ['submitter-drawings'] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-drawings'] });
      queryClient.invalidateQueries({ queryKey: ['approver-drawings'] });
      setSelectedObjectId(newObj.id);
      onObjectCreated?.();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Không thể tạo cấu kiện.';
      message.error(msg);
    },
  });

  // Mutation xóa gán nhãn cấu kiện
  const deleteObjectMutation = useMutation({
    mutationFn: (objectId: string) => objectApi.deleteObject(objectId),
    onSuccess: () => {
      message.success('Đã xóa cấu kiện thành công!');
      if (selectedObjectId) {
        setSelectedObjectId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['drawing-objects', drawing?.id] });
      queryClient.invalidateQueries({ queryKey: ['submitter-drawings'] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-drawings'] });
      queryClient.invalidateQueries({ queryKey: ['approver-drawings'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Không thể xóa cấu kiện.';
      message.error(msg);
    },
  });

  // Chuyển đổi objects từ CSDL sang định dạng hiển thị cho Smart Drawing Viewport
  const mappedCvObjects: SavedObjectData[] = useMemo(() => {
    return objects.map((obj) => {
      const parsed = parseMarkerCoords(obj.markerCoordinates);
      let svgPath = parsed?.svgPath || '';
      let pts: Point[] = parsed?.points || [];

      if (!svgPath) {
        if (pts.length >= 3) {
          svgPath = pointsToSmoothSvgPath(pts, true);
        } else if (parsed) {
          pts = [
            { x: parsed.x, y: parsed.y },
            { x: parsed.x + parsed.width, y: parsed.y },
            { x: parsed.x + parsed.width, y: parsed.y + parsed.height },
            { x: parsed.x, y: parsed.y + parsed.height },
          ];
          svgPath = `M ${parsed.x} ${parsed.y} h ${parsed.width} v ${parsed.height} h -${parsed.width} Z`;
        }
      }

      const colorMap: Record<string, string> = {
        PENDING: '#1890ff',
        PASS: '#52c41a',
        FAIL: '#ff4d4f',
        IN_PROGRESS: '#faad14',
      };

      // Trạng thái được backend tính toán tự động dựa trên luồng duyệt Form Inspection & Checklist
      const resolvedStatus = obj.status || parsed?.status || 'PENDING';

      return {
        id: obj.id,
        code: parsed?.code || obj.name.split('-')[0]?.trim() || obj.id.slice(0, 6),
        name: obj.name,
        status: resolvedStatus as any,
        pageNumber: obj.pageNumber,
        svgPath,
        points: pts,
        boundingBox: {
          x: parsed?.x ?? 0,
          y: parsed?.y ?? 0,
          width: parsed?.width ?? 100,
          height: parsed?.height ?? 100,
        },
        originalSheetWidth: parsed?.containerWidth ?? 1200,
        originalSheetHeight: parsed?.containerHeight ?? 800,
        color: colorMap[resolvedStatus] || '#1890ff',
        createdAt: obj.createdAt || new Date().toISOString(),
      };
    });
  }, [objects]);

  // Bộ lọc danh sách cấu kiện theo ô tìm kiếm và trạng thái
  const filteredObjects = useMemo(() => {
    return mappedCvObjects.filter((obj) => {
      const matchSearch =
        !searchKeyword.trim() ||
        obj.code.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        obj.name.toLowerCase().includes(searchKeyword.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || obj.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [mappedCvObjects, searchKeyword, statusFilter]);

  const handleSaveCvObject = async (savedObj: SavedObjectData) => {
    if (!drawing) return;
    const payload: CreateObjectPayload = {
      drawingFileId: drawing.id,
      pageNumber: savedObj.pageNumber,
      markerCoordinates: JSON.stringify({
        type: 'polygon',
        points: savedObj.points,
        svgPath: savedObj.svgPath,
        x: Math.round(savedObj.boundingBox.x),
        y: Math.round(savedObj.boundingBox.y),
        width: Math.round(savedObj.boundingBox.width),
        height: Math.round(savedObj.boundingBox.height),
        containerWidth: Math.round(savedObj.originalSheetWidth),
        containerHeight: Math.round(savedObj.originalSheetHeight),
        code: savedObj.code,
        status: 'PENDING', // Luôn luôn khởi tạo ở trạng thái PENDING
      }),
      name: savedObj.name.startsWith(savedObj.code)
        ? savedObj.name.trim()
        : `${savedObj.code} - ${savedObj.name}`.trim(),
      createdBy: user?.username || 'Submitter',
    };
    await createObjectMutation.mutateAsync(payload);
  };

  const handleDeleteCvObject = async (objectId: string) => {
    await deleteObjectMutation.mutateAsync(objectId);
  };

  return (
    <Modal
      title={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingRight: 16,
            userSelect: 'none',
          }}
        >
          <Space align="center" size={12}>
            <FilePdfOutlined style={{ color: '#1677FF', fontSize: 22 }} />
            <div>
              <Text strong style={{ fontSize: 16 }}>
                Bản vẽ Kỹ thuật: {drawing?.fileName}
              </Text>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                <Tag color={isSubmitter ? 'blue' : user?.role === 'Reviewer' ? 'orange' : 'green'}>
                  {user?.role ? `${user.role.toUpperCase()} WORKSPACE` : 'VIEWPORT'}
                </Tag>
                <Tag color="cyan">
                  <CheckCircleOutlined /> {objects.length} Cấu kiện đã khoanh vùng
                </Tag>
              </div>
            </div>
          </Space>

          <Button
            type={isSidebarOpen ? 'primary' : 'default'}
            ghost={isSidebarOpen}
            icon={isSidebarOpen ? <RightOutlined /> : <UnorderedListOutlined />}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{ fontWeight: 500 }}
          >
            {isSidebarOpen ? 'Ẩn danh sách' : `Hiện danh sách (${objects.length})`}
          </Button>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width="96vw"
      style={{ top: 12 }}
      styles={{
        body: {
          padding: 0,
          height: '86vh',
          display: 'flex',
          overflow: 'hidden',
          backgroundColor: '#090d16',
        },
      }}
      destroyOnClose
    >
      <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
        {/* Khung Viewport Bản vẽ CAD */}
        <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
          <SmartDrawingViewport
            fileUrl={drawing?.fileUrl || ''}
            fileName={drawing?.fileName}
            initialPageNumber={1}
            existingObjects={mappedCvObjects}
            selectedObjectId={selectedObjectId}
            onSelectObject={(id) => setSelectedObjectId(id)}
            onSaveObject={handleSaveCvObject}
            onDeleteObject={handleDeleteCvObject}
            readOnly={!isSubmitter}
          />
        </div>

        {/* Sidebar Danh sách Cấu kiện bên phải */}
        {isSidebarOpen && (
          <div
            style={{
              width: 360,
              height: '100%',
              backgroundColor: '#1e293b',
              borderLeft: '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 10,
              color: '#f8fafc',
            }}
          >
            {/* Header Sidebar: Tiêu đề + Tìm kiếm + Filter Status */}
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid #334155',
                backgroundColor: '#0f172a',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                }}
              >
                <Space size={8}>
                  <AppstoreOutlined style={{ color: '#38bdf8', fontSize: 16 }} />
                  <Text strong style={{ color: '#f8fafc', fontSize: 14 }}>
                    Danh sách cấu kiện
                  </Text>
                </Space>
                <Tag color="#2563eb" style={{ borderRadius: 12, fontWeight: 'bold' }}>
                  {mappedCvObjects.length} cấu kiện
                </Tag>
              </div>

              <Input
                size="small"
                placeholder="Tìm theo mã hoặc tên cấu kiện..."
                prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                allowClear
                style={{
                  backgroundColor: '#1e293b',
                  borderColor: '#475569',
                  color: '#fff',
                  marginBottom: 8,
                }}
              />

              <Segmented
                size="small"
                block
                value={statusFilter}
                onChange={(val) => setStatusFilter(val as string)}
                options={[
                  { label: 'Tất cả', value: 'ALL' },
                  { label: 'Chờ duyệt', value: 'PENDING' },
                  { label: 'Đạt', value: 'PASS' },
                  { label: 'Lỗi', value: 'FAIL' },
                ]}
                style={{ backgroundColor: '#1e293b' }}
              />
            </div>

            {/* Danh sách thẻ cấu kiện (Cuộn dọc) */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {filteredObjects.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                  <InfoCircleOutlined style={{ fontSize: 32, color: '#64748b', marginBottom: 12 }} />
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {mappedCvObjects.length === 0
                      ? 'Chưa có cấu kiện nào trên bản vẽ.'
                      : 'Không tìm thấy cấu kiện phù hợp bộ lọc.'}
                  </div>
                  {isSubmitter && mappedCvObjects.length === 0 && (
                    <div style={{ fontSize: 12, color: '#38bdf8', marginTop: 8 }}>
                      💡 Bấm chuột lên bản vẽ để cắm mốc khoanh vùng cấu kiện đầu tiên.
                    </div>
                  )}
                </div>
              ) : (
                filteredObjects.map((obj) => {
                  const isSelected = obj.id === selectedObjectId;
                  const originalObj = objects.find((o) => o.id === obj.id);

                  return (
                    <div
                      key={obj.id}
                      onClick={() => setSelectedObjectId(obj.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 6,
                        backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.12)' : '#0f172a',
                        border: `1px solid ${isSelected ? '#38bdf8' : '#334155'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Dòng 1: Mã cấu kiện + Trạng thái */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Tag color="cyan" style={{ fontWeight: 700, margin: 0, fontSize: 12 }}>
                          {obj.code}
                        </Tag>
                        {obj.status === 'PASS' && <Tag color="success">Đạt nghiệm thu</Tag>}
                        {obj.status === 'FAIL' && <Tag color="error">Không đạt</Tag>}
                        {obj.status === 'IN_PROGRESS' && <Tag color="warning">Đang nghiệm thu</Tag>}
                        {obj.status === 'PENDING' && <Tag color="blue">Chờ nghiệm thu</Tag>}
                      </div>

                      {/* Dòng 2: Tên cấu kiện */}
                      <div
                        style={{
                          color: '#f1f5f9',
                          fontWeight: 600,
                          fontSize: 13,
                          marginTop: 6,
                          lineHeight: 1.3,
                        }}
                      >
                        {obj.name}
                      </div>

                      {/* Dòng 3: Metadata + Nút hành động */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: 8,
                        }}
                      >
                        <span style={{ color: '#94a3b8', fontSize: 11 }}>
                          Trang {obj.pageNumber} • {originalObj?.inspectionCount ?? 0} Form •{' '}
                          {originalObj?.checklistCount ?? 0} Checklist
                        </span>
                        <Space size={4}>
                          <Tooltip title="Định vị & Phóng to trên bản vẽ">
                            <Button
                              size="small"
                              type="text"
                              icon={<AimOutlined style={{ color: '#38bdf8' }} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedObjectId(obj.id);
                              }}
                            />
                          </Tooltip>
                          {isSubmitter && (
                            <Popconfirm
                              title="Xóa cấu kiện này?"
                              description="Biên dạng khoanh vùng sẽ bị xóa vĩnh viễn khỏi bản vẽ."
                              okText="Xóa"
                              cancelText="Hủy"
                              okButtonProps={{ danger: true }}
                              onConfirm={(e) => {
                                e?.stopPropagation();
                                handleDeleteCvObject(obj.id);
                              }}
                            >
                              <Button
                                size="small"
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </Popconfirm>
                          )}
                        </Space>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
