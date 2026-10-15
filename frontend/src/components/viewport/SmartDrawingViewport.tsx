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
  ThunderboltOutlined,
  AimOutlined,
  LeftOutlined,
  RightOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import apiClient from '../../services/apiClient';

// Cấu hình Worker cho PDF.js v6
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    pdfWorkerUrl || `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

import type { CostMapData, Point, SavedObjectData } from './cv/types';
import { buildCostMapFromImageData, findNearestEdgeSnap } from './cv/imageCostMap';
import { findMagneticPath } from './cv/livewirePathfinder';
import { extractClosedContourFromClick } from './cv/floodFillContour';
import { simplifyRDP, simplifyClosedLoop, pointsToSmoothSvgPath } from './cv/curveFitting';

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

  // 2. Pan & Zoom States (CAD Transformation: 20% đến 1000%)
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const isPanDragRef = useRef<boolean>(false);
  const isPanGestureRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; initialPanX: number; initialPanY: number }>({
    x: 0,
    y: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  // Re-rasterization Debounce: Canvas sắc nét ở mọi độ zoom
  const renderedScaleRef = useRef<number>(1.0);
  const debounceTimerRef = useRef<any>(null);

  // 3. Computer Vision & Cost Map State (1:1 chuẩn xác theo Sheet)
  const [costMap, setCostMap] = useState<CostMapData | null>(null);
  const costMapRef = useRef<CostMapData | null>(null);
  const [isComputingCV, setIsComputingCV] = useState<boolean>(false);

  // 4. Zero-Manual-Bending Drawing Engine State
  const isDrawingMode = !readOnly;
  const [committedVertices, setCommittedVertices] = useState<Point[]>([]);
  const [committedPathSegments, setCommittedPathSegments] = useState<string[]>([]);
  const [livewirePath, setLivewirePath] = useState<string>('');
  const [livewirePoints, setLivewirePoints] = useState<Point[]>([]);
  const [isLivewireSnapped, setIsLivewireSnapped] = useState<boolean>(false);

  // Điểm chuột thực tế trên hệ tọa độ bản vẽ
  const [cursorSheetPos, setCursorSheetPos] = useState<Point | null>(null);
  const [isNearStartPoint, setIsNearStartPoint] = useState<boolean>(false);

  // 5. Tinh chỉnh đỉnh sau khi khép kín hình
  const [completedPoints, setCompletedPoints] = useState<Point[] | null>(null);
  const [completedSvgPath, setCompletedSvgPath] = useState<string | null>(null);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);

  // 6. Modal đặt tên và lưu Object
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);

  const activeSelectedId = externalSelectedId ?? internalSelectedId;

  // Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sheetContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

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
    const clampedScale = Math.max(0.2, Math.min(scale, 1.2));

    const panX = Math.round((rect.width - sheetW * clampedScale) / 2);
    const panY = Math.round((rect.height - sheetH * clampedScale) / 2);

    setZoom(clampedScale);
    setPan({ x: Math.max(0, panX), y: Math.max(0, panY) });
  }, []);

  // Định vị và căn giữa đối tượng khi được chọn
  useEffect(() => {
    if (activeSelectedId && existingObjects.length > 0 && containerRef.current) {
      const obj = existingObjects.find((o) => o.id === activeSelectedId);
      if (obj && obj.boundingBox) {
        const rect = containerRef.current.getBoundingClientRect();
        const objCenterX = obj.boundingBox.x + obj.boundingBox.width / 2;
        const objCenterY = obj.boundingBox.y + obj.boundingBox.height / 2;
        const targetZoom = Math.max(1.0, Math.min(2.5, 450 / Math.max(obj.boundingBox.width, obj.boundingBox.height, 100)));
        setZoom(targetZoom);
        setPan({
          x: Math.round(rect.width / 2 - objCenterX * targetZoom),
          y: Math.round(rect.height / 2 - objCenterY * targetZoom),
        });
      }
    }
  }, [activeSelectedId, existingObjects]);

  // ==========================================
  // II. RENDER BẢN VẼ PDF / ẢNH (DEBOUNCED RE-RASTERIZATION)
  // ==========================================
  const renderCanvasAtScale = useCallback(
    async (targetScale: number) => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const sheetW = sheetSize.width || 1200;
      const sheetH = sheetSize.height || 800;

      // THUẬT TOÁN TỐI ƯU 1: GIỚI HẠN AN TOÀN PHẦN CỨNG ĐỒ HỌA (MAX 8192PX)
      // Cho phép vector siêu nét ở zoom lớn (300% - 1000%) mà không làm tràn GPU
      const maxCanvasDim = 8192;
      const maxSheetDim = Math.max(sheetW, sheetH);
      const maxHardwareScale = maxSheetDim > 0 ? maxCanvasDim / maxSheetDim : 12;

      // Độ phân giải thực tế: scale = targetScale * dpr để chữ số CAD và đường nét nhỏ nhất hiển thị sắc nét 100%
      const effectiveScale = Math.max(1.0, Math.min(targetScale * dpr, maxHardwareScale, 12.0));

      // A. Ảnh kỹ thuật
      if (imageElementRef.current) {
        const img = imageElementRef.current;
        const nativeW = img.naturalWidth || sheetW;
        const nativeH = img.naturalHeight || sheetH;

        // Đối với ảnh tĩnh, luôn render ở độ phân giải gốc của ảnh (100% pixel fidelity)
        canvas.width = nativeW;
        canvas.height = nativeH;
        canvas.style.width = `${sheetW}px`;
        canvas.style.height = `${sheetH}px`;
        const imgCtx = canvas.getContext('2d');
        if (imgCtx) {
          imgCtx.imageSmoothingEnabled = true;
          imgCtx.imageSmoothingQuality = 'high';
          imgCtx.drawImage(img, 0, 0, nativeW, nativeH);
        }

        renderedScaleRef.current = targetScale;
        setIsLoadingPdf(false);
        setIsSharpening(false);

        // Trích xuất Cost Map (Chỉ 1 lần duy nhất ở tỷ lệ gốc 1.0)
        if (!costMapRef.current) {
          setIsComputingCV(true);
          setTimeout(() => {
            try {
              const cvCanvas = document.createElement('canvas');
              cvCanvas.width = nativeW;
              cvCanvas.height = nativeH;
              const cvCtx = cvCanvas.getContext('2d');
              if (cvCtx) {
                cvCtx.drawImage(img, 0, 0, nativeW, nativeH);
                const imgData = cvCtx.getImageData(0, 0, nativeW, nativeH);
                const cMap = buildCostMapFromImageData(imgData);
                costMapRef.current = cMap;
                setCostMap(cMap);
              }
            } catch (err) {
              console.warn('Lỗi trích xuất Cost Map ảnh:', err);
            } finally {
              setIsComputingCV(false);
            }
          }, 60);
        }
        return;
      }

      // B. Bản vẽ PDF Vector (pdfjs-dist)
      if (!pdfDoc) return;

      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // bỏ qua
          }
        }

        const page = await pdfDoc.getPage(currentPage);
        const originalViewport = page.getViewport({ scale: 1.0 });
        const renderViewport = page.getViewport({ scale: effectiveScale });

        const rw = Math.round(renderViewport.width);
        const rh = Math.round(renderViewport.height);

        // THUẬT TOÁN TỐI ƯU 2: DOUBLE BUFFERING CHO PDF.JS
        // PDF.js render trực tiếp vào offscreen canvas, giữ nguyên màn hình hiện tại với CSS zoom 60fps
        const offscreen = document.createElement('canvas');
        offscreen.width = rw;
        offscreen.height = rh;
        const offCtx = offscreen.getContext('2d');
        if (!offCtx) return;

        const renderContext = {
          canvasContext: offCtx,
          viewport: renderViewport,
          canvas: offscreen,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;

        // Atomic Swap: Chép kết quả đã render xong vào canvas chính (0ms chớp trắng)
        canvas.width = rw;
        canvas.height = rh;
        canvas.style.width = `${originalViewport.width}px`;
        canvas.style.height = `${originalViewport.height}px`;
        const visibleCtx = canvas.getContext('2d');
        if (visibleCtx) {
          visibleCtx.imageSmoothingEnabled = true;
          visibleCtx.imageSmoothingQuality = 'high';
          visibleCtx.drawImage(offscreen, 0, 0);
        }

        renderedScaleRef.current = targetScale;
        setIsLoadingPdf(false);
        setIsSharpening(false);

        // THUẬT TOÁN TỐI ƯU 3: TÁCH RIÊNG TRÍCH XUẤT COST MAP CHUẨN HÓA 1X
        // Không tính lại khi zoom để tránh nghẽn luồng chính và sai lệch tọa độ
        if (!costMapRef.current) {
          setIsComputingCV(true);
          setTimeout(async () => {
            try {
              const cvVp = page.getViewport({ scale: 1.0 });
              const cvCanvas = document.createElement('canvas');
              cvCanvas.width = Math.round(cvVp.width);
              cvCanvas.height = Math.round(cvVp.height);
              const cvCtx = cvCanvas.getContext('2d', { willReadFrequently: true });
              if (cvCtx) {
                const cvTask = page.render({
                  canvasContext: cvCtx,
                  viewport: cvVp,
                  canvas: cvCanvas,
                });
                await cvTask.promise;
                const imgData = cvCtx.getImageData(0, 0, cvCanvas.width, cvCanvas.height);
                const cMap = buildCostMapFromImageData(imgData);
                costMapRef.current = cMap;
                setCostMap(cMap);
              }
            } catch (cvErr) {
              console.warn('Lỗi trích xuất Cost Map PDF:', cvErr);
            } finally {
              setIsComputingCV(false);
            }
          }, 60);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('Lỗi render PDF Canvas:', err);
          setIsLoadingPdf(false);
          setIsSharpening(false);
        }
      }
    },
    [pdfDoc, currentPage, sheetSize]
  );

  // Tải Document với Token xác thực (Chỉ phụ thuộc fileUrl & fileName, không có vòng lặp phụ thuộc)
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
    setCostMap(null);
    costMapRef.current = null;
    renderedScaleRef.current = 1.0;
    setCommittedVertices([]);
    setCommittedPathSegments([]);
    setLivewirePath('');
    setLivewirePoints([]);
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
            arrayBuffer = res.data;
            contentType = String(res.headers['content-type'] || '').toLowerCase();
          } catch (apiErr) {
            const token = localStorage.getItem('token');
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(fileUrl, { headers });
            if (!res.ok) {
              throw new Error(`Không thể tải tệp bản vẽ từ máy chủ (HTTP ${res.status})`);
            }
            arrayBuffer = await res.arrayBuffer();
            contentType = (res.headers.get('content-type') || '').toLowerCase();
          }
        }

        if (isCancelled) return;

        // Nhận diện tệp PDF qua Magic Bytes '%PDF' hoặc Content-Type/Extension
        const isPdf =
          contentType.includes('application/pdf') ||
          fileName.toLowerCase().endsWith('.pdf') ||
          fileUrl.toLowerCase().split('?')[0].endsWith('.pdf') ||
          (arrayBuffer.byteLength >= 4 &&
            new Uint8Array(arrayBuffer, 0, 4)[0] === 0x25 &&
            new Uint8Array(arrayBuffer, 0, 4)[1] === 0x50 &&
            new Uint8Array(arrayBuffer, 0, 4)[2] === 0x44 &&
            new Uint8Array(arrayBuffer, 0, 4)[3] === 0x46);

        if (isPdf) {
          setIsImageFormat(false);
          imageElementRef.current = null;

          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            cMapUrl: 'https://unpkg.com/pdfjs-dist@legacy/cmaps/',
            cMapPacked: true,
          });

          const doc = await loadingTask.promise;
          if (isCancelled) return;

          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setCurrentPage(1);

          try {
            const page = await doc.getPage(1);
            const vp = page.getViewport({ scale: 1.0 });
            const sW = Math.round(vp.width);
            const sH = Math.round(vp.height);
            setSheetSize({ width: sW, height: sH });
            setTimeout(() => {
              fitViewToContainer(sW, sH);
            }, 60);
          } catch {
            // bỏ qua
          }
        } else {
          // Tệp ảnh kỹ thuật (PNG, JPG, WebP...)
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
            setTimeout(() => {
              fitViewToContainer(sW, sH);
            }, 60);
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

  // Kích hoạt render lại canvas khi tài liệu sẵn sàng hoặc đổi trang
  useEffect(() => {
    if (pdfDoc || imageElementRef.current) {
      renderCanvasAtScale(zoom);
    }
  }, [pdfDoc, currentPage, renderCanvasAtScale]);

  // Debounced Re-rasterization khi dừng lăn chuột để bản vẽ luôn SIÊU NÉT
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      // Khi dừng lăn chuột (160ms), nếu tỷ lệ zoom hiện tại lệch trên 3%
      // so với tỷ lệ đã rasterize, tiến hành re-render ngầm ở độ phân giải thực siêu nét.
      const currentScale = renderedScaleRef.current || 1.0;
      const diff = Math.abs(zoom - currentScale) / currentScale;
      if (diff > 0.03) {
        setIsSharpening(true);
        renderCanvasAtScale(zoom);
      }
    }, 160);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [zoom, renderCanvasAtScale]);

  // ==========================================
  // III. HỆ THỐNG PAN & ZOOM TẠI VỊ TRÍ CON TRỎ (FOCAL ZOOM)
  // ==========================================

  const screenToSheet = useCallback(
    (clientX: number, clientY: number): Point | null => {
      if (!sheetContainerRef.current) return null;
      const rect = sheetContainerRef.current.getBoundingClientRect();
      const x = (clientX - rect.left) / zoom;
      const y = (clientY - rect.top) / zoom;
      return {
        x: Math.max(0, Math.min(sheetSize.width, Math.round(x))),
        y: Math.max(0, Math.min(sheetSize.height, Math.round(y))),
      };
    },
    [zoom, sheetSize]
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

      // 2. Tọa độ chuột cho chế độ bám nét (chỉ khi không giữ phím Space)
      if (isSpacePressed || isPanGestureRef.current) return;

      const sheetPt = screenToSheet(e.clientX, e.clientY);
      if (!sheetPt) return;
      setCursorSheetPos(sheetPt);

      // Kéo chỉnh đỉnh sau khi khép kín hình
      if (draggingVertexIndex !== null && completedPoints) {
        const updated = [...completedPoints];
        updated[draggingVertexIndex] = sheetPt;
        setCompletedPoints(updated);
        setCompletedSvgPath(pointsToSmoothSvgPath(updated, true));
        return;
      }

      // 3. Tính toán Magnetic Livewire bám nét
      if (isDrawingMode && committedVertices.length > 0 && costMap) {
        const lastVertex = committedVertices[committedVertices.length - 1];
        const firstVertex = committedVertices[0];

        const snapDistanceSheet = Math.max(22, Math.round(35 / zoom));
        const distToStart = Math.hypot(sheetPt.x - firstVertex.x, sheetPt.y - firstVertex.y);
        const nearStart = distToStart <= snapDistanceSheet && committedVertices.length >= 3;
        setIsNearStartPoint(nearStart);

        const target = nearStart ? firstVertex : sheetPt;

        const result = findMagneticPath(costMap, lastVertex, target);
        const smoothedPoints = simplifyRDP(result.points, 1.2);
        const smoothPath = pointsToSmoothSvgPath(smoothedPoints, false);

        setLivewirePath(smoothPath);
        setLivewirePoints(result.points);
        setIsLivewireSnapped(result.isSnappedToEdge || nearStart);
      }
    },
    [
      isPanning,
      isSpacePressed,
      isDrawingMode,
      committedVertices,
      costMap,
      screenToSheet,
      draggingVertexIndex,
      completedPoints,
      zoom,
    ]
  );

  const handleMouseUpGlobal = useCallback(() => {
    setIsPanning(false);
    setDraggingVertexIndex(null);
    setTimeout(() => {
      isPanGestureRef.current = false;
      isPanDragRef.current = false;
    }, 250);
  }, []);

  // Lắng nghe phím Space để Pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setTimeout(() => {
          isPanGestureRef.current = false;
          isPanDragRef.current = false;
        }, 250);
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

  const handleFinishClosing = useCallback(() => {
    if (committedVertices.length < 3) {
      message.warning('Cần ít nhất 3 điểm chốt để khép kín đối tượng.');
      return;
    }

    const allPoints: Point[] = [];
    committedVertices.forEach((v) => allPoints.push(v));

    if (livewirePoints.length > 0) {
      livewirePoints.forEach((p) => allPoints.push(p));
    }

    const firstVertex = committedVertices[0];
    const lastPt = allPoints[allPoints.length - 1];
    if (Math.hypot(lastPt.x - firstVertex.x, lastPt.y - firstVertex.y) > 2) {
      allPoints.push(firstVertex);
    }

    const simplified = simplifyClosedLoop(allPoints, 1.6);
    const finalSvgPath = pointsToSmoothSvgPath(simplified, true);

    setCompletedPoints(simplified);
    setCompletedSvgPath(finalSvgPath);
    setCommittedVertices([]);
    setCommittedPathSegments([]);
    setLivewirePath('');
    setLivewirePoints([]);
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
  }, [committedVertices, livewirePoints, form, onSelectObject]);

  // Hành vi 2: Double-click HOẶC Alt + Click
  const handleSheetDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (readOnly || isSpacePressed || isPanDragRef.current) return;
      e.stopPropagation();

      // Nếu đang vẽ dở chuỗi điểm >= 3 -> Double Click KHÉP KÍN NGAY!
      if (committedVertices.length >= 3) {
        handleFinishClosing();
        return;
      }

      // Nếu chưa có điểm nào -> Double-click vào trong lòng đối tượng để One-Click Flood-Fill
      if (committedVertices.length === 0 && costMap) {
        const seedPt = screenToSheet(e.clientX, e.clientY);
        if (!seedPt) return;

        message.loading({
          content: 'Đang quét tự động ranh giới hình khép kín...',
          key: 'contour-scan',
          duration: 1,
        });

        const contour = extractClosedContourFromClick(costMap, seedPt);

        if (!contour || contour.points.length < 5) {
          message.warning({
            content: 'Không phát hiện được biên dạng khép kín tại điểm click. Hãy click từng điểm theo nét vẽ.',
            key: 'contour-scan',
          });
          return;
        }

        const simplified = simplifyClosedLoop(contour.points, 1.8);
        const finalSvgPath = pointsToSmoothSvgPath(simplified, true);

        setCompletedPoints(simplified);
        setCompletedSvgPath(finalSvgPath);
        setCommittedVertices([]);
        setCommittedPathSegments([]);
        setLivewirePath('');
        setLivewirePoints([]);

        message.success({
          content: `Đã tự động ôm trọn hình khép kín (${contour.points.length} điểm nét).`,
          key: 'contour-scan',
        });

        setInternalSelectedId(null);
        onSelectObject?.(null);
        form.resetFields();
        form.setFieldsValue({
          code: `OBJ-${Date.now().toString().slice(-4)}`,
          name: 'Cấu kiện khoanh vùng tự động',
          status: 'PENDING',
        });
        setIsModalOpen(true);
      }
    },
    [readOnly, isSpacePressed, committedVertices, costMap, screenToSheet, form, handleFinishClosing, onSelectObject]
  );

  // Click 1 chạm trên Canvas: Chốt đỉnh Livewire hoặc Khép kín hình
  const handleSheetClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      // TUYỆT ĐỐI KHÔNG ĐẶT ĐIỂM KHI ĐANG GIỮ SPACE HOẶC VỪA KÉO PAN BẢN VẼ
      if (readOnly || isPanning || isSpacePressed || isPanGestureRef.current || isPanDragRef.current || e.button !== 0) {
        return;
      }

      if (e.altKey) {
        handleSheetDoubleClick(e);
        return;
      }

      const sheetPt = screenToSheet(e.clientX, e.clientY);
      if (!sheetPt) return;

      // 1. Đang có hình vừa hoàn tất -> Không thêm điểm mới
      if (completedPoints) return;

      // 2. Điểm xuất phát đầu tiên P0
      if (committedVertices.length === 0) {
        const snapStart = costMap
          ? findNearestEdgeSnap(costMap, sheetPt, 14).point
          : sheetPt;
        setCommittedVertices([snapStart]);
        setCommittedPathSegments([`M ${snapStart.x} ${snapStart.y}`]);
        return;
      }

      // 3. Nếu click gần hoặc vào điểm xuất phát P0 -> KHÉP KÍN ĐỐI TƯỢNG
      const firstVertex = committedVertices[0];
      const snapDistanceSheet = Math.max(22, Math.round(35 / zoom));
      const distToStart = Math.hypot(sheetPt.x - firstVertex.x, sheetPt.y - firstVertex.y);

      if ((isNearStartPoint || distToStart <= snapDistanceSheet) && committedVertices.length >= 3) {
        handleFinishClosing();
        return;
      }

      // 4. Chốt điểm P_next
      const snapTarget =
        costMap && isLivewireSnapped
          ? livewirePoints[livewirePoints.length - 1] || sheetPt
          : sheetPt;

      const newVertices = [...committedVertices, snapTarget];
      setCommittedVertices(newVertices);

      if (livewirePath) {
        setCommittedPathSegments((prev) => [...prev, livewirePath]);
      } else {
        setCommittedPathSegments((prev) => [
          ...prev,
          `L ${snapTarget.x} ${snapTarget.y}`,
        ]);
      }

      setLivewirePath('');
      setLivewirePoints([]);
    },
    [
      readOnly,
      isPanning,
      isSpacePressed,
      completedPoints,
      committedVertices,
      isNearStartPoint,
      costMap,
      isLivewireSnapped,
      livewirePoints,
      livewirePath,
      screenToSheet,
      zoom,
      handleSheetDoubleClick,
      handleFinishClosing,
    ]
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
      setCommittedPathSegments((prev) => prev.slice(0, -1));
      setLivewirePath('');
      setLivewirePoints([]);
    }
  }, [completedPoints, committedVertices]);

  // Hủy phiên khoanh vùng hiện tại
  const handleResetDrawing = useCallback(() => {
    setCommittedVertices([]);
    setCommittedPathSegments([]);
    setLivewirePath('');
    setLivewirePoints([]);
    setCompletedPoints(null);
    setCompletedSvgPath(null);
    setIsNearStartPoint(false);
  }, []);

  // Lắng nghe phím tắt: Enter (Khép kín), Esc (Hủy), Backspace (Undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleResetDrawing();
      } else if (e.key === 'Enter') {
        if (committedVertices.length >= 3) {
          e.preventDefault();
          handleFinishClosing();
        }
      } else if (
        e.key === 'Backspace' ||
        (e.key === 'z' && (e.ctrlKey || e.metaKey))
      ) {
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleResetDrawing, handleUndo, handleFinishClosing, committedVertices.length]);

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

      // Cấu kiện mới gán LUÔN LUÔN là PENDING (Chờ nghiệm thu).
      // Các trạng thái sau đó sẽ tự động cập nhật dựa trên luồng duyệt checklist & inspection.
      const currentStatus = activeSelectedId
        ? (existingObjects.find((o) => o.id === activeSelectedId)?.status || 'PENDING')
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

  const fullCommittedPath = useMemo(() => {
    return committedPathSegments.join(' ');
  }, [committedPathSegments]);

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
      {/* 1. THANH ĐIỀU KHIỂN CAD TOOLBAR TỐI GIẢN */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          background: 'rgba(30, 41, 59, 0.85)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10,
        }}
      >
        <Space size="middle">
          <Badge status="processing" color="#10b981" />
          <Text strong style={{ color: '#f8fafc', fontSize: 14 }}>
            {fileName}
          </Text>

          {!isImageFormat && totalPages > 1 ? (
            <Space size="small">
              <Button
                size="small"
                icon={<LeftOutlined />}
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              />
              <Tag color="cyan">Trang {currentPage} / {totalPages}</Tag>
              <Button
                size="small"
                icon={<RightOutlined />}
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              />
            </Space>
          ) : (
            <Tag color={isImageFormat ? 'gold' : 'cyan'}>
              {isImageFormat ? 'Tệp Ảnh' : `Trang ${currentPage}`}
            </Tag>
          )}

          {isSharpening && (
            <Tag color="blue" icon={<Spin size="small" />}>
              Đang làm nét...
            </Tag>
          )}

          {isComputingCV && (
            <Tag color="processing" icon={<Spin size="small" />}>
              Đang tính Cost Map...
            </Tag>
          )}

          {!readOnly && (
            <Tag color="#10b981" style={{ border: 'none', fontWeight: 600 }}>
              ⚡ Bám nét tự động
            </Tag>
          )}
        </Space>

        {/* Nút điều hướng Zoom & Thao tác tối giản */}
        <Space size="small">
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

          <Tag color="blue" style={{ minWidth: 55, textAlign: 'center' }}>
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
        </Space>
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
        {isLoadingPdf && (
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
              Đang tải và dựng bản vẽ siêu nét...
            </Text>
          </div>
        )}

        {/* Lớp hiển thị Bản vẽ Canvas + SVG Vector Overlay */}
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
          {/* Lớp 1: Canvas render PDF.js / Ảnh */}
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
              imageRendering: 'auto',
            }}
          />

          {/* Lớp 2: Lớp Vector SVG */}
          <svg
            viewBox={`0 0 ${sheetSize.width} ${sheetSize.height}`}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: sheetSize.width,
              height: sheetSize.height,
              overflow: 'visible',
              pointerEvents: isSpacePressed ? 'none' : 'auto',
            }}
            onClick={handleSheetClick}
            onDoubleClick={handleSheetDoubleClick}
          >
            {/* 2.1. Render các Object đã lưu từ trước */}
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
                    strokeWidth={isSelected ? 3.5 : 2}
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {isSelected && (
                    <path
                      d={obj.svgPath}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <text
                    x={obj.boundingBox.x + 8}
                    y={obj.boundingBox.y + 18}
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

            {/* 2.2. Render các đoạn Livewire đã chốt cố định */}
            {fullCommittedPath && (
              <path
                d={fullCommittedPath}
                fill="none"
                stroke="#10b981"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* 2.3. Render đoạn Livewire động đang hút bám nét */}
            {livewirePath && (
              <path
                d={livewirePath}
                fill="none"
                stroke={isNearStartPoint ? '#3b82f6' : '#22c55e'}
                strokeWidth={2}
                strokeDasharray={isLivewireSnapped ? undefined : '4 3'}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* 2.4. Render hình đã khép kín hoàn tất */}
            {completedSvgPath && (
              <path
                d={completedSvgPath}
                fill="#3b82f6"
                fillOpacity={0.28}
                stroke="#2563eb"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            )}

            {/* 2.5. Render các đỉnh chốt cố định & Vùng nhấp khép kín điểm đầu */}
            {committedVertices.map((v, i) => {
              const isStart = i === 0;
              const canClose = isStart && committedVertices.length >= 3;
              return (
                <g key={`vertex-g-${i}`}>
                  <circle
                    cx={v.x}
                    cy={v.y}
                    r={canClose ? Math.max(18, 28 / zoom) : 8}
                    fill="transparent"
                    style={{ cursor: canClose ? 'pointer' : 'crosshair' }}
                    onClick={(e) => {
                      if (canClose) {
                        e.stopPropagation();
                        handleFinishClosing();
                      }
                    }}
                  />
                  <circle
                    cx={v.x}
                    cy={v.y}
                    r={isStart && (isNearStartPoint || canClose) ? 7 : 4}
                    fill={isStart && (isNearStartPoint || canClose) ? '#3b82f6' : '#10b981'}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                    style={{ pointerEvents: 'none' }}
                  />
                  {canClose && (
                    <circle
                      cx={v.x}
                      cy={v.y}
                      r={Math.max(12, 16 / zoom)}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      strokeDasharray="3 3"
                      vectorEffect="non-scaling-stroke"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </g>
              );
            })}

            {/* 2.6. Render các đỉnh điều khiển để kéo tinh chỉnh khi đã khép kín */}
            {completedPoints &&
              completedPoints.map((p, i) => (
                <circle
                  key={`anchor-${i}`}
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill="#f59e0b"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                  style={{ cursor: 'move' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDraggingVertexIndex(i);
                  }}
                />
              ))}

            {/* 2.7. Vòng tròn chỉ thị lực hút Snap tại con trỏ chuột */}
            {cursorSheetPos && isDrawingMode && !completedPoints && !isSpacePressed && (
              <circle
                cx={cursorSheetPos.x}
                cy={cursorSheetPos.y}
                r={isLivewireSnapped ? 8 : 5}
                fill="none"
                stroke={isLivewireSnapped ? '#10b981' : 'rgba(255,255,255,0.6)'}
                strokeWidth={1.2}
                strokeDasharray={isLivewireSnapped ? undefined : '2 2'}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        </div>

        {/* 3. BẢNG HƯỚNG DẪN NHANH */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            padding: '6px 12px',
            background: 'rgba(15, 23, 42, 0.8)',
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
              <ThunderboltOutlined style={{ color: '#10b981' }} />{' '}
              Click điểm đầu (vòng xanh), ấn <b>Enter</b> hoặc <b>Double-Click</b> để khép kín đối tượng.
            </div>
            <div>
              <AimOutlined style={{ color: '#3b82f6' }} />{' '}
              <b>1 chạm ôm trọn:</b> Double-Click vào trong lòng cấu kiện để tự ôm khép kín biên dạng.
            </div>
          </Space>
        </div>
      </div>

      {/* 4. MODAL NHẬP THÔNG TIN OBJECT (Trạng thái luôn là PENDING) */}
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
          description="Vui lòng nhập Mã và Tên cấu kiện. Trạng thái nghiệm thu sẽ tự động bắt đầu từ 'Chờ nghiệm thu'."
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
              <Tag color="blue" style={{ fontSize: 13, padding: '2px 8px', margin: 0, fontWeight: 600 }}>
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
