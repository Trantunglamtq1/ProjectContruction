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
  Segmented,
  Popconfirm,
} from 'antd';
import {
  FilePdfOutlined,
  CompassOutlined,
  BorderOutlined,
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
  NodeIndexOutlined,
  CheckOutlined,
  UndoOutlined,
  CloseOutlined,
  ThunderboltOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as pdfjsLib from 'pdfjs-dist';
import { useAuth } from '../../contexts/AuthContext';
import { objectApi, type CreateObjectPayload } from '../../services/objectApi';
import type { DrawingFileDto } from '../../services/drawingApi';
import apiClient from '../../services/apiClient';

// Khởi tạo Worker ES Module tương thích 100% với Vite và trình duyệt hiện đại
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(
      new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
      { type: 'module' }
    );
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
} else {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

const { Text } = Typography;

interface DrawingViewportModalProps {
  open: boolean;
  drawing: DrawingFileDto | null;
  onClose: () => void;
  onObjectCreated?: () => void;
}

export interface Point {
  x: number;
  y: number;
}

export interface ParsedMarker {
  type?: 'rect' | 'polygon';
  points?: Point[];
  cornerRadius?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  containerWidth?: number;
  containerHeight?: number;
}

/**
 * Tự động làm vuông góc các cạnh đa giác (Orthogonalize / Squaring):
 * Nắn các cạnh có góc nghiêng gần nằm ngang hoặc thẳng đứng thành góc 90° chuẩn kỹ thuật.
 */
export function autoSquarePolygon(points: Point[], snapThreshold = 14): Point[] {
  if (points.length < 3) return points;
  const result: Point[] = [{ ...points[0] }];

  for (let i = 1; i < points.length; i++) {
    const prev = result[i - 1];
    const curr = { ...points[i] };

    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);

    // Gần thẳng đứng (dx nhỏ hơn ngưỡng) -> nắn x thẳng hàng
    if (dx <= snapThreshold && dy >= dx) {
      curr.x = prev.x;
    }
    // Gần nằm ngang (dy nhỏ hơn ngưỡng) -> nắn y thẳng hàng
    else if (dy <= snapThreshold && dx > dy) {
      curr.y = prev.y;
    }

    result.push(curr);
  }

  // Khép kín cạnh cuối về điểm đầu tiên nếu gần vuông
  if (result.length >= 4) {
    const first = result[0];
    const last = result[result.length - 1];
    const dx = Math.abs(last.x - first.x);
    const dy = Math.abs(last.y - first.y);

    if (dx <= snapThreshold && dy >= dx) {
      last.x = first.x;
    } else if (dy <= snapThreshold && dx > dy) {
      last.y = first.y;
    }
  }

  return result;
}

/**
 * Bắt dính vuông góc 90° so với điểm liền trước (Ortho Snapping)
 */
export function snapOrtho(
  prev: Point,
  current: Point,
  forceOrtho = false,
  threshold = 12
): { point: Point; isSnapped: boolean } {
  const dx = Math.abs(current.x - prev.x);
  const dy = Math.abs(current.y - prev.y);

  if (forceOrtho) {
    if (dx >= dy) {
      return { point: { x: current.x, y: prev.y }, isSnapped: true };
    } else {
      return { point: { x: prev.x, y: current.y }, isSnapped: true };
    }
  }

  if (dy <= threshold && dx > threshold) {
    return { point: { x: current.x, y: prev.y }, isSnapped: true };
  }
  if (dx <= threshold && dy > threshold) {
    return { point: { x: prev.x, y: current.y }, isSnapped: true };
  }

  return { point: current, isSnapped: false };
}

/**
 * Tạo đường dẫn SVG Path bo tròn góc mềm mại (Corner Fillet / Rounding)
 */
export function getRoundedPolygonPath(points: Point[], radius: number): string {
  if (points.length < 3) return '';
  if (radius <= 0) {
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') + ' Z';
  }

  const n = points.length;
  let d = '';

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const v1 = { x: prev.x - curr.x, y: prev.y - curr.y };
    const v2 = { x: next.x - curr.x, y: next.y - curr.y };

    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);

    if (len1 === 0 || len2 === 0) continue;

    const u1 = { x: v1.x / len1, y: v1.y / len1 };
    const u2 = { x: v2.x / len2, y: v2.y / len2 };

    const r = Math.min(radius, len1 / 2.2, len2 / 2.2);

    const startPt = { x: curr.x + u1.x * r, y: curr.y + u1.y * r };
    const endPt = { x: curr.x + u2.x * r, y: curr.y + u2.y * r };

    if (i === 0) {
      d += `M ${startPt.x} ${startPt.y} `;
    } else {
      d += `L ${startPt.x} ${startPt.y} `;
    }

    d += `Q ${curr.x} ${curr.y} ${endPt.x} ${endPt.y} `;
  }

  d += 'Z';
  return d;
}

export function parseMarkerCoords(coordsStr: string): ParsedMarker | null {
  try {
    const obj = JSON.parse(coordsStr);
    let points: Point[] | undefined = undefined;

    if (Array.isArray(obj.points) && obj.points.length >= 3) {
      points = obj.points.map((p: any) => ({
        x: Number(p.x ?? p.X ?? 0),
        y: Number(p.y ?? p.Y ?? 0),
      }));
    }

    const type = (obj.type === 'polygon' || (points && points.length >= 3)) ? 'polygon' : 'rect';

    let x = Number(obj.x ?? obj.X ?? 0);
    let y = Number(obj.y ?? obj.Y ?? 0);
    let width = Number(obj.width ?? obj.Width ?? 0);
    let height = Number(obj.height ?? obj.Height ?? 0);

    // Nếu là đa giác mà chưa có x, y, width, height thì tính bounding box từ các đỉnh
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
      type,
      points,
      cornerRadius: obj.cornerRadius != null ? Number(obj.cornerRadius) : undefined,
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
  const [drawShape, setDrawShape] = useState<'polygon' | 'rect'>('polygon');
  const [isOrthoMode, setIsOrthoMode] = useState<boolean>(false);
  const [isShiftDown, setIsShiftDown] = useState<boolean>(false);
  const [activeCornerRadius, setActiveCornerRadius] = useState<number>(0); // 0 (vuông 90°), 6 (bo tròn), 12 (bo lớn)
  const [isSnappedOrtho, setIsSnappedOrtho] = useState<boolean>(false);

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [searchObjectText, setSearchObjectText] = useState('');

  // Polygon Drawing state (Fit góc cạnh)
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [liveCursorPos, setLiveCursorPos] = useState<Point | null>(null);
  const [hoveredStartPoint, setHoveredStartPoint] = useState<boolean>(false);

  // Rectangle Drawing state (Khung chữ nhật)
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState<Point | null>(null);
  const [currentPos, setCurrentPos] = useState<Point | null>(null);

  // Naming & Saving Modal state
  const [isNamingModalOpen, setIsNamingModalOpen] = useState(false);
  const [pendingShape, setPendingShape] = useState<{
    type: 'polygon' | 'rect';
    points?: Point[];
    cornerRadius?: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const [form] = Form.useForm();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const viewportSectionRef = useRef<HTMLDivElement | null>(null);

  // Helper to convert Screen Mouse Event to unscaled Sheet coordinates
  const getSheetCoords = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!sheetRef.current) return null;
      const sheetRect = sheetRef.current.getBoundingClientRect();
      const rawX = (clientX - sheetRect.left) / zoom;
      const rawY = (clientY - sheetRect.top) / zoom;
      return {
        x: Math.max(0, Math.min(sheetDimensions.width, Math.round(rawX))),
        y: Math.max(0, Math.min(sheetDimensions.height, Math.round(rawY))),
      };
    },
    [zoom, sheetDimensions]
  );

  // Load PDF file via apiClient arraybuffer
  const loadPdf = useCallback(async () => {
    if (!drawing) return;
    setPdfError(null);
    setIsPdfLoading(true);

    try {
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
      const detail =
        err?.response?.status === 404
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
      message.success(`Đã xác lập cấu kiện "${newObj.name}" thành công!`);
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

  // Mutation to delete object (Xóa nhãn để vẽ lại)
  const deleteObjectMutation = useMutation({
    mutationFn: (objectId: string) => objectApi.deleteObject(objectId),
    onSuccess: () => {
      message.success('Đã xóa gán nhãn cấu kiện thành công! Bạn có thể vẽ lại cấu kiện mới.');
      queryClient.invalidateQueries({ queryKey: ['drawing-objects', drawing?.id] });
      queryClient.invalidateQueries({ queryKey: ['submitter-drawings'] });
      queryClient.invalidateQueries({ queryKey: ['reviewer-drawings'] });
      queryClient.invalidateQueries({ queryKey: ['approver-drawings'] });
      setSelectedObjectId(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Không thể xóa cấu kiện. Vui lòng thử lại.';
      message.error(msg);
    },
  });

  // ==========================================
  // ZOOM TO CURSOR (Phóng to/thu nhỏ tại con trỏ)
  // ==========================================
  const zoomAtPoint = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      if (!viewportSectionRef.current) return;
      const containerRect = viewportSectionRef.current.getBoundingClientRect();

      const mouseX = clientX - containerRect.left;
      const mouseY = clientY - containerRect.top;

      const pointX = (mouseX - pan.x) / zoom;
      const pointY = (mouseY - pan.y) / zoom;

      const newZoom = Math.min(4.0, Math.max(0.3, +(zoom * factor).toFixed(2)));
      const newPanX = Math.round(mouseX - pointX * newZoom);
      const newPanY = Math.round(mouseY - pointY * newZoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    },
    [pan, zoom]
  );

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    zoomAtPoint(e.clientX, e.clientY, factor);
  };

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
  // FINISH / UNDO / CANCEL POLYGON
  // ==========================================
  const finishPolygonDrawing = useCallback((points = polygonPoints) => {
    if (points.length < 3) {
      message.warning('Đa giác cần ít nhất 3 điểm góc cạnh để tạo hình bao khép kín.');
      return;
    }

    // Tự động nắn vuông góc nếu đang bật Ortho mode
    const finalPoints = isOrthoMode ? autoSquarePolygon(points) : points;

    const xs = finalPoints.map((p) => p.x);
    const ys = finalPoints.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    setPendingShape({
      type: 'polygon',
      points: [...finalPoints],
      cornerRadius: activeCornerRadius,
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    });

    form.setFieldsValue({
      pageNumber: currentPage,
      name: '',
      cornerRadius: activeCornerRadius,
    });
    setIsNamingModalOpen(true);
  }, [polygonPoints, currentPage, form, isOrthoMode, activeCornerRadius]);

  const handleUndoLastPoint = () => {
    setPolygonPoints((prev) => {
      if (prev.length <= 1) {
        setLiveCursorPos(null);
        setHoveredStartPoint(false);
        return [];
      }
      return prev.slice(0, -1);
    });
  };

  const handleCancelDrawing = useCallback(() => {
    setIsDragging(false);
    setStartPos(null);
    setCurrentPos(null);
    setPolygonPoints([]);
    setLiveCursorPos(null);
    setHoveredStartPoint(false);
    setIsSnappedOrtho(false);
    setPendingShape(null);
    setIsDrawingMode(false);
    setIsNamingModalOpen(false);
  }, []);

  // Keyboard shortcut listener for Polygon drawing & Shift Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftDown(true);
      }

      if (!isDrawingMode && !isNamingModalOpen) {
        if (selectedObjectId && isSubmitter && e.key === 'Delete') {
          const objToDelete = objects.find((o) => o.id === selectedObjectId);
          if (objToDelete) {
            e.preventDefault();
            Modal.confirm({
              title: 'Xóa gán nhãn cấu kiện này?',
              content: `Bạn có chắc muốn xóa cấu kiện "${objToDelete.name}" để vẽ lại không?`,
              okText: 'Xóa nhãn',
              okType: 'danger',
              cancelText: 'Hủy',
              onOk: () => deleteObjectMutation.mutate(objToDelete.id),
            });
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelDrawing();
      } else if (e.key === 'Enter') {
        if (drawShape === 'polygon' && polygonPoints.length >= 3) {
          e.preventDefault();
          finishPolygonDrawing();
        }
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (drawShape === 'polygon' && polygonPoints.length > 0) {
          e.preventDefault();
          handleUndoLastPoint();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftDown(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    isDrawingMode,
    isNamingModalOpen,
    drawShape,
    polygonPoints,
    finishPolygonDrawing,
    handleCancelDrawing,
    selectedObjectId,
    isSubmitter,
    objects,
    deleteObjectMutation,
  ]);

  // ==========================================
  // PANNING & DRAWING MOUSE HANDLERS
  // ==========================================
  const handleViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const isMiddleClick = e.button === 1;
    const isPanAction = !isDrawingMode || isMiddleClick;

    if (isPanAction) {
      setIsPanning(true);
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialPanX: pan.x,
        initialPanY: pan.y,
      };
      return;
    }

    // In Drawing Mode with Left Button
    if (isDrawingMode && isSubmitter && e.button === 0) {
      const coords = getSheetCoords(e.clientX, e.clientY);
      if (!coords) return;

      if (drawShape === 'polygon') {
        // Nếu đang trỏ gần điểm đầu tiên và đã có >= 3 điểm -> Đóng đa giác!
        if (hoveredStartPoint && polygonPoints.length >= 3) {
          finishPolygonDrawing();
          return;
        }

        const effectiveOrtho = isOrthoMode || isShiftDown || e.shiftKey;
        const prevPt = polygonPoints.length > 0 ? polygonPoints[polygonPoints.length - 1] : null;
        const ptToAdd = prevPt ? snapOrtho(prevPt, coords, effectiveOrtho).point : coords;

        // Thêm điểm đỉnh mới vào danh sách góc cạnh
        setPolygonPoints((prev) => [...prev, ptToAdd]);
        return;
      }

      if (drawShape === 'rect') {
        setIsDragging(true);
        setStartPos(coords);
        setCurrentPos(coords);
      }
    }
  };

  const handleViewportMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // Handle Panning
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      setPan({
        x: panStartRef.current.initialPanX + dx,
        y: panStartRef.current.initialPanY + dy,
      });
      return;
    }

    const coords = getSheetCoords(e.clientX, e.clientY);
    if (!coords) return;

    // Handle Polygon live cursor & snap detection
    if (isDrawingMode && drawShape === 'polygon') {
      const effectiveOrtho = isOrthoMode || isShiftDown || e.shiftKey;

      if (polygonPoints.length > 0) {
        const prevPt = polygonPoints[polygonPoints.length - 1];
        const { point: snappedPt, isSnapped } = snapOrtho(prevPt, coords, effectiveOrtho);
        setLiveCursorPos(snappedPt);
        setIsSnappedOrtho(isSnapped);
      } else {
        setLiveCursorPos(coords);
        setIsSnappedOrtho(false);
      }

      if (polygonPoints.length >= 3) {
        const p0 = polygonPoints[0];
        const distToStart = Math.hypot(coords.x - p0.x, coords.y - p0.y);
        const snapThreshold = Math.max(14, 20 / zoom);
        setHoveredStartPoint(distToStart <= snapThreshold);
      } else {
        setHoveredStartPoint(false);
      }
      return;
    }

    // Handle Dragging rectangle
    if (isDragging && drawShape === 'rect') {
      setCurrentPos(coords);
    }
  };

  const handleViewportMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }

    if (isDragging && startPos && currentPos && drawShape === 'rect') {
      setIsDragging(false);

      const w = Math.abs(currentPos.x - startPos.x);
      const h = Math.abs(currentPos.y - startPos.y);

      if (w >= 15 && h >= 15) {
        const minX = Math.min(startPos.x, currentPos.x);
        const minY = Math.min(startPos.y, currentPos.y);

        setPendingShape({
          type: 'rect',
          cornerRadius: activeCornerRadius,
          x: minX,
          y: minY,
          width: w,
          height: h,
        });

        form.setFieldsValue({
          pageNumber: currentPage,
          name: '',
          cornerRadius: activeCornerRadius,
        });
        setIsNamingModalOpen(true);
      } else {
        setStartPos(null);
        setCurrentPos(null);
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDrawingMode && drawShape === 'polygon' && polygonPoints.length >= 3) {
      e.stopPropagation();
      finishPolygonDrawing();
      return;
    }

    if (!isDrawingMode) {
      zoomAtPoint(e.clientX, e.clientY, 1.35);
    }
  };

  // Save Object
  const handleSaveObject = async () => {
    if (!drawing || !pendingShape) return;
    try {
      const values = await form.validateFields();

      const payload: CreateObjectPayload = {
        drawingFileId: drawing.id,
        pageNumber: values.pageNumber || currentPage,
        markerCoordinates: JSON.stringify({
          type: pendingShape.type,
          points: pendingShape.points,
          cornerRadius: values.cornerRadius ?? pendingShape.cornerRadius ?? activeCornerRadius,
          x: Math.round(pendingShape.x),
          y: Math.round(pendingShape.y),
          width: Math.round(pendingShape.width),
          height: Math.round(pendingShape.height),
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

  // Live rect preview during drag
  const liveRect =
    startPos && currentPos && drawShape === 'rect'
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
                <Space size={8}>
                  <Space.Compact size="middle">
                    <Button
                      type={!isDrawingMode ? 'primary' : 'default'}
                      icon={<ArrowsAltOutlined />}
                      onClick={() => {
                        setIsDrawingMode(false);
                        setPolygonPoints([]);
                        setStartPos(null);
                        setCurrentPos(null);
                      }}
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
                        setPolygonPoints([]);
                        setStartPos(null);
                        setCurrentPos(null);
                      }}
                      style={{
                        fontWeight: 600,
                        boxShadow: isDrawingMode ? '0 0 10px rgba(22, 119, 255, 0.4)' : undefined,
                      }}
                    >
                      {isDrawingMode ? 'Đang bật gán nhãn' : 'Gán nhãn (Marker)'}
                    </Button>
                  </Space.Compact>

                  {/* Tool selector: Polygon (Fit góc cạnh) vs Rectangle */}
                  {isDrawingMode && (
                    <Segmented
                      size="middle"
                      value={drawShape}
                      onChange={(val) => {
                        setDrawShape(val as 'polygon' | 'rect');
                        setPolygonPoints([]);
                        setStartPos(null);
                        setCurrentPos(null);
                      }}
                      options={[
                        {
                          label: '📐 Fit góc (Đa giác)',
                          value: 'polygon',
                          icon: <NodeIndexOutlined />,
                        },
                        {
                          label: '🔲 Chữ nhật',
                          value: 'rect',
                          icon: <BorderOutlined />,
                        },
                      ]}
                    />
                  )}
                </Space>
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
        width="96vw"
        style={{ top: 12 }}
        styles={{
          body: {
            padding: 0,
            height: '85vh',
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

            {/* Submitter Quick Action Buttons */}
            {isSubmitter && (
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <Button
                  type="primary"
                  block
                  icon={<NodeIndexOutlined />}
                  onClick={() => {
                    setIsDrawingMode(true);
                    setDrawShape('polygon');
                    setPolygonPoints([]);
                    setStartPos(null);
                    setCurrentPos(null);
                    message.info('Nhấp chuột từng điểm xung quanh các góc cạnh của vật thể để gán nhãn!');
                  }}
                  style={{
                    height: 36,
                    fontWeight: 600,
                    backgroundColor: '#1677FF',
                  }}
                >
                  + Gán nhãn Fit từng góc cạnh (Đa giác)
                </Button>
              </Space>
            )}

            {/* Navigation & Zoom Quick Tip */}
            <div style={{ marginTop: 8, fontSize: 11, color: '#8C8C8C', lineHeight: '16px' }}>
              💡 <b>Thao tác:</b> Giữ phím <b>Shift</b> để khóa vuông góc 90°. Lăn chuột để zoom. Giữ chuột giữa để Pan bản vẽ.
            </div>

            {/* Instruction Banner when Drawing */}
            {isDrawingMode && (
              <Alert
                message={
                  drawShape === 'polygon'
                    ? 'Chế độ Đa giác (Fit góc cạnh)'
                    : 'Chế độ Khung chữ nhật'
                }
                description={
                  drawShape === 'polygon'
                    ? 'Bấm các góc cạnh của vật thể. Có thể bấm "Nắn vuông góc" hoặc bật "Bo tròn" trên thanh công cụ phía trên.'
                    : 'Nhấn giữ chuột trái và kéo một khung chữ nhật trên bản vẽ.'
                }
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
                            Hãy bấm nút <b>"+ Gán nhãn Fit từng góc cạnh"</b> ở trên để tạo cấu kiện đầu tiên.
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
                      onMouseEnter={() => setHoveredObjectId(obj.id)}
                      onMouseLeave={() => setHoveredObjectId(null)}
                      onClick={() => {
                        const newSelect = isSelected ? null : obj.id;
                        setSelectedObjectId(newSelect);

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
                          {coords?.type === 'polygon' ? (
                            <NodeIndexOutlined style={{ color: '#1677FF', fontSize: 16 }} />
                          ) : (
                            <BorderOutlined style={{ color: '#1677FF', fontSize: 16 }} />
                          )}
                          <Text strong style={{ color: '#1F2937', fontSize: 14 }}>
                            {obj.name}
                          </Text>
                        </Space>
                        <Space size={4}>
                          <Tag style={{ fontSize: 11, marginRight: 0 }}>P.{obj.pageNumber || 1}</Tag>
                          {isSubmitter && (
                            <Popconfirm
                              title="Xóa gán nhãn cấu kiện này?"
                              description={`Bạn có chắc muốn xóa "${obj.name}" để gán nhãn lại không?`}
                              onConfirm={(e) => {
                                e?.stopPropagation();
                                deleteObjectMutation.mutate(obj.id);
                              }}
                              onCancel={(e) => e?.stopPropagation()}
                              okText="Xóa nhãn"
                              cancelText="Hủy"
                              okButtonProps={{ danger: true, loading: deleteObjectMutation.isPending }}
                            >
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={(e) => e.stopPropagation()}
                                title="Xóa nhãn này để vẽ lại"
                                style={{ padding: '0 4px', height: 22 }}
                              />
                            </Popconfirm>
                          )}
                        </Space>
                      </div>

                      {/* Shape type badge */}
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                        {coords?.type === 'polygon' ? (
                          <Tag color="cyan" style={{ fontSize: 11 }}>
                            📐 Đa giác ({coords.points?.length || 0} góc)
                            {coords.cornerRadius ? ` • Bo ${coords.cornerRadius}px` : ' • Vuông'}
                          </Tag>
                        ) : (
                          <Tag style={{ fontSize: 11 }}>
                            🔲 Chữ nhật {coords?.cornerRadius ? ` • Bo ${coords.cornerRadius}px` : ''}
                          </Tag>
                        )}
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

        {/* KHUNG BẢN VẼ CHÍNH: CAD/PDF CANVAS VỚI SVG OVERLAY GÁN NHÃN FIT TỪNG GÓC CẠNH */}
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
          {/* FLOATING ACTION TOOLBAR TRONG KHI VẼ ĐA GIÁC: HỖ TRỢ LÀM VUÔNG GÓC & BO TRÒN */}
          {isDrawingMode && drawShape === 'polygon' && (
            <div
              style={{
                position: 'absolute',
                top: 14,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 60,
                backgroundColor: 'rgba(17, 24, 39, 0.94)',
                backdropFilter: 'blur(10px)',
                padding: '6px 14px',
                borderRadius: 24,
                border: '1px solid #374151',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#FFFFFF',
                flexWrap: 'wrap',
                maxWidth: '92vw',
              }}
            >
              <Space size={6} align="center">
                <NodeIndexOutlined style={{ color: '#38BDF8', fontSize: 15 }} />
                <span style={{ fontSize: 12, fontWeight: 500 }}>
                  {polygonPoints.length === 0
                    ? 'Nhấp chuột trên bản vẽ để bắt đầu'
                    : `Đã chấm ${polygonPoints.length} góc`}
                </span>
                {isSnappedOrtho && (
                  <Tag color="green" style={{ margin: 0, padding: '0 4px', fontSize: 10 }}>
                    📐 90°
                  </Tag>
                )}
                {hoveredStartPoint && polygonPoints.length >= 3 && (
                  <Tag color="success" style={{ margin: 0 }}>
                    Khép kín!
                  </Tag>
                )}
              </Space>

              <div style={{ height: 16, width: 1, backgroundColor: '#4B5563' }} />

              {/* Tùy chọn làm vuông góc (Ortho) */}
              <Space size={4}>
                <Button
                  size="small"
                  type={isOrthoMode || isShiftDown ? 'primary' : 'default'}
                  onClick={() => setIsOrthoMode(!isOrthoMode)}
                  style={{
                    backgroundColor: isOrthoMode || isShiftDown ? '#1677FF' : undefined,
                    fontSize: 11,
                  }}
                  title="Khóa vẽ theo phương vuông góc 90° ngang/dọc (hoặc giữ Shift)"
                >
                  📐 Khóa 90° (Ortho)
                </Button>

                <Button
                  size="small"
                  icon={<ThunderboltOutlined />}
                  disabled={polygonPoints.length < 3}
                  onClick={() => {
                    const squared = autoSquarePolygon(polygonPoints);
                    setPolygonPoints(squared);
                    message.success('Đã tự động nắn các cạnh thành góc vuông 90° chuẩn!');
                  }}
                  style={{ fontSize: 11 }}
                  title="Tự động nắn các cạnh gần ngang/dọc thành góc 90° chuẩn kỹ thuật"
                >
                  ⚡ Nắn vuông
                </Button>
              </Space>

              <div style={{ height: 16, width: 1, backgroundColor: '#4B5563' }} />

              {/* Tùy chọn bo tròn góc (Corner Fillet) */}
              <Segmented
                size="small"
                value={activeCornerRadius}
                onChange={(val) => setActiveCornerRadius(val as number)}
                options={[
                  { label: '📐 Vuông', value: 0 },
                  { label: '⭕ Bo nhẹ (6px)', value: 6 },
                  { label: '🟣 Bo lớn (12px)', value: 12 },
                ]}
              />

              <div style={{ height: 16, width: 1, backgroundColor: '#4B5563' }} />

              {/* Thao tác Hoàn tất / Hoàn tác / Hủy */}
              <Space size={4}>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  disabled={polygonPoints.length < 3}
                  onClick={() => finishPolygonDrawing()}
                  style={{
                    backgroundColor: polygonPoints.length >= 3 ? '#52C41A' : undefined,
                    fontWeight: 600,
                    fontSize: 11,
                  }}
                >
                  Hoàn tất (Enter)
                </Button>
                <Button
                  size="small"
                  icon={<UndoOutlined />}
                  disabled={polygonPoints.length === 0}
                  onClick={handleUndoLastPoint}
                  title="Xóa góc vừa chấm (Backspace)"
                  style={{ fontSize: 11 }}
                >
                  Hoàn tác
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={handleCancelDrawing}
                  title="Hủy vẽ (Esc)"
                  style={{ fontSize: 11 }}
                />
              </Space>
            </div>
          )}

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

              {/* SVG LAYER FOR PRECISION CAD POLYGONS, VERTICES, AND REAL-TIME LINES */}
              <svg
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  overflow: 'visible',
                  zIndex: 10,
                  mixBlendMode: 'multiply',
                }}
              >
                <defs>
                  <filter id="marker-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#FAAD14" floodOpacity="0.6" />
                  </filter>
                  <filter id="marker-hover-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#1677FF" floodOpacity="0.4" />
                  </filter>
                </defs>

                {/* SAVED OBJECTS (Polygons & Rectangles) */}
                {objects
                  .filter((o) => (o.pageNumber || 1) === currentPage)
                  .map((obj) => {
                    const coords = parseMarkerCoords(obj.markerCoordinates);
                    if (!coords) return null;

                    const isSelected = selectedObjectId === obj.id;
                    const isHovered = hoveredObjectId === obj.id;

                    let scaleX = 1;
                    let scaleY = 1;
                    if (coords.containerWidth && sheetDimensions.width > 0) {
                      scaleX = sheetDimensions.width / coords.containerWidth;
                      scaleY = sheetDimensions.height / (coords.containerHeight || sheetDimensions.height);
                    }

                    const cornerRadius = (coords.cornerRadius || 0) * scaleX;

                    if (coords.type === 'polygon' && coords.points && coords.points.length >= 3) {
                      const scaledPoints = coords.points.map((p) => ({
                        x: p.x * scaleX,
                        y: p.y * scaleY,
                      }));
                      const pathD = getRoundedPolygonPath(scaledPoints, cornerRadius);

                      return (
                        <g
                          key={`svg-poly-${obj.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedObjectId(isSelected ? null : obj.id);
                          }}
                          onMouseEnter={() => setHoveredObjectId(obj.id)}
                          onMouseLeave={() => setHoveredObjectId(null)}
                          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                        >
                          {/* Đa giác fit theo các góc cạnh (Hỗ trợ làm vuông góc hoặc bo tròn góc) */}
                          <path
                            d={pathD}
                            fill={
                              isSelected
                                ? 'rgba(250, 173, 20, 0.22)'
                                : isHovered
                                ? 'rgba(22, 119, 255, 0.12)'
                                : 'rgba(22, 119, 255, 0.05)'
                            }
                            stroke={
                              isSelected
                                ? 'rgba(250, 173, 20, 0.85)'
                                : isHovered
                                ? 'rgba(22, 119, 255, 0.75)'
                                : 'rgba(22, 119, 255, 0.32)'
                            }
                            strokeWidth={isSelected ? 2 : 1.2}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            filter={isSelected ? 'url(#marker-glow)' : isHovered ? 'url(#marker-hover-glow)' : undefined}
                          />
                        </g>
                      );
                    } else {
                      // Fallback Rectangle Marker - Nét viền mờ thanh mảnh (Hỗ trợ bo tròn góc rx)
                      const markerLeft = coords.x * scaleX;
                      const markerTop = coords.y * scaleY;
                      const markerWidth = coords.width * scaleX;
                      const markerHeight = coords.height * scaleY;

                      return (
                        <g
                          key={`svg-rect-${obj.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedObjectId(isSelected ? null : obj.id);
                          }}
                          onMouseEnter={() => setHoveredObjectId(obj.id)}
                          onMouseLeave={() => setHoveredObjectId(null)}
                          style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                        >
                          <rect
                            x={markerLeft}
                            y={markerTop}
                            width={markerWidth}
                            height={markerHeight}
                            rx={cornerRadius > 0 ? cornerRadius : 0}
                            fill={
                              isSelected
                                ? 'rgba(250, 173, 20, 0.22)'
                                : isHovered
                                ? 'rgba(22, 119, 255, 0.12)'
                                : 'rgba(22, 119, 255, 0.05)'
                            }
                            stroke={
                              isSelected
                                ? 'rgba(250, 173, 20, 0.85)'
                                : isHovered
                                ? 'rgba(22, 119, 255, 0.75)'
                                : 'rgba(22, 119, 255, 0.32)'
                            }
                            strokeWidth={isSelected ? 2 : 1.2}
                            filter={isSelected ? 'url(#marker-glow)' : isHovered ? 'url(#marker-hover-glow)' : undefined}
                          />
                        </g>
                      );
                    }
                  })}

                {/* LIVE POLYGON DRAWING IN REAL TIME */}
                {isDrawingMode && drawShape === 'polygon' && polygonPoints.length > 0 && (
                  <g>
                    {/* Vùng mờ preview bên trong khi đã có >= 3 điểm */}
                    {polygonPoints.length >= 3 && (
                      <path
                        d={getRoundedPolygonPath(polygonPoints, activeCornerRadius)}
                        fill="rgba(22, 119, 255, 0.08)"
                        stroke="none"
                      />
                    )}

                    {/* Đường nối giữa các đỉnh đã chấm */}
                    {activeCornerRadius > 0 && polygonPoints.length >= 3 ? (
                      <path
                        d={getRoundedPolygonPath(polygonPoints, activeCornerRadius)}
                        fill="none"
                        stroke="rgba(22, 119, 255, 0.65)"
                        strokeWidth={1.5}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    ) : (
                      <polyline
                        points={polygonPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="rgba(22, 119, 255, 0.65)"
                        strokeWidth={1.5}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Dây thun (Rubber band) nối từ đỉnh cuối đến trỏ chuột */}
                    {liveCursorPos && (
                      <line
                        x1={polygonPoints[polygonPoints.length - 1].x}
                        y1={polygonPoints[polygonPoints.length - 1].y}
                        x2={hoveredStartPoint ? polygonPoints[0].x : liveCursorPos.x}
                        y2={hoveredStartPoint ? polygonPoints[0].y : liveCursorPos.y}
                        stroke={hoveredStartPoint ? '#52C41A' : isSnappedOrtho ? '#52C41A' : 'rgba(22, 119, 255, 0.5)'}
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                      />
                    )}

                    {/* Chỉ báo góc vuông 90° khi bắt dính */}
                    {isSnappedOrtho && liveCursorPos && (
                      <text
                        x={liveCursorPos.x + 8}
                        y={liveCursorPos.y + 14}
                        fill="#52C41A"
                        fontSize={11}
                        fontWeight="bold"
                        style={{ userSelect: 'none' }}
                      >
                        📐 90°
                      </text>
                    )}

                    {/* Đỉnh góc khi vẽ: chấm nhỏ thanh mảnh, không che khuất chi tiết bản vẽ */}
                    {polygonPoints.map((pt, idx) => {
                      const isFirst = idx === 0;
                      return (
                        <g key={`live-pt-${idx}`}>
                          {isFirst && hoveredStartPoint ? (
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={8}
                              fill="rgba(82, 196, 26, 0.25)"
                              stroke="#52C41A"
                              strokeWidth={1.5}
                            />
                          ) : (
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={2}
                              fill={isFirst ? '#FAAD14' : '#1677FF'}
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}
              </svg>

              {/* HTML OVERLAY LAYER FOR LABELS AND TOOLTIPS */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 20,
                }}
              >
                {/* LABELS FOR SAVED MARKERS */}
                {objects
                  .filter((o) => (o.pageNumber || 1) === currentPage)
                  .map((obj) => {
                    const coords = parseMarkerCoords(obj.markerCoordinates);
                    if (!coords) return null;

                    const isSelected = selectedObjectId === obj.id;
                    const isHovered = hoveredObjectId === obj.id;

                    let scaleX = 1;
                    let scaleY = 1;
                    if (coords.containerWidth && sheetDimensions.width > 0) {
                      scaleX = sheetDimensions.width / coords.containerWidth;
                      scaleY = sheetDimensions.height / (coords.containerHeight || sheetDimensions.height);
                    }

                    let anchorX = coords.x * scaleX;
                    let anchorY = coords.y * scaleY;

                    if (coords.type === 'polygon' && coords.points && coords.points.length >= 3) {
                      anchorX = Math.min(...coords.points.map((p) => p.x * scaleX));
                      anchorY = Math.min(...coords.points.map((p) => p.y * scaleY));
                    }

                    return (
                      <Tooltip
                        key={`label-${obj.id}`}
                        title={
                          <div>
                            <b>{obj.name}</b>
                            <div>
                              Loại gán nhãn:{' '}
                              {coords.type === 'polygon'
                                ? `Đa giác (${coords.points?.length || 0} góc cạnh)`
                                : 'Khung chữ nhật'}
                            </div>
                            <div>
                              Kiểu góc:{' '}
                              {coords.cornerRadius ? `Bo tròn ${coords.cornerRadius}px` : 'Vuông góc 90°'}
                            </div>
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
                          onMouseEnter={() => setHoveredObjectId(obj.id)}
                          onMouseLeave={() => setHoveredObjectId(null)}
                          style={{
                            position: 'absolute',
                            left: anchorX,
                            top: anchorY - 22,
                            backgroundColor: isSelected ? '#FAAD14' : isHovered ? '#1677FF' : 'rgba(22, 119, 255, 0.82)',
                            opacity: isSelected || isHovered ? 1 : 0.85,
                            color: '#FFFFFF',
                            padding: '1px 7px',
                            borderRadius: 3,
                            fontSize: 10.5,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            cursor: 'pointer',
                            pointerEvents: 'auto',
                            zIndex: isSelected ? 30 : 20,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {coords.type === 'polygon' ? (
                            <NodeIndexOutlined style={{ fontSize: 11 }} />
                          ) : (
                            <BorderOutlined style={{ fontSize: 10 }} />
                          )}
                          <span>{obj.name}</span>
                          {isSelected && isSubmitter && (
                            <Popconfirm
                              title="Xóa nhãn này để vẽ lại?"
                              description={`Bạn có chắc muốn xóa "${obj.name}"?`}
                              onConfirm={(e) => {
                                e?.stopPropagation();
                                deleteObjectMutation.mutate(obj.id);
                              }}
                              onCancel={(e) => e?.stopPropagation()}
                              okText="Xóa nhãn"
                              cancelText="Hủy"
                              okButtonProps={{ danger: true, size: 'small', loading: deleteObjectMutation.isPending }}
                            >
                              <span
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  marginLeft: 6,
                                  padding: '1px 5px',
                                  borderRadius: 2,
                                  backgroundColor: '#FF4D4F',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  lineHeight: 1,
                                }}
                                title="Xóa nhãn này để vẽ lại"
                              >
                                <DeleteOutlined style={{ fontSize: 10, color: '#FFFFFF' }} />
                              </span>
                            </Popconfirm>
                          )}
                        </div>
                      </Tooltip>
                    );
                  })}

                {/* LIVE DRAWING RECTANGLE (while dragging in rect mode) */}
                {isDragging && liveRect && drawShape === 'rect' && (
                  <div
                    style={{
                      position: 'absolute',
                      left: liveRect.left,
                      top: liveRect.top,
                      width: liveRect.width,
                      height: liveRect.height,
                      border: '1.5px dashed rgba(22, 119, 255, 0.6)',
                      backgroundColor: 'rgba(22, 119, 255, 0.08)',
                      borderRadius: activeCornerRadius > 0 ? activeCornerRadius : 2,
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
            {pendingShape?.type === 'polygon' ? (
              <NodeIndexOutlined style={{ color: '#1677FF', fontSize: 18 }} />
            ) : (
              <BorderOutlined style={{ color: '#1677FF', fontSize: 18 }} />
            )}
            <Text strong style={{ fontSize: 16 }}>
              {pendingShape?.type === 'polygon'
                ? 'Lưu Cấu kiện Đa giác (Fit góc cạnh)'
                : 'Lưu Cấu kiện Khung chữ nhật'}
            </Text>
          </Space>
        }
        open={isNamingModalOpen}
        onCancel={() => {
          setIsNamingModalOpen(false);
          setPendingShape(null);
          setPolygonPoints([]);
          setStartPos(null);
          setCurrentPos(null);
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button
              onClick={() => {
                setIsNamingModalOpen(false);
                setPendingShape(null);
                setPolygonPoints([]);
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
        width={480}
        destroyOnClose
      >
        <div style={{ padding: '8px 0' }}>
          {/* Coordinates Info Box */}
          {pendingShape && (
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
                <Space>
                  {pendingShape.type === 'polygon' ? (
                    <Tag color="cyan">
                      📐 Đa giác: {pendingShape.points?.length || 0} góc
                      {pendingShape.cornerRadius ? ` (Bo tròn ${pendingShape.cornerRadius}px)` : ' (Vuông góc)'}
                    </Tag>
                  ) : (
                    <Tag color="blue">
                      🔲 Chữ nhật: {Math.round(pendingShape.width)} × {Math.round(pendingShape.height)} px
                      {pendingShape.cornerRadius ? ` (Bo tròn ${pendingShape.cornerRadius}px)` : ''}
                    </Tag>
                  )}
                </Space>
                <Tag color="geekblue">Trang {currentPage}</Tag>
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
              extra="Ví dụ: Cột vách C12 - Trục A, Dầm chữ L D5 - Tầng 3, Móng đơn M1..."
            >
              <Input
                placeholder="Nhập tên cấu kiện kỹ thuật..."
                autoFocus
                size="large"
              />
            </Form.Item>

            {/* Tùy chọn kiểu dáng góc cạnh (Vuông góc hoặc Bo tròn) */}
            <Form.Item
              name="cornerRadius"
              label={<Text strong>Kiểu dáng góc cạnh</Text>}
              initialValue={pendingShape?.cornerRadius ?? activeCornerRadius}
            >
              <Segmented
                block
                options={[
                  { label: '📐 Vuông góc chuẩn (90°)', value: 0 },
                  { label: '⭕ Bo tròn nhẹ (6px)', value: 6 },
                  { label: '🟣 Bo tròn lớn (12px)', value: 12 },
                ]}
                onChange={(val) => {
                  setPendingShape((prev) => (prev ? { ...prev, cornerRadius: val as number } : null));
                }}
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
