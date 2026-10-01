import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Space,
  Typography,
  Tag,
  Input,
  Form,
  Card,
  Empty,
  Tooltip,
  message,
  Spin,
  Alert,
} from 'antd';
import {
  FilePdfOutlined,
  CompassOutlined,
  BorderOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  SaveOutlined,
  AimOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  LeftOutlined,
  RightOutlined,
  ArrowsAltOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useAuth } from '../../contexts/AuthContext';
import { objectApi, type CreateObjectPayload } from '../../services/objectApi';
import type { DrawingFileDto } from '../../services/drawingApi';
import apiClient from '../../services/apiClient';

// Configure pdfjs worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const { Text } = Typography;

interface DrawingViewportModalProps {
  open: boolean;
  drawing: DrawingFileDto | null;
  onClose: () => void;
  onObjectCreated?: () => void;
}

interface ParsedMarker {
  x: number;
  y: number;
  width: number;
  height: number;
  containerWidth?: number;
  containerHeight?: number;
}

function parseMarkerCoords(coordsStr: string): ParsedMarker | null {
  try {
    const obj = JSON.parse(coordsStr);
    const x = Number(obj.x ?? obj.X ?? 0);
    const y = Number(obj.y ?? obj.Y ?? 0);
    const width = Number(obj.width ?? obj.Width ?? 0);
    const height = Number(obj.height ?? obj.Height ?? 0);
    if (width <= 0 || height <= 0) return null;
    return {
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

  // PDF Document & Page state
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isPdfLoading, setIsPdfLoading] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [useIframeFallback, setUseIframeFallback] = useState<boolean>(false);
  const [sheetDimensions, setSheetDimensions] = useState<{ width: number; height: number }>({ width: 1100, height: 750 });

  // Pan & Zoom state (CAD Viewport Transformation)
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number }>({
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  // Interactive drawing & selection state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [searchObjectText, setSearchObjectText] = useState('');

  // Drag-to-draw rectangle coordinates relative to the unscaled sheet
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);

  // Naming Modal State
  const [isNamingModalOpen, setIsNamingModalOpen] = useState(false);
  const [form] = Form.useForm();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const viewportSectionRef = useRef<HTMLDivElement | null>(null);

  // Load PDF file via apiClient arraybuffer
  const loadPdf = useCallback(async () => {
    if (!drawing) return;
    setPdfError(null);
    setIsPdfLoading(true);

    try {
      // apiClient already has baseURL: '/api', so strip leading '/api/' if present
      const requestUrl = drawing.fileUrl.startsWith('/api/')
        ? drawing.fileUrl.substring(4)
        : drawing.fileUrl;

      const response = await apiClient.get(requestUrl, { responseType: 'arraybuffer' });

      const loadingTask = pdfjsLib.getDocument({
        data: response.data,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/cmaps/',
        cMapPacked: true,
      });

      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
    } catch (err: any) {
      console.error('Lỗi nạp file PDF qua pdfjs:', err);
      const detail = err?.response?.status === 404
        ? 'Không tìm thấy file trên máy chủ (HTTP 404).'
        : err?.message || 'Không thể nạp dữ liệu bản vẽ.';
      setPdfError(detail);
      message.error(`Không thể kết xuất bản vẽ PDF: ${detail}`);
    } finally {
      setIsPdfLoading(false);
    }
  }, [drawing]);

  useEffect(() => {
    if (!open || !drawing) {
      setPdfDoc(null);
      setPdfError(null);
      setUseIframeFallback(false);
      return;
    }

    setCurrentPage(1);
    setZoom(1.0);
    setUseIframeFallback(false);
    loadPdf();
  }, [open, drawing, loadPdf]);

  // Center sheet in viewport when dimensions or page changes
  const centerSheet = useCallback((width: number) => {
    if (viewportSectionRef.current) {
      const containerWidth = viewportSectionRef.current.clientWidth;
      const initialPanX = Math.max(20, Math.round((containerWidth - width) / 2));
      setPan({ x: initialPanX, y: 24 });
      setZoom(1.0);
    }
  }, []);

  // Render current PDF page onto HTML5 canvas
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(currentPage);
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      // Render at a clear, high-resolution width for sharp architectural lines
      const desiredWidth = 1100;
      const scale = desiredWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setSheetDimensions({ width: viewport.width, height: viewport.height });

      const renderContext = {
        canvasContext: context,
        canvas: canvas,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      centerSheet(viewport.width);
    } catch (err: any) {
      console.warn('Lỗi render trang PDF:', err);
    }
  }, [pdfDoc, currentPage, centerSheet]);

  useEffect(() => {
    if (pdfDoc) {
      renderPage();
    }
  }, [pdfDoc, currentPage, renderPage]);

  // Query objects for this drawing
  const {
    data: objects = [],
    isLoading: isLoadingObjects,
    refetch: refetchObjects,
    isRefetching: isRefetchingObjects,
  } = useQuery({
    queryKey: ['drawing-objects', drawing?.id],
    queryFn: () => (drawing ? objectApi.getObjectsByDrawing(drawing.id) : Promise.resolve([])),
    enabled: !!drawing && open,
  });

  // Mutation to create object
  const createObjectMutation = useMutation({
    mutationFn: (payload: CreateObjectPayload) => objectApi.createObject(payload),
    onSuccess: (newObj) => {
      message.success(`Đã khoanh vùng và lưu cấu kiện "${newObj.name}" thành công!`);
      queryClient.invalidateQueries({ queryKey: ['drawing-objects', drawing?.id] });
      queryClient.invalidateQueries({ queryKey: ['submitter-drawings'] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-drawings'] });
      queryClient.invalidateQueries({ queryKey: ['approver-drawings'] });

      onObjectCreated?.();
      handleCancelDrawing();
      setIsNamingModalOpen(false);
      form.resetFields();
      setSelectedObjectId(newObj.id);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Không thể tạo Object. Vui lòng thử lại.';
      message.error(msg);
    },
  });

  // ==========================================
  // ZOOM TO CURSOR (Phóng to/thu nhỏ tại con trỏ)
  // ==========================================
  const zoomAtPoint = useCallback((clientX: number, clientY: number, factor: number) => {
    if (!viewportSectionRef.current) return;
    const containerRect = viewportSectionRef.current.getBoundingClientRect();

    const mouseX = clientX - containerRect.left;
    const mouseY = clientY - containerRect.top;

    // Unscaled point on drawing under cursor
    const pointX = (mouseX - pan.x) / zoom;
    const pointY = (mouseY - pan.y) / zoom;

    const newZoom = Math.min(4.0, Math.max(0.3, +(zoom * factor).toFixed(2)));
    const newPanX = Math.round(mouseX - pointX * newZoom);
    const newPanY = Math.round(mouseY - pointY * newZoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [pan, zoom]);

  // Wheel zoom (con lăn chuột)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    zoomAtPoint(e.clientX, e.clientY, factor);
  };

  // Double-click to zoom in at point
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawingMode) return;
    zoomAtPoint(e.clientX, e.clientY, 1.35);
  };

  // Zoom toolbar buttons
  const handleToolbarZoom = (factor: number) => {
    if (!viewportSectionRef.current) {
      setZoom((z) => Math.min(4.0, Math.max(0.3, +(z * factor).toFixed(2))));
      return;
    }
    const containerRect = viewportSectionRef.current.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    zoomAtPoint(containerRect.left + centerX, containerRect.top + centerY, factor);
  };

  const handleResetView = () => {
    centerSheet(sheetDimensions.width);
  };

  // ==========================================
  // PANNING & DRAWING MOUSE HANDLERS
  // ==========================================
  const handleViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // If middle click (wheel click) or spacebar or NOT in drawing mode: START PAN
    const isMiddleClick = e.button === 1;
    const isPanMode = !isDrawingMode || isMiddleClick;

    if (isPanMode) {
      setIsPanning(true);
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialPanX: pan.x,
        initialPanY: pan.y,
      };
      return;
    }

    // In Drawing Mode: Start drawing rectangle on sheet
    if (isDrawingMode && sheetRef.current && isSubmitter && e.button === 0) {
      const sheetRect = sheetRef.current.getBoundingClientRect();
      const x = Math.round((e.clientX - sheetRect.left) / zoom);
      const y = Math.round((e.clientY - sheetRect.top) / zoom);

      setIsDragging(true);
      setStartPos({ x, y });
      setCurrentPos({ x, y });
    }
  };

  const handleViewportMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handle Panning (Di chuyển bản vẽ sang trái, phải, lên, xuống)
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      setPan({
        x: panStartRef.current.initialPanX + dx,
        y: panStartRef.current.initialPanY + dy,
      });
      return;
    }

    // Handle Dragging rectangle
    if (isDragging && sheetRef.current) {
      const sheetRect = sheetRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(sheetDimensions.width, Math.round((e.clientX - sheetRect.left) / zoom)));
      const y = Math.max(0, Math.min(sheetDimensions.height, Math.round((e.clientY - sheetRect.top) / zoom)));
      setCurrentPos({ x, y });
    }
  };

  const handleViewportMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }

    if (isDragging && startPos && currentPos) {
      setIsDragging(false);

      const w = Math.abs(currentPos.x - startPos.x);
      const h = Math.abs(currentPos.y - startPos.y);

      if (w >= 15 && h >= 15) {
        form.setFieldsValue({
          pageNumber: currentPage,
          name: '',
        });
        setIsNamingModalOpen(true);
      } else {
        setStartPos(null);
        setCurrentPos(null);
      }
    }
  };

  const handleCancelDrawing = () => {
    setIsDragging(false);
    setStartPos(null);
    setCurrentPos(null);
    setIsDrawingMode(false);
    setIsNamingModalOpen(false);
  };

  const handleSaveObject = async () => {
    if (!drawing || !startPos || !currentPos) return;
    try {
      const values = await form.validateFields();

      const x = Math.round(Math.min(startPos.x, currentPos.x));
      const y = Math.round(Math.min(startPos.y, currentPos.y));
      const width = Math.round(Math.abs(currentPos.x - startPos.x));
      const height = Math.round(Math.abs(currentPos.y - startPos.y));

      const payload: CreateObjectPayload = {
        drawingFileId: drawing.id,
        pageNumber: values.pageNumber || currentPage,
        markerCoordinates: JSON.stringify({
          x,
          y,
          width,
          height,
          containerWidth: Math.round(sheetDimensions.width),
          containerHeight: Math.round(sheetDimensions.height),
        }),
        name: values.name.trim(),
        createdBy: user?.username || 'Submitter',
      };

      createObjectMutation.mutate(payload);
    } catch {
      // Form validation failed
    }
  };

  // Filter objects in sidebar
  const filteredObjects = objects.filter((o) =>
    o.name.toLowerCase().includes(searchObjectText.trim().toLowerCase())
  );

  // Calculate live rect during drag
  const liveRect =
    startPos && currentPos
      ? {
          left: Math.min(startPos.x, currentPos.x),
          top: Math.min(startPos.y, currentPos.y),
          width: Math.abs(currentPos.x - startPos.x),
          height: Math.abs(currentPos.y - startPos.y),
        }
      : null;

  return (
    <>
      <Modal
        title={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingRight: 24,
              userSelect: 'none',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {/* Left: Info */}
            <Space align="center" size={12}>
              <FilePdfOutlined style={{ color: '#1677FF', fontSize: 22 }} />
              <div>
                <Text strong style={{ fontSize: 16 }}>
                  Viewport Bản Vẽ: {drawing?.fileName}
                </Text>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                  <Tag color={isSubmitter ? 'blue' : user?.role === 'Reviewer' ? 'orange' : 'green'}>
                    {user?.role ? `${user.role.toUpperCase()} WORKSPACE` : 'VIEWPORT'}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {objects.length} cấu kiện đã xác lập
                  </Text>
                </div>
              </div>
            </Space>

            {/* Right: Controls Toolbar */}
            <Space size={10} wrap>
              {/* Page Navigator */}
              {totalPages > 1 && (
                <Space.Compact size="middle">
                  <Button
                    icon={<LeftOutlined />}
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  />
                  <Button style={{ pointerEvents: 'none', fontWeight: 600 }}>
                    Trang {currentPage} / {totalPages}
                  </Button>
                  <Button
                    icon={<RightOutlined />}
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  />
                </Space.Compact>
              )}

              {/* Zoom Controls */}
              <Space.Compact size="middle">
                <Button icon={<ZoomOutOutlined />} onClick={() => handleToolbarZoom(0.85)} title="Thu nhỏ" />
                <Button onClick={handleResetView} style={{ minWidth: 64, fontWeight: 500 }} title="Reset về 100% căn giữa">
                  {Math.round(zoom * 100)}%
                </Button>
                <Button icon={<ZoomInOutlined />} onClick={() => handleToolbarZoom(1.15)} title="Phóng to" />
              </Space.Compact>

              {/* Mode Switcher: Pan vs Marker (Submitter) */}
              {isSubmitter ? (
                <Space.Compact size="middle">
                  <Button
                    type={!isDrawingMode ? 'primary' : 'default'}
                    icon={<ArrowsAltOutlined />}
                    onClick={() => setIsDrawingMode(false)}
                    style={{ fontWeight: 500 }}
                  >
                    Di chuyển (Pan)
                  </Button>
                  <Button
                    type={isDrawingMode ? 'primary' : 'default'}
                    icon={<AimOutlined />}
                    danger={isDrawingMode}
                    onClick={() => {
                      setIsDrawingMode(!isDrawingMode);
                      setStartPos(null);
                      setCurrentPos(null);
                    }}
                    style={{
                      fontWeight: 600,
                      boxShadow: isDrawingMode ? '0 0 10px rgba(22, 119, 255, 0.4)' : undefined,
                    }}
                  >
                    {isDrawingMode ? 'Đang vẽ Marker' : 'Khoanh vùng (Marker)'}
                  </Button>
                </Space.Compact>
              ) : (
                <Button icon={<ArrowsAltOutlined />} type="primary" ghost>
                  Chế độ di chuyển (Pan)
                </Button>
              )}

              <Button
                icon={<ReloadOutlined spin={isRefetchingObjects} />}
                onClick={() => refetchObjects()}
              >
                Làm mới
              </Button>
            </Space>
          </div>
        }
        open={open}
        onCancel={() => {
          handleCancelDrawing();
          onClose();
        }}
        footer={null}
        width="95vw"
        style={{ top: 15 }}
        styles={{
          body: {
            padding: 0,
            height: '84vh',
            display: 'flex',
            overflow: 'hidden',
            backgroundColor: '#1E1E1E',
          },
        }}
      >
        {/* SIDEBAR TRÁI: DANH SÁCH OBJECT ĐÃ TẠO */}
        <aside
          style={{
            width: 360,
            minWidth: 320,
            maxWidth: 380,
            backgroundColor: '#FFFFFF',
            borderRight: '1px solid #E5E7EB',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            zIndex: 10,
          }}
        >
          {/* Header Sidebar */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F0F0F0', backgroundColor: '#FAFCFF' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CompassOutlined style={{ color: '#1677FF', fontSize: 18 }} />
                <Text strong style={{ fontSize: 15, color: '#1F2937' }}>
                  Danh sách Cấu kiện
                </Text>
              </div>
              <Tag color="blue" style={{ borderRadius: 12, fontWeight: 600 }}>
                {objects.length} Object
              </Tag>
            </div>

            {/* Submitter Quick Action Button */}
            {isSubmitter && (
              <Button
                type="primary"
                block
                icon={<PlusOutlined />}
                onClick={() => {
                  setIsDrawingMode(true);
                  setStartPos(null);
                  setCurrentPos(null);
                  message.info('Kéo chuột trên bản vẽ để khoanh vùng cấu kiện mới!');
                }}
                style={{
                  height: 36,
                  fontWeight: 600,
                  backgroundColor: '#1677FF',
                }}
              >
                + Khoanh vùng Object mới
              </Button>
            )}

            {/* Navigation & Zoom Quick Tip */}
            <div style={{ marginTop: 8, fontSize: 11, color: '#8C8C8C', lineHeight: '16px' }}>
              💡 <b>Thao tác:</b> Lăn chuột để zoom tại vị trí trỏ chuột. Giữ chuột trái kéo để di chuyển bản vẽ sang trái/phải/lên/xuống.
            </div>

            {/* Instruction Banner when Drawing */}
            {isDrawingMode && (
              <Alert
                message="Đang bật chế độ vẽ"
                description="Nhấn giữ chuột trái và kéo một khung chữ nhật trực tiếp trên bản vẽ."
                type="info"
                showIcon
                style={{ marginTop: 8, padding: '6px 10px' }}
              />
            )}
          </div>

          {/* Search box */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #F0F0F0', backgroundColor: '#FFFFFF' }}>
            <Input
              placeholder="Tìm kiếm tên cấu kiện..."
              prefix={<SearchOutlined style={{ color: '#BFBFBF' }} />}
              value={searchObjectText}
              onChange={(e) => setSearchObjectText(e.target.value)}
              allowClear
              size="middle"
            />
          </div>

          {/* Object List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {isLoadingObjects ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Spin tip="Đang tải danh sách cấu kiện..." />
              </div>
            ) : filteredObjects.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <Empty
                  description={
                    <div>
                      <Text type="secondary">Chưa có cấu kiện Object nào được tạo.</Text>
                      {isSubmitter && (
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Hãy bấm nút <b>"+ Khoanh vùng Object mới"</b> ở trên để tạo cấu kiện đầu tiên trên bản vẽ này.
                          </Text>
                        </div>
                      )}
                    </div>
                  }
                />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredObjects.map((obj) => {
                  const isSelected = selectedObjectId === obj.id;
                  const coords = parseMarkerCoords(obj.markerCoordinates);

                  return (
                    <Card
                      key={obj.id}
                      size="small"
                      hoverable
                      onClick={() => {
                        const newSelect = isSelected ? null : obj.id;
                        setSelectedObjectId(newSelect);

                        // If object belongs to another page, switch to that page automatically
                        if (obj.pageNumber && obj.pageNumber !== currentPage) {
                          setCurrentPage(obj.pageNumber);
                        }

                        // Center view on the selected marker
                        if (coords && viewportSectionRef.current) {
                          const containerRect = viewportSectionRef.current.getBoundingClientRect();
                          const targetCenterX = coords.x + coords.width / 2;
                          const targetCenterY = coords.y + coords.height / 2;
                          const newPanX = Math.round(containerRect.width / 2 - targetCenterX * zoom);
                          const newPanY = Math.round(containerRect.height / 2 - targetCenterY * zoom);
                          setPan({ x: newPanX, y: newPanY });
                        }
                      }}
                      style={{
                        borderRadius: 6,
                        border: isSelected ? '1.5px solid #1677FF' : '1px solid #E5E7EB',
                        backgroundColor: isSelected ? '#F0F7FF' : '#FFFFFF',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                      }}
                      styles={{ body: { padding: 12 } }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Space align="center" size={6}>
                          <BorderOutlined style={{ color: '#1677FF', fontSize: 16 }} />
                          <Text strong style={{ color: '#1F2937', fontSize: 14 }}>
                            {obj.name}
                          </Text>
                        </Space>
                        <Tag style={{ fontSize: 11, marginRight: 0 }}>P.{obj.pageNumber || 1}</Tag>
                      </div>

                      {/* Metadata / Inspection Status */}
                      <div
                        style={{
                          marginTop: 8,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderTop: '1px dashed #F0F0F0',
                          paddingTop: 6,
                        }}
                      >
                        {obj.inspectionCount > 0 ? (
                          <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: 11 }}>
                            {obj.inspectionCount} Đợt nghiệm thu
                          </Tag>
                        ) : (
                          <Tag color="warning" icon={<WarningOutlined />} style={{ fontSize: 11 }}>
                            Chưa có đơn nghiệm thu
                          </Tag>
                        )}
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {obj.createdBy || 'Submitter'}
                        </Text>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* KHUNG BẢN VẼ CHÍNH: CAD/PDF CANVAS VỚI TỌA ĐỘ VÀ MARKER GẮN CHẶT */}
        <section
          ref={viewportSectionRef}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleViewportMouseDown}
          onMouseMove={handleViewportMouseMove}
          onMouseUp={handleViewportMouseUp}
          onMouseLeave={() => {
            if (isPanning) setIsPanning(false);
          }}
          style={{
            flex: 1,
            position: 'relative',
            height: '100%',
            backgroundColor: '#2A2D32',
            overflow: 'hidden',
            cursor: isDrawingMode ? 'crosshair' : isPanning ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
        >
          {useIframeFallback && drawing ? (
            /* IFRAME FALLBACK VIEW */
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <iframe
                src={`${drawing.fileUrl}#toolbar=1&navpanes=0`}
                title={drawing.fileName}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              />
            </div>
          ) : isPdfLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#FFFFFF' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, fontSize: 14, fontWeight: 500 }}>
                Đang kết xuất bản vẽ kỹ thuật PDF...
              </div>
            </div>
          ) : pdfError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#FFFFFF', padding: 24 }}>
              <Alert
                type="error"
                message="Không thể kết xuất bản vẽ CAD/PDF"
                description={
                  <div>
                    <div>{pdfError}</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#595959' }}>
                      Máy chủ có thể chưa khởi động hoặc file đang bị bận. Bạn có thể bấm Thử lại hoặc chuyển sang Chế độ Iframe.
                    </div>
                  </div>
                }
                showIcon
                style={{ maxWidth: 480, marginBottom: 16, textAlign: 'left', borderRadius: 8 }}
              />
              <Space size={12}>
                <Button type="primary" icon={<ReloadOutlined />} onClick={() => loadPdf()}>
                  Thử lại
                </Button>
                <Button onClick={() => setUseIframeFallback(true)}>
                  Mở chế độ xem Iframe
                </Button>
              </Space>
            </div>
          ) : (
            /* UNIFIED BLUEPRINT SHEET: Canvas & Markers share identical coordinates and scale together! */
            <div
              ref={sheetRef}
              style={{
                width: sheetDimensions.width,
                height: sheetDimensions.height,
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55)',
                transition: isPanning || isDragging ? 'none' : 'transform 0.08s ease-out',
                pointerEvents: 'auto',
              }}
            >
              {/* HTML5 Canvas for PDF Render */}
              <canvas
                ref={canvasRef}
                style={{
                  display: 'block',
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              />

              {/* OVERLAY LAYER FOR SAVED MARKERS & LIVE DRAWING */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              >
                {/* SAVED MARKERS (Only show for current page) */}
                {objects
                  .filter((o) => (o.pageNumber || 1) === currentPage)
                  .map((obj) => {
                    const coords = parseMarkerCoords(obj.markerCoordinates);
                    if (!coords) return null;

                    const isSelected = selectedObjectId === obj.id;

                    // Scale proportionally to current sheet width & height
                    let scaleX = 1;
                    let scaleY = 1;
                    if (coords.containerWidth && sheetDimensions.width > 0) {
                      scaleX = sheetDimensions.width / coords.containerWidth;
                      scaleY = sheetDimensions.height / (coords.containerHeight || sheetDimensions.height);
                    }

                    const markerLeft = coords.x * scaleX;
                    const markerTop = coords.y * scaleY;
                    const markerWidth = coords.width * scaleX;
                    const markerHeight = coords.height * scaleY;

                    return (
                      <Tooltip
                        key={obj.id}
                        title={
                          <div>
                            <b>{obj.name}</b>
                            <div>Người tạo: {obj.createdBy}</div>
                            <div>Trang: {obj.pageNumber || 1}</div>
                            <div>Đợt nghiệm thu: {obj.inspectionCount}</div>
                          </div>
                        }
                      >
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedObjectId(isSelected ? null : obj.id);
                          }}
                          style={{
                            position: 'absolute',
                            left: markerLeft,
                            top: markerTop,
                            width: markerWidth,
                            height: markerHeight,
                            border: isSelected ? '2.5px solid #FAAD14' : '2px solid #1677FF',
                            backgroundColor: isSelected
                              ? 'rgba(250, 173, 20, 0.28)'
                              : 'rgba(22, 119, 255, 0.16)',
                            borderRadius: 2,
                            pointerEvents: 'auto',
                            cursor: 'pointer',
                            zIndex: isSelected ? 20 : 5,
                            boxShadow: isSelected ? '0 0 12px rgba(250, 173, 20, 0.8)' : undefined,
                            transition: 'border 0.2s, background-color 0.2s',
                          }}
                        >
                          {/* Label tag permanently anchored to top edge of marker */}
                          <div
                            style={{
                              position: 'absolute',
                              top: -24,
                              left: 0,
                              backgroundColor: isSelected ? '#FAAD14' : '#1677FF',
                              color: '#FFFFFF',
                              padding: '2px 8px',
                              borderRadius: 3,
                              fontSize: 11,
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <BorderOutlined style={{ fontSize: 10 }} />
                            <span>{obj.name}</span>
                          </div>
                        </div>
                      </Tooltip>
                    );
                  })}

                {/* LIVE DRAWING RECTANGLE (while dragging) */}
                {isDragging && liveRect && (
                  <div
                    style={{
                      position: 'absolute',
                      left: liveRect.left,
                      top: liveRect.top,
                      width: liveRect.width,
                      height: liveRect.height,
                      border: '2px dashed #1677FF',
                      backgroundColor: 'rgba(22, 119, 255, 0.22)',
                      borderRadius: 2,
                      pointerEvents: 'none',
                      zIndex: 30,
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </section>
      </Modal>

      {/* MODAL ĐẶT TÊN VÀ LƯU OBJECT MỚI */}
      <Modal
        title={
          <Space>
            <CompassOutlined style={{ color: '#1677FF', fontSize: 18 }} />
            <Text strong style={{ fontSize: 16 }}>
              Đặt tên Cấu kiện Object mới
            </Text>
          </Space>
        }
        open={isNamingModalOpen}
        onCancel={() => {
          setIsNamingModalOpen(false);
          setStartPos(null);
          setCurrentPos(null);
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button
              onClick={() => {
                setIsNamingModalOpen(false);
                setStartPos(null);
                setCurrentPos(null);
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={createObjectMutation.isPending}
              onClick={handleSaveObject}
              style={{ backgroundColor: '#1677FF' }}
            >
              Lưu Object
            </Button>
          </div>
        }
        width={460}
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          {/* Coordinates Info Box */}
          {liveRect && (
            <div
              style={{
                backgroundColor: '#F0F7FF',
                border: '1px solid #B3D8FF',
                borderRadius: 6,
                padding: '10px 14px',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ color: '#1677FF', fontSize: 13 }}>
                  Vị trí trích xuất bản vẽ
                </Text>
                <Tag color="blue">Trang {currentPage}</Tag>
              </div>
            </div>
          )}

          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label={
                <Text strong>
                  Tên Cấu kiện (Object) <span style={{ color: '#FF4D4F' }}>*</span>
                </Text>
              }
              rules={[
                { required: true, message: 'Vui lòng nhập tên cấu kiện!' },
                { max: 200, message: 'Tên cấu kiện không được vượt quá 200 ký tự!' },
              ]}
              extra="Ví dụ: Cột C12 - Trục A, Dầm D5 - Tầng 3, Sàn S2..."
            >
              <Input
                placeholder="Nhập tên cấu kiện kỹ thuật..."
                autoFocus
                size="large"
              />
            </Form.Item>

            <Form.Item name="pageNumber" label="Số trang bản vẽ" initialValue={currentPage}>
              <Input type="number" min={1} style={{ width: 140 }} />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </>
  );
};
