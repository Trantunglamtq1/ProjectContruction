import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Space,
  Typography,
  Tag,
  Input,
  Form,
  Modal,
  Tooltip,
  message,
  Spin,
  Alert,
  Badge,
} from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ArrowsAltOutlined,
  UndoOutlined,
  CloseOutlined,
  CheckOutlined,
  LeftOutlined,
  RightOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import * as pdfjsLib from 'pdfjs-dist';
import apiClient from '../../services/apiClient';

// Cấu hình Polyfill cho các môi trường duyệt web hiện đại (TC39 Uint8Array proposal & Promise.withResolvers)
if (typeof window !== 'undefined') {
  if (typeof Uint8Array !== 'undefined') {
    if (!(Uint8Array.prototype as any).toHex) {
      (Uint8Array.prototype as any).toHex = function () {
        let hex = '';
        for (let i = 0; i < this.length; i++) {
          hex += this[i].toString(16).padStart(2, '0');
        }
        return hex;
      };
    }
    if (!(Uint8Array as any).fromBase64) {
      (Uint8Array as any).fromBase64 = function (b64: string) {
        const bin = typeof atob !== 'undefined' ? atob(b64) : '';
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          arr[i] = bin.charCodeAt(i);
        }
        return arr;
      };
    }
  }
  if (typeof Promise !== 'undefined' && !(Promise as any).withResolvers) {
    (Promise as any).withResolvers = function () {
      let resolve: any, reject: any;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }

  // Cấu hình Worker cho PDF.js nội bộ không phụ thuộc CDN bên ngoài
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
}

import type { Point, PointRole, SavedObjectData } from './cv/types';
import {
  buildAutoArcSvgPath,
  snapToRightAngle,
} from './cv/autoArc';

const { Text } = Typography;

export interface SmartDrawingViewportProps {
  // Đường dẫn tệp PDF hoặc ảnh độ phân giải cao
  fileUrl: string;
  fileName?: string;
  initialPageNumber?: number;
  // Danh sách các Object đã khoanh vùng trước đó
  existingObjects?: SavedObjectData[];
  // ID đối tượng đang được chọn (để highlight và định vị)
  selectedObjectId?: string | null;
  onSelectObject?: (objectId: string | null) => void;
  // Callback khi tạo mới hoặc cập nhật một Object
  onSaveObject?: (objectData: SavedObjectData) => Promise<void> | void;
  // Callback khi xóa một Object
  onDeleteObject?: (objectId: string) => Promise<void> | void;
  readOnly?: boolean;
}

export const SmartDrawingViewport: React.FC<SmartDrawingViewportProps> = ({
  fileUrl,
  fileName = 'Bản vẽ kỹ thuật',
  initialPageNumber = 1,
  existingObjects = [],
  selectedObjectId: externalSelectedId = null,
  onSelectObject,
  onSaveObject,
  onDeleteObject,
  readOnly = false,
}) => {
  // 1. PDF Document, Image & Page States
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPageNumber);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [isSharpening, setIsSharpening] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [isImageFormat, setIsImageFormat] = useState<boolean>(false);
  const imageElementRef = useRef<HTMLImageElement | null>(null);

  // Kích thước gốc của trang bản vẽ (CSS points / Image pixels)
  const [sheetSize, setSheetSize] = useState<{ width: number; height: number }>({
    width: 1200,
    height: 800,
  });

  // 2. Pan & Zoom States (20% đến 1000%)
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);
  const isPanDragRef = useRef<boolean>(false);
  const isPanGestureRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; initialPanX: number; initialPanY: number }>({
    x: 0,
    y: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  // Debounced Viewport Clipping Render (100ms)
  const debounceTimerRef = useRef<any>(null);

  // 3. Progressive 3-Point Auto-Arc Drawing State
  const isDrawingMode = !readOnly;
  const [committedVertices, setCommittedVertices] = useState<Point[]>([]);
  const [cursorSheetPos, setCursorSheetPos] = useState<Point | null>(null);
  const [isNearStartPoint, setIsNearStartPoint] = useState<boolean>(false);

  // 4. Tinh chỉnh đỉnh sau khi khép kín hình
  const [completedPoints, setCompletedPoints] = useState<Point[] | null>(null);
  const [completedSvgPath, setCompletedSvgPath] = useState<string | null>(null);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);

  // 5. Modal đặt tên và lưu Object
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);

  const activeSelectedId = externalSelectedId ?? internalSelectedId;

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sheetContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentRenderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // ==========================================
  // I. TÍNH TOÁN CĂN CHỈNH VỪA KHUNG HÌNH (FIT VIEW)
  // ==========================================
  const fitViewToContainer = useCallback((sheetW: number, sheetH: number) => {
    if (!containerRef.current || sheetW <= 0 || sheetH <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const pad = 40;
    const availW = Math.max(100, rect.width - pad);
    const availH = Math.max(100, rect.height - pad);

    const scale = Math.min(availW / sheetW, availH / sheetH);
    const clampedScale = Math.max(0.1, Math.min(scale, 1.2));

    const panX = Math.round((rect.width - sheetW * clampedScale) / 2);
    const panY = Math.round((rect.height - sheetH * clampedScale) / 2);

    setZoom(clampedScale);
    setPan({ x: Math.max(0, panX), y: Math.max(0, panY) });
  }, []);

  // Tự động căn chỉnh vừa khung hình khi kích thước container thay đổi (modal mở hoàn tất hoặc đổi kích thước)
  useEffect(() => {
    if (!containerRef.current) return;
    let initialFit = false;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0 && sheetSize.width > 0 && sheetSize.height > 0) {
          if (!initialFit) {
            initialFit = true;
            fitViewToContainer(sheetSize.width, sheetSize.height);
          }
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [sheetSize.width, sheetSize.height, fitViewToContainer]);

  // Định vị và căn giữa đối tượng khi được chọn
  useEffect(() => {
    if (activeSelectedId && existingObjects.length > 0 && containerRef.current) {
      const obj = existingObjects.find((o) => o.id === activeSelectedId);
      if (obj && obj.boundingBox) {
        const rect = containerRef.current.getBoundingClientRect();
        const objCenterX = obj.boundingBox.x + obj.boundingBox.width / 2;
        const objCenterY = obj.boundingBox.y + obj.boundingBox.height / 2;
        const targetZoom = Math.max(
          1.0,
          Math.min(2.5, 450 / Math.max(obj.boundingBox.width, obj.boundingBox.height, 100))
        );
        setZoom(targetZoom);
        setPan({
          x: Math.round(rect.width / 2 - objCenterX * targetZoom),
          y: Math.round(rect.height / 2 - objCenterY * targetZoom),
        });
      }
    }
  }, [activeSelectedId, existingObjects]);

  // ==========================================
  // II. RENDER BẢN VẼ ĐỘ PHÂN GIẢI CAO (GPU-ACCELERATED)
  // ==========================================

  // Render canvas với công nghệ Double-Buffering (Offscreen) chống chớp trắng và giật lag
  const renderCanvas = useCallback(async (customScale?: number) => {
    if (!canvasRef.current) return;

    // A. Ảnh kỹ thuật
    if (imageElementRef.current) {
      const img = imageElementRef.current;
      const sW = sheetSize.width;
      const sH = sheetSize.height;
      const dpr = window.devicePixelRatio || 1;
      const scale = customScale || Math.min(2.5, Math.max(1.0, dpr));
      const targetW = Math.round(sW * scale);
      const targetH = Math.round(sH * scale);

      const offscreen = document.createElement('canvas');
      offscreen.width = targetW;
      offscreen.height = targetH;
      const offCtx = offscreen.getContext('2d');
      if (offCtx) {
        offCtx.imageSmoothingEnabled = true;
        offCtx.imageSmoothingQuality = 'high';
        offCtx.drawImage(img, 0, 0, targetW, targetH);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = targetW;
        canvas.height = targetH;
        canvas.style.width = `${sW}px`;
        canvas.style.height = `${sH}px`;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(offscreen, 0, 0);
      }
      setIsLoadingPdf(false);
      setIsSharpening(false);
      return;
    }

    // B. Bản vẽ PDF Vector (pdfjs-dist)
    if (!pdfDoc) {
      setIsLoadingPdf(false);
      return;
    }
    try {
      if (currentRenderTaskRef.current) {
        try {
          currentRenderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        currentRenderTaskRef.current = null;
      }

      const page = await pdfDoc.getPage(currentPage);
      const sW = sheetSize.width;
      const sH = sheetSize.height;
      const maxDim = Math.max(sW, sH);

      // Tỷ lệ render tối ưu:
      // - Với CAD khổ lớn (A0/A1, maxDim >= 2500): 1.0 đã là 3370x2384 (~8 triệu pixel, siêu nét)
      // - Với tài liệu nhỏ hơn (A4, maxDim < 1500): 1.5 - 2.0 để nét mịn
      // - Giới hạn kích thước canvas không vượt quá 4096px để tránh tràn VRAM GPU
      let optimalScale = customScale;
      if (!optimalScale) {
        optimalScale = maxDim >= 2500 ? 1.0 : maxDim >= 1500 ? 1.5 : 2.0;
      }
      if (maxDim * optimalScale > 4096) {
        optimalScale = 4096 / maxDim;
      }

      const viewport = page.getViewport({ scale: optimalScale });
      const targetW = Math.max(1, Math.round(viewport.width));
      const targetH = Math.max(1, Math.round(viewport.height));

      // Kỹ thuật Double-Buffering: Vẽ trước vào Offscreen Canvas
      // Đảm bảo Canvas hiển thị không bao giờ bị trắng hoặc mất nét trong khi render
      const offscreen = document.createElement('canvas');
      offscreen.width = targetW;
      offscreen.height = targetH;
      const offCtx = offscreen.getContext('2d', { alpha: false });
      if (!offCtx) {
        setIsLoadingPdf(false);
        return;
      }

      offCtx.fillStyle = '#ffffff';
      offCtx.fillRect(0, 0, targetW, targetH);

      const task = page.render({
        canvas: offscreen,
        canvasContext: offCtx,
        viewport: viewport,
      });
      currentRenderTaskRef.current = task;
      await task.promise;
      currentRenderTaskRef.current = null;

      // Render hoàn tất: Chép tức thời sang canvas chính trên màn hình trong 1 frame
      if (canvasRef.current) {
        const visibleCanvas = canvasRef.current;
        visibleCanvas.width = targetW;
        visibleCanvas.height = targetH;
        visibleCanvas.style.width = `${sW}px`;
        visibleCanvas.style.height = `${sH}px`;
        const visibleCtx = visibleCanvas.getContext('2d');
        visibleCtx?.drawImage(offscreen, 0, 0);
      }

      setIsLoadingPdf(false);
      setIsSharpening(false);
    } catch (err: any) {
      currentRenderTaskRef.current = null;
      if (err?.name !== 'RenderingCancelledException') {
        console.warn('Lỗi render Canvas:', err);
        setPdfError(err?.message || 'Lỗi khi dựng bản vẽ lên canvas.');
        setIsLoadingPdf(false);
        setIsSharpening(false);
      }
    }
  }, [pdfDoc, currentPage, sheetSize]);

  // Tải Document với Token xác thực
  useEffect(() => {
    let isCancelled = false;
    let createdBlobUrl: string | null = null;

    if (!fileUrl) {
      setIsLoadingPdf(false);
      setPdfError('Chưa nhận được đường dẫn tệp bản vẽ.');
      return;
    }

    setIsLoadingPdf(true);
    setPdfError(null);
    setCommittedVertices([]);
    setCompletedPoints(null);
    setCompletedSvgPath(null);

    const loadDocumentData = async () => {
      try {
        let arrayBuffer: ArrayBuffer;
        let contentType = '';

        if (fileUrl.startsWith('data:') || fileUrl.startsWith('blob:')) {
          const res = await fetch(fileUrl);
          arrayBuffer = await res.arrayBuffer();
          contentType = (res.headers.get('content-type') || '').toLowerCase();
        } else {
          const endpoint = fileUrl.startsWith('/api/') ? fileUrl.substring(4) : fileUrl;
          try {
            const res = await apiClient.get(endpoint, {
              responseType: 'arraybuffer',
            });
            if (res.data instanceof ArrayBuffer) {
              arrayBuffer = res.data;
            } else if (res.data?.buffer instanceof ArrayBuffer) {
              arrayBuffer = res.data.buffer;
            } else {
              throw new Error('Dữ liệu tải về không hợp lệ');
            }
            contentType = String(res.headers['content-type'] || '').toLowerCase();
          } catch {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const targetUrl = fileUrl.startsWith('http')
              ? fileUrl
              : `${window.location.origin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
            const res = await fetch(targetUrl, { headers });
            if (!res.ok) {
              throw new Error(`Không thể tải tệp bản vẽ từ máy chủ (HTTP ${res.status})`);
            }
            arrayBuffer = await res.arrayBuffer();
            contentType = (res.headers.get('content-type') || '').toLowerCase();
          }
        }

        if (isCancelled) return;

        // Kiểm tra xem phản hồi có phải là HTML báo lỗi từ SPA fallback không
        if (arrayBuffer.byteLength >= 15) {
          const headerPrefix = new TextDecoder('ascii').decode(new Uint8Array(arrayBuffer, 0, Math.min(64, arrayBuffer.byteLength))).toLowerCase();
          if (headerPrefix.includes('<!doctype') || headerPrefix.includes('<html')) {
            throw new Error('Không tìm thấy tệp bản vẽ trên hệ thống lưu trữ (máy chủ trả về trang HTML).');
          }
        }

        // Nhận diện tệp PDF qua Magic Bytes '%PDF' hoặc Content-Type/Extension
        const isPdf =
          (arrayBuffer.byteLength >= 4 &&
            new Uint8Array(arrayBuffer, 0, 4)[0] === 0x25 &&
            new Uint8Array(arrayBuffer, 0, 4)[1] === 0x50 &&
            new Uint8Array(arrayBuffer, 0, 4)[2] === 0x44 &&
            new Uint8Array(arrayBuffer, 0, 4)[3] === 0x46) ||
          contentType.includes('application/pdf') ||
          fileName.toLowerCase().endsWith('.pdf') ||
          fileUrl.toLowerCase().split('?')[0].endsWith('.pdf');

        if (isPdf) {
          setIsImageFormat(false);
          imageElementRef.current = null;

          if (arrayBuffer.byteLength < 50) {
            throw new Error(`Tệp PDF bị rỗng hoặc lỗi cấu trúc (${arrayBuffer.byteLength} bytes). Vui lòng tải lên lại bản vẽ.`);
          }

          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            cMapUrl: '/pdfjs/cmaps/',
            cMapPacked: true,
            standardFontDataUrl: '/pdfjs/standard_fonts/',
            useSystemFonts: true,
            disableFontFace: false,
          });

          const doc = await loadingTask.promise;
          if (isCancelled) return;

          let sW = 1200;
          let sH = 800;
          try {
            const page = await doc.getPage(1);
            const vp = page.getViewport({ scale: 1.0 });
            sW = Math.round(vp.width);
            sH = Math.round(vp.height);
          } catch (e) {
            console.warn('Không thể đọc kích thước page 1:', e);
          }

          if (isCancelled) return;

          setSheetSize({ width: sW, height: sH });
          setTotalPages(doc.numPages);
          setCurrentPage(1);
          fitViewToContainer(sW, sH);
          setPdfDoc(doc);
        } else {
          // Tệp ảnh kỹ thuật
          setIsImageFormat(true);
          setPdfDoc(null);
          const blob = new Blob([arrayBuffer], { type: contentType || 'image/png' });
          createdBlobUrl = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            if (isCancelled) return;
            imageElementRef.current = img;
            const sW = img.naturalWidth || 1200;
            const sH = img.naturalHeight || 800;
            setSheetSize({ width: sW, height: sH });
            setTotalPages(1);
            setCurrentPage(1);
            fitViewToContainer(sW, sH);
            setIsLoadingPdf(false);
          };
          img.onerror = () => {
            if (!isCancelled) {
              setPdfError('Không thể giải mã tệp ảnh bản vẽ kỹ thuật.');
              setIsLoadingPdf(false);
            }
          };
          img.src = createdBlobUrl;
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Lỗi tải bản vẽ:', err);
          setPdfError(err?.message || 'Không thể đọc tệp bản vẽ từ máy chủ.');
          setIsLoadingPdf(false);
        }
      }
    };

    loadDocumentData();

    return () => {
      isCancelled = true;
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [fileUrl, fileName, fitViewToContainer]);

  // Render Canvas khi tài liệu sẵn sàng hoặc chuyển trang
  useEffect(() => {
    if (pdfDoc || imageElementRef.current) {
      renderCanvas();
    }
  }, [pdfDoc, currentPage, renderCanvas]);

  // Re-render sắc nét khi dừng lăn chuột Zoom sâu
  const lastRenderedZoomRef = useRef<number>(zoom);
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      // Chỉ re-render làm nét khi zoom sâu (> 2.0x) và có thay đổi đáng kể
      if (zoom > 2.0 && Math.abs(zoom - lastRenderedZoomRef.current) / (lastRenderedZoomRef.current || 1) > 0.4) {
        lastRenderedZoomRef.current = zoom;
        setIsSharpening(true);
        renderCanvas();
      }
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [zoom, renderCanvas]);

  // ==========================================
  // III. HỆ THỐNG PAN & ZOOM TẠI VỊ TRÍ CON TRỎ (FOCAL ZOOM)
  // ==========================================

  const screenToSheet = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      const sheetX = (mouseX - pan.x) / zoom;
      const sheetY = (mouseY - pan.y) / zoom;
      return {
        x: Math.max(0, Math.min(sheetSize.width, Number(sheetX.toFixed(2)))),
        y: Math.max(0, Math.min(sheetSize.height, Number(sheetY.toFixed(2)))),
      };
    },
    [pan, zoom, sheetSize]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const newZoom = Math.max(0.2, Math.min(10.0, zoom * zoomFactor));

      if (newZoom === zoom) return;

      const newPanX = mouseX - ((mouseX - pan.x) / zoom) * newZoom;
      const newPanY = mouseY - ((mouseY - pan.y) / zoom) * newZoom;

      setZoom(newZoom);
      setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
    },
    [zoom, pan]
  );

  // Pan (Kéo rê bản vẽ) bằng chuột giữa hoặc giữ phím Space
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button === 1 || isSpacePressed || (!isDrawingMode && e.button === 0)) {
        setIsPanning(true);
        isPanGestureRef.current = true;
        isPanDragRef.current = false;
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          initialPanX: pan.x,
          initialPanY: pan.y,
        };
        return;
      }
    },
    [pan, isSpacePressed, isDrawingMode]
  );

  const handleMouseMoveGlobal = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // 1. Xử lý Pan
      if (isPanning) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        if (Math.hypot(dx, dy) > 3) {
          isPanDragRef.current = true;
          isPanGestureRef.current = true;
        }
        setPan({
          x: panStartRef.current.initialPanX + dx,
          y: panStartRef.current.initialPanY + dy,
        });
        return;
      }

      if (isSpacePressed || isPanGestureRef.current) return;

      const rawSheetPt = screenToSheet(e.clientX, e.clientY);
      if (!rawSheetPt) return;

      // Kéo chỉnh đỉnh sau khi đã khép kín hình
      if (draggingVertexIndex !== null && completedPoints) {
        const updated = [...completedPoints];
        updated[draggingVertexIndex] = {
          ...updated[draggingVertexIndex],
          x: rawSheetPt.x,
          y: rawSheetPt.y,
        };
        setCompletedPoints(updated);
        setCompletedSvgPath(buildAutoArcSvgPath(updated, true, e.shiftKey || isShiftPressed));
        return;
      }

      if (!isDrawingMode || completedPoints) return;

      // 2. Chấm điểm liên hoàn: Bắt dính khép kín hoặc bắt chuẩn góc vuông
      if (committedVertices.length === 0) {
        setCursorSheetPos(rawSheetPt);
        setIsNearStartPoint(false);
        return;
      }

      const firstVertex = committedVertices[0];
      const lastVertex = committedVertices[committedVertices.length - 1];
      const prevVertex =
        committedVertices.length >= 2 ? committedVertices[committedVertices.length - 2] : null;

      // Bán kính bắt dính vào điểm đầu P1: 6 / zoom (dung sai click 8 / zoom)
      const distToStart = Math.hypot(rawSheetPt.x - firstVertex.x, rawSheetPt.y - firstVertex.y);
      const snapRadius = 8 / zoom;
      const canClose = committedVertices.length >= 3;

      if (canClose && distToStart <= snapRadius) {
        setCursorSheetPos(firstVertex);
        setIsNearStartPoint(true);
      } else {
        setIsNearStartPoint(false);
        const isShift = e.shiftKey || isShiftPressed;
        if (isShift) {
          // Khi giữ Shift: di chuyển con trỏ tự do để căn đỉnh uốn cong arc_mid chuẩn xác
          setCursorSheetPos(rawSheetPt);
        } else {
          // Bắt chuẩn góc vuông 90° nếu gần trục
          const { point: snappedPt } = snapToRightAngle(
            prevVertex,
            lastVertex,
            rawSheetPt,
            false
          );
          setCursorSheetPos(snappedPt);
        }
      }
    },
    [
      isPanning,
      isSpacePressed,
      isDrawingMode,
      committedVertices,
      screenToSheet,
      draggingVertexIndex,
      completedPoints,
      zoom,
      isShiftPressed,
    ]
  );

  const handleMouseUpGlobal = useCallback(() => {
    setIsPanning(false);
    setDraggingVertexIndex(null);
    setTimeout(() => {
      isPanGestureRef.current = false;
      isPanDragRef.current = false;
    }, 200);
  }, []);

  // Lắng nghe phím Space và Shift
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
      if (e.code === 'Space') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
        }
        if (!e.repeat) {
          setIsSpacePressed(true);
          isPanGestureRef.current = true;
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setTimeout(() => {
          isPanGestureRef.current = false;
          isPanDragRef.current = false;
        }, 200);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // ==========================================
  // IV. KHÉP KÍN ĐỐI TƯỢNG VÀ MỞ MODAL ĐẶT TÊN
  // ==========================================

  const handleFinishClosing = useCallback(
    (isShiftOnClose = false) => {
      if (committedVertices.length < 3) {
        message.warning('Hình vẽ BẮT BUỘC phải có ít nhất 3 điểm và khép kín về điểm đầu tiên.');
        return;
      }

      // Nối đoạn cuối cùng về points[0] theo đúng 3 trường hợp
      const finalSvgPath = buildAutoArcSvgPath(committedVertices, true, isShiftOnClose);

      setCompletedPoints(committedVertices);
      setCompletedSvgPath(finalSvgPath);
      setCommittedVertices([]);
      setIsNearStartPoint(false);

      setInternalSelectedId(null);
      onSelectObject?.(null);
      form.resetFields();
      form.setFieldsValue({
        code: `OBJ-${Date.now().toString().slice(-4)}`,
        name: '',
        status: 'PENDING',
      });
      setIsModalOpen(true);
    },
    [committedVertices, form, onSelectObject]
  );

  // Click Chuột Trái: Chốt điểm mới hoặc khép kín hình
  const handleSheetClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (
        readOnly ||
        isPanning ||
        isSpacePressed ||
        isPanGestureRef.current ||
        isPanDragRef.current ||
        e.button !== 0
      ) {
        return;
      }

      if (completedPoints) return;

      const rawSheetPt = screenToSheet(e.clientX, e.clientY);
      if (!rawSheetPt) return;

      // 1. Điểm đầu tiên P0 (Luôn là 'anchor')
      if (committedVertices.length === 0) {
        setCommittedVertices([{ x: rawSheetPt.x, y: rawSheetPt.y, role: 'anchor' }]);
        return;
      }

      const firstVertex = committedVertices[0];
      const lastVertex = committedVertices[committedVertices.length - 1];
      const prevVertex =
        committedVertices.length >= 2 ? committedVertices[committedVertices.length - 2] : null;

      const distToStart = Math.hypot(rawSheetPt.x - firstVertex.x, rawSheetPt.y - firstVertex.y);
      const snapRadius = 8 / zoom;

      // 2. Click lại điểm đầu tiên P0 -> Tự động khép kín hình và mở Modal tạo Object
      if (committedVertices.length >= 3 && (isNearStartPoint || distToStart <= snapRadius)) {
        handleFinishClosing(e.shiftKey || isShiftPressed);
        return;
      }

      // 3. Chốt điểm tiếp theo với cơ chế:
      // - Click bình thường = đỉnh thẳng 'anchor'
      // - Shift + Click = điểm giữa cung tròn 'arc_mid'
      const isShift = e.shiftKey || isShiftPressed;
      const role: PointRole = isShift ? 'arc_mid' : 'anchor';

      let targetPt = rawSheetPt;
      if (!isShift) {
        const snapRes = snapToRightAngle(prevVertex, lastVertex, rawSheetPt, false);
        targetPt = snapRes.point;
      }

      // Tránh duplicate nếu click đúp quá nhanh tại 1 vị trí
      if (Math.hypot(targetPt.x - lastVertex.x, targetPt.y - lastVertex.y) < 1.0) {
        return;
      }

      setCommittedVertices((prev) => [...prev, { x: targetPt.x, y: targetPt.y, role }]);
    },
    [
      readOnly,
      isPanning,
      isSpacePressed,
      completedPoints,
      committedVertices,
      isNearStartPoint,
      screenToSheet,
      zoom,
      isShiftPressed,
      handleFinishClosing,
    ]
  );

  // Double-Click: Khép kín ngay nếu >= 3 điểm
  const handleSheetDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (readOnly || isSpacePressed || isPanDragRef.current) return;
      e.stopPropagation();

      if (committedVertices.length >= 3) {
        handleFinishClosing(e.shiftKey || isShiftPressed);
      }
    },
    [readOnly, isSpacePressed, committedVertices.length, isShiftPressed, handleFinishClosing]
  );

  // Undo đỉnh cuối cùng (Backspace / Ctrl+Z)
  const handleUndo = useCallback(() => {
    if (completedPoints) {
      setCompletedPoints(null);
      setCompletedSvgPath(null);
      return;
    }

    if (committedVertices.length > 0) {
      setCommittedVertices((prev) => prev.slice(0, -1));
    }
  }, [completedPoints, committedVertices]);

  // Hủy phiên vẽ
  const handleResetDrawing = useCallback(() => {
    setCommittedVertices([]);
    setCompletedPoints(null);
    setCompletedSvgPath(null);
    setIsNearStartPoint(false);
  }, []);

  // Lắng nghe phím tắt: Enter (Khép kín), Esc (Hủy), Backspace / Ctrl+Z (Undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleResetDrawing();
      } else if (e.key === 'Enter') {
        if (committedVertices.length >= 3) {
          e.preventDefault();
          handleFinishClosing(isShiftPressed);
        }
      } else if (
        e.key === 'Backspace' ||
        (e.key === 'z' && (e.ctrlKey || e.metaKey))
      ) {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetDrawing, handleUndo, handleFinishClosing, committedVertices.length, isShiftPressed]);

  // ==========================================
  // V. LƯU DỮ LIỆU ĐỐI TƯỢNG (SQL SERVER FORMAT)
  // ==========================================

  const handleSaveObjectForm = async () => {
    try {
      const values = await form.validateFields();
      if (!completedPoints || !completedSvgPath) {
        message.warning('Không tìm thấy dữ liệu đường bao cấu kiện.');
        return;
      }

      const xs = completedPoints.map((p) => p.x);
      const ys = completedPoints.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const currentStatus = activeSelectedId
        ? existingObjects.find((o) => o.id === activeSelectedId)?.status || 'PENDING'
        : 'PENDING';

      const colorMap: Record<string, string> = {
        PENDING: '#1890ff',
        PASS: '#52c41a',
        FAIL: '#ff4d4f',
        IN_PROGRESS: '#faad14',
      };

      const newObject: SavedObjectData = {
        id: activeSelectedId || `obj_${Date.now()}`,
        code: values.code,
        name: values.name,
        status: currentStatus,
        pageNumber: currentPage,
        svgPath: completedSvgPath,
        points: completedPoints,
        boundingBox: {
          x: minX,
          y: minY,
          width: Math.max(1, maxX - minX),
          height: Math.max(1, maxY - minY),
        },
        originalSheetWidth: sheetSize.width,
        originalSheetHeight: sheetSize.height,
        color: colorMap[currentStatus] || '#1890ff',
        createdAt: new Date().toISOString(),
      };

      if (onSaveObject) {
        await onSaveObject(newObject);
      }

      message.success(`Đã lưu cấu kiện '${values.name}' thành công!`);
      setIsModalOpen(false);
      handleResetDrawing();
    } catch {
      // Form validation error
    }
  };

  // Đường vẽ cố định qua các đỉnh đã chốt
  const committedSvgPath = useMemo(() => {
    if (committedVertices.length < 2) return '';
    return buildAutoArcSvgPath(committedVertices, false, false);
  }, [committedVertices]);

  // Đường vẽ xem trước trực tiếp (Live Preview) bẻ cong qua các điểm + con trỏ
  const livePreviewSvgPath = useMemo(() => {
    if (committedVertices.length === 0 || !cursorSheetPos || completedPoints) return '';

    // Khi con trỏ chuột trong bán kính snapRadius = 8 / zoom của points[0]:
    // Xem trước hình khép kín hoàn chỉnh đúng 3 trường hợp
    if (isNearStartPoint && committedVertices.length >= 3) {
      return buildAutoArcSvgPath(committedVertices, true, isShiftPressed);
    }

    // Đang di chuột vẽ dở dang:
    // Con trỏ chuột đóng vai trò đỉnh ứng viên tiếp theo (anchor)
    const pts: Point[] = [
      ...committedVertices,
      { x: cursorSheetPos.x, y: cursorSheetPos.y, role: 'anchor' },
    ];
    return buildAutoArcSvgPath(pts, false, false);
  }, [committedVertices, cursorSheetPos, completedPoints, isNearStartPoint, isShiftPressed]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#0f172a',
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* 1. THANH ĐIỀU KHIỂN CAD TOOLBAR (Cố định chiều cao, không co gãy chữ) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: 46,
          minHeight: 46,
          maxHeight: 46,
          flexShrink: 0,
          padding: '0 16px',
          background: 'rgba(30, 41, 59, 0.9)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 0,
            flex: 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
        >
          <Badge status="processing" color="#10b981" style={{ flexShrink: 0 }} />
          <Text
            strong
            title={fileName}
            style={{
              color: '#f8fafc',
              fontSize: 13,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 220,
              flexShrink: 0,
              display: 'inline-block',
            }}
          >
            {fileName}
          </Text>

          {!isImageFormat && totalPages > 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <Button
                size="small"
                icon={<LeftOutlined />}
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              />
              <Tag color="cyan" style={{ margin: 0 }}>
                {currentPage} / {totalPages}
              </Tag>
              <Button
                size="small"
                icon={<RightOutlined />}
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              />
            </div>
          ) : (
            <Tag color={isImageFormat ? 'gold' : 'cyan'} style={{ margin: 0, flexShrink: 0 }}>
              {isImageFormat ? 'Ảnh' : `Trang ${currentPage}`}
            </Tag>
          )}

          {isSharpening && (
            <Tag color="blue" icon={<Spin size="small" />} style={{ margin: 0, flexShrink: 0 }}>
              Làm nét...
            </Tag>
          )}

          {!readOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 1, overflow: 'hidden' }}>
              <Tag color="#10b981" style={{ fontWeight: 600, margin: 0, flexShrink: 0 }}>
                Click: Đỉnh thẳng
              </Tag>
              <Tag color="#38bdf8" style={{ fontWeight: 600, margin: 0, flexShrink: 0 }}>
                Shift+Click: Đỉnh cung
              </Tag>
              {committedVertices.length >= 3 && (
                <Tag color="gold" style={{ fontWeight: 700, margin: 0, flexShrink: 0 }}>
                  🎯 Click P₀ khép hình
                </Tag>
              )}
              {isShiftPressed && (
                <Tag color="#f59e0b" style={{ fontWeight: 600, margin: 0, flexShrink: 0 }}>
                  🔒 Shift
                </Tag>
              )}
            </div>
          )}
        </div>

        {/* Nút điều hướng Zoom & Thao tác */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {(committedVertices.length > 0 || completedPoints) && (
            <>
              <Tooltip title="Lùi lại điểm trước (Backspace / Ctrl+Z)">
                <Button
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={handleUndo}
                  style={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }}
                >
                  Lùi lại
                </Button>
              </Tooltip>

              <Tooltip title="Hủy vẽ lại từ đầu (Esc)">
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleResetDrawing}
                  danger
                  style={{ backgroundColor: '#1e293b' }}
                >
                  Hủy
                </Button>
              </Tooltip>

              <div
                style={{
                  width: 1,
                  height: 20,
                  background: 'rgba(255,255,255,0.2)',
                  margin: '0 4px',
                }}
              />
            </>
          )}

          <Tooltip title="Thu nhỏ">
            <Button
              size="small"
              icon={<ZoomOutOutlined />}
              onClick={() => setZoom((z) => Math.max(0.2, z * 0.85))}
            />
          </Tooltip>

          <Tag color="blue" style={{ minWidth: 48, textAlign: 'center', margin: 0 }}>
            {Math.round(zoom * 100)}%
          </Tag>

          <Tooltip title="Phóng to">
            <Button
              size="small"
              icon={<ZoomInOutlined />}
              onClick={() => setZoom((z) => Math.min(10.0, z * 1.15))}
            />
          </Tooltip>

          <Tooltip title="Vừa khung hình">
            <Button
              size="small"
              icon={<ArrowsAltOutlined />}
              onClick={() => fitViewToContainer(sheetSize.width, sheetSize.height)}
            >
              Fit
            </Button>
          </Tooltip>
        </div>
      </div>

      {pdfError && (
        <Alert
          message="Lỗi đọc tệp bản vẽ"
          description={pdfError}
          type="error"
          showIcon
          closable
        />
      )}

      {/* 2. KHÔNG GIAN BẢN VẼ VIEWPORT CHÍNH */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveGlobal}
        onMouseUp={handleMouseUpGlobal}
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          // Con trỏ crosshair luôn mảnh và giữ nguyên kích thước màn hình
          cursor: isPanning
            ? 'grabbing'
            : isSpacePressed
            ? 'grab'
            : isDrawingMode
            ? 'crosshair'
            : 'default',
          backgroundColor: '#090d16',
        }}
      >
        {/* Loading Spinner */}
        {isLoadingPdf && !pdfError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              zIndex: 20,
            }}
          >
            <Spin size="large" />
            <Text style={{ color: '#94a3b8', marginTop: 12 }}>
              Đang dựng bản vẽ siêu nét...
            </Text>
          </div>
        )}

        {/* LỚP 1: Canvas bản vẽ (Render độ phân giải cao, Pan/Zoom 60fps trên GPU) */}
        <div
          ref={sheetContainerRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: sheetSize.width,
            height: sheetSize.height,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: '0 0',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            transition: isPanning ? 'none' : 'transform 0.05s ease-out',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: sheetSize.width,
              height: sheetSize.height,
              display: 'block',
              backgroundColor: '#ffffff',
            }}
          />
        </div>

        {/* LỚP 3: SVG Vector Overlay (Tọa độ 1:1 theo Sheet, Inverse Zoom Scaling) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: sheetSize.width,
            height: sheetSize.height,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: '0 0',
            pointerEvents: 'none',
            zIndex: 4,
          }}
        >
          <svg
            viewBox={`0 0 ${sheetSize.width} ${sheetSize.height}`}
            style={{
              width: sheetSize.width,
              height: sheetSize.height,
              overflow: 'visible',
              pointerEvents: isSpacePressed ? 'none' : 'auto',
            }}
            onClick={handleSheetClick}
            onDoubleClick={handleSheetDoubleClick}
          >
            {/* 3.1. Render các Object đã lưu từ trước */}
            {existingObjects.map((obj) => {
              const isSelected = obj.id === activeSelectedId;
              return (
                <g
                  key={obj.id}
                  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isPanning || isSpacePressed || isPanGestureRef.current || isPanDragRef.current) return;
                    setInternalSelectedId(obj.id);
                    onSelectObject?.(obj.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (readOnly || isPanning || isSpacePressed || isPanGestureRef.current || isPanDragRef.current) return;
                    setInternalSelectedId(obj.id);
                    onSelectObject?.(obj.id);
                    form.resetFields();
                    form.setFieldsValue({
                      code: obj.code,
                      name: obj.name,
                      status: obj.status,
                    });
                    setCompletedPoints(obj.points);
                    setCompletedSvgPath(obj.svgPath);
                    setIsModalOpen(true);
                  }}
                >
                  <path
                    d={obj.svgPath}
                    fill={obj.color}
                    fillOpacity={isSelected ? 0.45 : 0.25}
                    stroke={isSelected ? '#facc15' : obj.color}
                    strokeWidth={(isSelected ? 2.5 : 1.5) / zoom}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {isSelected && (
                    <path
                      d={obj.svgPath}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={1.5 / zoom}
                      strokeDasharray={`${4 / zoom} ${4 / zoom}`}
                    />
                  )}
                  <text
                    x={obj.boundingBox.x + 8 / zoom}
                    y={obj.boundingBox.y + 18 / zoom}
                    fill={isSelected ? '#facc15' : '#ffffff'}
                    fontSize={12 / zoom}
                    fontWeight="bold"
                    style={{
                      textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                      pointerEvents: 'none',
                    }}
                  >
                    {obj.name.startsWith(obj.code) ? obj.name : `${obj.code} - ${obj.name}`}
                  </text>
                </g>
              );
            })}

            {/* 3.2. Render các đoạn Auto-Arc đã chốt cố định */}
            {committedSvgPath && (
              <path
                d={committedSvgPath}
                fill="none"
                stroke="#10b981"
                strokeWidth={1.5 / zoom}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* 3.3. Render đoạn Live Preview bẻ cong tự động theo con trỏ chuột */}
            {livePreviewSvgPath && (
              <path
                d={livePreviewSvgPath}
                fill={isNearStartPoint ? 'rgba(56, 189, 248, 0.25)' : 'none'}
                stroke={isNearStartPoint ? (isShiftPressed ? '#facc15' : '#38bdf8') : '#22c55e'}
                strokeWidth={1.5 / zoom}
                strokeDasharray={isNearStartPoint ? undefined : `${4 / zoom} ${4 / zoom}`}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* 3.4. Render hình đã khép kín hoàn tất */}
            {completedSvgPath && (
              <path
                d={completedSvgPath}
                fill="#38bdf8"
                fillOpacity={0.25}
                stroke="#38bdf8"
                strokeWidth={1.5 / zoom}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* 3.5. Render các đỉnh chốt cố định (Inverse Zoom Scaling: r = 3.5 / zoom) */}
            {committedVertices.map((v, i) => {
              const isStart = i === 0;
              const canClose = isStart && committedVertices.length >= 3;
              const isArcMid = v.role === 'arc_mid';

              return (
                <g key={`vertex-${i}`}>
                  {/* Đỉnh chốt tiếp theo (anchor hoặc arc_mid) */}
                  {!isStart && (
                    <>
                      <circle
                        cx={v.x}
                        cy={v.y}
                        r={3.5 / zoom}
                        fill={isArcMid ? '#38bdf8' : '#10b981'}
                        stroke="#ffffff"
                        strokeWidth={1.5 / zoom}
                        style={{ pointerEvents: 'none' }}
                      />
                      {isArcMid && (
                        <circle
                          cx={v.x}
                          cy={v.y}
                          r={6.5 / zoom}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth={1 / zoom}
                          strokeDasharray={`${2 / zoom} ${2 / zoom}`}
                          style={{ pointerEvents: 'none' }}
                        />
                      )}
                    </>
                  )}

                  {/* ĐIỂM ĐẦU TIÊN P0: Highlight & Snap Ring */}
                  {isStart && (
                    <>
                      {/* Chấm tròn tâm P0 */}
                      <circle
                        cx={v.x}
                        cy={v.y}
                        r={isNearStartPoint ? 4.5 / zoom : 3.5 / zoom}
                        fill={isNearStartPoint ? '#facc15' : '#10b981'}
                        stroke="#ffffff"
                        strokeWidth={1.5 / zoom}
                        style={{ pointerEvents: 'none' }}
                      />

                      {/* Vòng tròn viền báo hiệu khi có đủ >= 3 điểm */}
                      {canClose && (
                        <>
                          <circle
                            cx={v.x}
                            cy={v.y}
                            r={isNearStartPoint ? 12 / zoom : 7 / zoom}
                            fill={isNearStartPoint ? 'rgba(56, 189, 248, 0.3)' : 'none'}
                            stroke={isNearStartPoint ? (isShiftPressed ? '#facc15' : '#38bdf8') : '#10b981'}
                            strokeWidth={isNearStartPoint ? 2 / zoom : 1.5 / zoom}
                            strokeDasharray={isNearStartPoint ? undefined : `${3 / zoom} ${2 / zoom}`}
                            style={{ pointerEvents: 'none' }}
                          />

                          {/* Nhãn tooltip nổi phía trên P0 khi rê chuột vào bán kính snap */}
                          {isNearStartPoint && (
                            <g transform={`translate(${v.x}, ${v.y - 18 / zoom})`} style={{ pointerEvents: 'none' }}>
                              <rect
                                x={-62 / zoom}
                                y={-10 / zoom}
                                width={124 / zoom}
                                height={20 / zoom}
                                rx={4 / zoom}
                                fill="rgba(15, 23, 42, 0.95)"
                                stroke={isShiftPressed ? '#facc15' : '#38bdf8'}
                                strokeWidth={1.5 / zoom}
                              />
                              <text
                                x={0}
                                y={4 / zoom}
                                textAnchor="middle"
                                fill={isShiftPressed ? '#facc15' : '#38bdf8'}
                                fontSize={10 / zoom}
                                fontWeight="bold"
                              >
                                {committedVertices.length === 3 && committedVertices[1]?.role === 'arc_mid' && isShiftPressed
                                  ? '● Khép Tròn 360°'
                                  : '● Click Khép Hình'}
                              </text>
                            </g>
                          )}

                          {/* Vùng cảm ứng Click khép hình trực tiếp trên P0 */}
                          <circle
                            cx={v.x}
                            cy={v.y}
                            r={Math.max(14 / zoom, 16)}
                            fill="transparent"
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFinishClosing(e.shiftKey || isShiftPressed);
                            }}
                          />
                        </>
                      )}
                    </>
                  )}
                </g>
              );
            })}

            {/* 3.6. Render các đỉnh điều khiển để kéo chỉnh sau khi khép kín */}
            {completedPoints &&
              completedPoints.map((p, i) => (
                <circle
                  key={`handle-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={3.5 / zoom}
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth={1.5 / zoom}
                  style={{ cursor: 'move' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingVertexIndex(i);
                  }}
                />
              ))}
          </svg>
        </div>

        {/* 4. BẢNG HƯỚNG DẪN NHANH */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            padding: '8px 14px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 6,
            color: '#94a3b8',
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          <Space direction="vertical" size={2}>
            <div>
              <span style={{ color: '#10b981', fontWeight: 600 }}>🖱️ Click Chuột Trái:</span> Chốt đỉnh thẳng (<b>'anchor'</b>).
            </div>
            <div>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>📐 Shift + Click:</span> Chốt điểm giữa cung tròn (<b>'arc_mid'</b>).
            </div>
            <div>
              <span style={{ color: '#facc15', fontWeight: 600 }}>🎯 Khép kín hình:</span> Rê chuột về điểm đầu P₀ (bán kính 8px), Click hoặc ấn <b>Enter</b> / <b>Double-Click</b> để tạo Cấu kiện.
            </div>
          </Space>
        </div>
      </div>

      {/* 5. MODAL NHẬP THÔNG TIN OBJECT (Trạng thái luôn là PENDING) */}
      <Modal
        title={
          <Space>
            <CheckOutlined style={{ color: '#10b981' }} />
            <span>
              {activeSelectedId
                ? 'Thông tin Cấu kiện khoanh vùng'
                : 'Đặt tên & Xác nhận Cấu kiện vừa khoanh vùng'}
            </span>
          </Space>
        }
        open={isModalOpen}
        onOk={handleSaveObjectForm}
        onCancel={() => setIsModalOpen(false)}
        okText="Lưu Cấu kiện"
        cancelText="Đóng"
        zIndex={1200}
        destroyOnClose
        centered
        footer={(_, { OkBtn, CancelBtn }) => (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {activeSelectedId && onDeleteObject && !readOnly ? (
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={async () => {
                  await onDeleteObject(activeSelectedId);
                  setIsModalOpen(false);
                  handleResetDrawing();
                }}
              >
                Xóa Cấu kiện
              </Button>
            ) : (
              <div />
            )}
            <Space>
              <CancelBtn />
              <OkBtn />
            </Space>
          </div>
        )}
      >
        <Alert
          message="Biên dạng đã được tự động ôm sát các cạnh cấu kiện."
          description="Vui lòng nhập Mã và Tên cấu kiện. Trạng thái nghiệm thu ban đầu luôn là 'Chờ nghiệm thu'."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={form} layout="vertical">
          <Form.Item
            label="Mã Cấu kiện (ObjectCode)"
            name="code"
            rules={[{ required: true, message: 'Vui lòng nhập mã cấu kiện' }]}
          >
            <Input placeholder="Ví dụ: C-T3-12, D-04, S-01" />
          </Form.Item>

          <Form.Item
            label="Tên Cấu kiện (ObjectName)"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên cấu kiện' }]}
          >
            <Input autoFocus placeholder="Ví dụ: Cột tròn C12 Tầng 3, Dầm D4, Sàn S1..." />
          </Form.Item>

          <Form.Item label="Trạng thái Nghiệm thu ban đầu">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                background: 'rgba(22, 119, 255, 0.08)',
                border: '1px solid rgba(22, 119, 255, 0.2)',
                borderRadius: 6,
              }}
            >
              <Tag
                color="blue"
                style={{ fontSize: 13, padding: '2px 8px', margin: 0, fontWeight: 600 }}
              >
                Chờ nghiệm thu (PENDING)
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Tự động cập nhật dựa trên luồng duyệt Checklist & Form Inspection.
              </Text>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default SmartDrawingViewport;
