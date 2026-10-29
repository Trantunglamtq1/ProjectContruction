import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Space,
  Typography,
  Tag,
  Button,
  Input,
  Segmented,
  Tooltip,
  Popconfirm,
  message,
  Spin,
  Alert,
} from 'antd';
import {
  ArrowLeftOutlined,
  SearchOutlined,
  AppstoreOutlined,
  AimOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  CheckSquareOutlined,
  RightOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { drawingApi } from '../../services/drawingApi';
import { objectApi, type CreateObjectPayload } from '../../services/objectApi';
import { SmartDrawingViewport } from '../../components/viewport/SmartDrawingViewport';
import { ObjectChecklistsModal } from '../../components/checklists/ObjectChecklistsModal';
import { parseMarkerCoords } from '../../components/viewport/DrawingViewportModal';
import type { Point, SavedObjectData } from '../../components/viewport/cv/types';
import { pointsToSmoothSvgPath } from '../../components/viewport/cv/curveFitting';

const { Text } = Typography;

export const DrawingViewportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const currentRole = ((Array.isArray(user?.role) ? user?.role[0] : user?.role) as string) || '';
  const isSubmitter = currentRole === 'Submitter';

  // State sidebar danh sách cấu kiện & tìm kiếm/lọc
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // State Modal quản lý Checklist của Cấu kiện
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [activeChecklistObject, setActiveChecklistObject] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);

  // Điều hướng quay lại danh sách bản vẽ theo Role
  const handleBack = () => {
    if (isSubmitter) {
      navigate('/submitter/drawings');
    } else if (currentRole === 'Reviewer') {
      navigate('/reviewer/drawings');
    } else if (currentRole === 'Approver') {
      navigate('/approver/drawings');
    } else {
      navigate(-1);
    }
  };

  // 1. Query thông tin chi tiết bản vẽ kỹ thuật
  const {
    data: drawing,
    isLoading: isDrawingLoading,
    isError: isDrawingError,
  } = useQuery({
    queryKey: ['drawing-detail', id],
    queryFn: () => (id ? drawingApi.getDrawingById(id) : Promise.reject('Không có mã bản vẽ')),
    enabled: !!id,
  });

  // 2. Query danh sách cấu kiện (Objects) thuộc bản vẽ
  const { data: objects = [] } = useQuery({
    queryKey: ['drawing-objects', id],
    queryFn: () => (id ? objectApi.getObjectsByDrawing(id) : Promise.resolve([])),
    enabled: !!id,
  });

  // 3. Mutation tạo cấu kiện mới trên bản vẽ
  const createObjectMutation = useMutation({
    mutationFn: (payload: CreateObjectPayload) => objectApi.createObject(payload),
    onSuccess: (newObj) => {
      message.success(`Đã lưu cấu kiện "${newObj.name}" thành công!`);
      queryClient.invalidateQueries({ queryKey: ['drawing-objects', id] });
      queryClient.invalidateQueries({ queryKey: ['drawing-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['submitter-drawings'] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-drawings'] });
      queryClient.invalidateQueries({ queryKey: ['approver-drawings'] });
      setSelectedObjectId(newObj.id);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Không thể tạo cấu kiện.';
      message.error(msg);
    },
  });

  // 4. Mutation xóa cấu kiện
  const deleteObjectMutation = useMutation({
    mutationFn: (objectId: string) => objectApi.deleteObject(objectId),
    onSuccess: () => {
      message.success('Đã xóa cấu kiện thành công!');
      if (selectedObjectId) {
        setSelectedObjectId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['drawing-objects', id] });
      queryClient.invalidateQueries({ queryKey: ['drawing-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['submitter-drawings'] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-drawings'] });
      queryClient.invalidateQueries({ queryKey: ['approver-drawings'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Không thể xóa cấu kiện.';
      message.error(msg);
    },
  });

  // Chuyển đổi objects từ CSDL sang cấu trúc hiển thị cho SmartDrawingViewport
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
        status: 'PENDING',
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

  // Trạng thái đang tải dữ liệu bản vẽ
  if (isDrawingLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          gap: 16,
        }}
      >
        <Spin size="large" />
        <Text style={{ color: '#94a3b8', fontSize: 15 }}>Đang tải không gian bản vẽ Viewport...</Text>
      </div>
    );
  }

  // Trạng thái lỗi không tìm thấy bản vẽ
  if (isDrawingError || !drawing) {
    return (
      <div
        style={{
          padding: 48,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: '#0f172a',
        }}
      >
        <Alert
          message="Không tìm thấy bản vẽ kỹ thuật"
          description="Bản vẽ không tồn tại trên hệ thống hoặc bạn không có quyền truy cập."
          type="error"
          showIcon
          style={{ maxWidth: 500, width: '100%', marginBottom: 20 }}
        />
        <Button type="primary" icon={<ArrowLeftOutlined />} onClick={handleBack}>
          Quay lại danh sách bản vẽ
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#0f172a',
      }}
    >
      {/* KHÔNG GIAN BẢN VẼ VIEWPORT CHÍNH */}
      <div style={{ flex: 1, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <SmartDrawingViewport
          fileUrl={drawing.fileUrl}
          fileName={drawing.fileName}
          initialPageNumber={1}
          existingObjects={mappedCvObjects}
          selectedObjectId={selectedObjectId}
          onSelectObject={(id) => setSelectedObjectId(id)}
          onSaveObject={handleSaveCvObject}
          onDeleteObject={handleDeleteCvObject}
          readOnly={!isSubmitter}
          headerLeft={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Button
                type="text"
                size="small"
                icon={<ArrowLeftOutlined />}
                onClick={handleBack}
                style={{
                  color: '#94a3b8',
                  fontWeight: 600,
                  fontSize: 12,
                  padding: '2px 8px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                Quay lại
              </Button>
              <div
                style={{
                  width: 1,
                  height: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                }}
              />
              <Tag
                color={isSubmitter ? 'blue' : currentRole === 'Reviewer' ? 'orange' : 'green'}
                style={{ margin: 0, fontWeight: 600, fontSize: 11 }}
              >
                {currentRole ? `${currentRole.toUpperCase()} WORKSPACE` : 'VIEWPORT'}
              </Tag>
            </div>
          }
          headerRight={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div
                style={{
                  width: 1,
                  height: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  margin: '0 4px',
                }}
              />
              <Button
                size="small"
                type={isSidebarOpen ? 'primary' : 'default'}
                ghost={isSidebarOpen}
                icon={isSidebarOpen ? <RightOutlined /> : <UnorderedListOutlined />}
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                style={{ fontWeight: 500, fontSize: 12 }}
              >
                {isSidebarOpen ? 'Ẩn danh sách' : `Cấu kiện (${mappedCvObjects.length})`}
              </Button>
            </div>
          }
        />
      </div>

      {/* SIDEBAR DANH SÁCH CẤU KIỆN (BÊN PHẢI) */}
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
            flexShrink: 0,
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
                        <Tooltip title="Checklist & Biểu mẫu Form.io">
                          <Button
                            size="small"
                            type="text"
                            icon={<CheckSquareOutlined style={{ color: '#10b981' }} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveChecklistObject({
                                id: obj.id,
                                name: obj.name,
                                code: obj.code || '',
                              });
                              setChecklistModalOpen(true);
                            }}
                          />
                        </Tooltip>
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

      {/* Modal quản lý Checklist & Form.io của Cấu kiện */}
      {activeChecklistObject && (
        <ObjectChecklistsModal
          open={checklistModalOpen}
          objectId={activeChecklistObject.id}
          objectName={activeChecklistObject.name}
          objectCode={activeChecklistObject.code}
          onClose={() => {
            setChecklistModalOpen(false);
            setActiveChecklistObject(null);
            queryClient.invalidateQueries({ queryKey: ['drawing-objects', id] });
          }}
        />
      )}
    </div>
  );
};

export default DrawingViewportPage;

