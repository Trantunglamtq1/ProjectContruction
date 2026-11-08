import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Modal,
  Row,
  Col,
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Form,
  Input,
  InputNumber,
  Checkbox,
  Tabs,
  Popconfirm,
  Divider,
  message,
  Alert,
  Segmented,
  Tooltip,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  DesktopOutlined,
  CodeOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  FontSizeOutlined,
  NumberOutlined,
  DownSquareOutlined,
  CalendarOutlined,
  CheckSquareOutlined,
  UnorderedListOutlined,
  CopyOutlined,
  FileTextOutlined,
  BorderOutlined,
  AppstoreOutlined,
  ClearOutlined,
  AimOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import { DynamicFormIoRenderer } from './DynamicFormIoRenderer';
import { FORM_TEMPLATES, type FormTemplateOption } from './formTemplates';
import type { FormIoComponent, FormIoSchema } from '../../types/inspection';

interface HistorySnapshot {
  components: FormIoComponent[];
  selectedCompIndex: number | null;
  formTitle: string;
}

const { Text, Title, Paragraph } = Typography;

// Khổ thiết kế cơ sở (tương thích các form mẫu cũ). Khi mở ở chế độ toàn màn hình,
// canvas sẽ tự mở rộng theo bề rộng còn trống để không bị cắt mất các nút dài.
const CANVAS_W = 820;

/**
 * Tính toán kích thước bo gọn chuẩn xác theo độ lớn (fontSize) và độ dài của text
 */
export const calculateButtonFitSize = (label: string, fontSize = 13, hasIcon = true) => {
  const fs = fontSize || 13;
  let textWidth = 0;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `600 ${fs}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
      textWidth = ctx.measureText(label || '').width;
    }
  }
  if (!textWidth) {
    textWidth = (label || '').length * (fs * 0.7);
  }
  // Padding: icon (20px) + padding trái phải (24px) + khoảng đệm chữ (8px)
  const iconPadding = hasIcon ? 20 : 0;
  const fitW = Math.max(50, Math.ceil(textWidth + iconPadding + 32));
  const fitH = Math.max(28, Math.round(fs * 2.2));
  return { w: fitW, h: fitH };
};

interface FormIoBuilderModalProps {
  visible: boolean;
  initialSchema: FormIoSchema | null;
  onCancel: () => void;
  onSave: (updatedSchema: FormIoSchema) => void;
}

/* ========================================================================
 *  CanvasControl: Một phần tử trên lưới WinForms Designer
 * ======================================================================== */
const CanvasControl: React.FC<{
  item: FormIoComponent;
  index: number;
  isSelected: boolean;
  onSelect: (idx: number) => void;
  onStartMove: (e: React.MouseEvent, idx: number) => void;
  onStartResize: (e: React.MouseEvent, idx: number, dir: 'e' | 's' | 'se') => void;
  onDuplicate: (idx: number) => void;
  onDelete: (idx: number) => void;
  onQuickResize: (idx: number, dW: number, dH: number) => void;
  onFitToText: (idx: number) => void;
}> = ({
  item,
  index,
  isSelected,
  onSelect,
  onStartMove,
  onStartResize,
  onDuplicate,
  onDelete,
  onQuickResize,
  onFitToText,
}) => {
  const compX = item.x ?? 20;
  const compY = item.y ?? 20;
  const compW = item.w ?? item.width ?? 200;
  const compH = item.h ?? item.height ?? 40;
  const fs = item.fontSize || Math.max(11, Math.min(16, Math.round(compH * 0.35)));

  /* Mousedown trên wrapper -> MOVE (chỉ khi không bấm vào handle hay toolbar) */
  const handleWrapperMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-resize]')) return;
    if (target.closest('[data-toolbar]')) return;
    onSelect(index);
    onStartMove(e, index);
  };

  /* Render nội dung preview của control */
  const renderContent = () => {
    const common: React.CSSProperties = {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      boxSizing: 'border-box',
      pointerEvents: 'none',
      userSelect: 'none',
    };

    if (item.type === 'heading') {
      return (
        <div style={{ ...common, borderBottom: '2px solid #CBD5E1', gap: 6, padding: '0 4px' }}>
          <span
            style={{
              display: 'inline-block',
              width: 3,
              height: '60%',
              minHeight: 12,
              backgroundColor: '#1677FF',
              borderRadius: 1,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontWeight: 700,
              fontSize: fs,
              color: '#1E293B',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
          >
            {item.label}
          </span>
        </div>
      );
    }

    if (item.type === 'button') {
      const bg = item.buttonTheme === 'danger' ? '#FF4D4F' : item.buttonTheme === 'default' ? '#FFFFFF' : '#1677FF';
      const fg = item.buttonTheme === 'default' ? '#1E293B' : '#FFFFFF';
      const border = item.buttonTheme === 'default' ? '1px solid #D1D5DB' : 'none';
      return (
        <div
          style={{
            ...common,
            justifyContent: 'center',
            backgroundColor: bg,
            color: fg,
            border,
            borderRadius: 6,
            fontWeight: 600,
            fontSize: fs,
            padding: '0 12px',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            cursor: 'default',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            transition: 'background-color 0.2s',
          }}
        >
          {item.label}
        </div>
      );
    }

    if (item.type === 'checkbox') {
      return (
        <div style={{ ...common, gap: 6, padding: '0 4px' }}>
          <span
            style={{
              width: 14,
              height: 14,
              border: '2px solid #1677FF',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ width: 8, height: 8, backgroundColor: '#1677FF', borderRadius: 1 }} />
          </span>
          <span
            style={{
              fontSize: Math.max(11, fs - 1),
              color: '#374151',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
            }}
          >
            {item.label}
          </span>
        </div>
      );
    }

    if (item.type === 'radio') {
      return (
        <div
          style={{
            ...common,
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '2px 4px',
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#475569',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden',
              width: '100%',
            }}
          >
            {item.label}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <span
              style={{
                padding: '1px 8px',
                borderRadius: 4,
                backgroundColor: '#DCFCE7',
                color: '#166534',
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              Đạt
            </span>
            <span
              style={{
                padding: '1px 8px',
                borderRadius: 4,
                backgroundColor: '#FEE2E2',
                color: '#991B1B',
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              Không đạt
            </span>
          </div>
        </div>
      );
    }

    // Các trường ô text, số đo, combo, ngày giờ
    const labelH = Math.min(16, Math.max(12, Math.round(compH * 0.3)));
    const inputH = Math.max(18, compH - labelH - 6);
    return (
      <div
        style={{
          ...common,
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          padding: '2px 4px',
          gap: 2,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#475569',
            lineHeight: `${labelH}px`,
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {item.label} {item.validate?.required && <span style={{ color: '#EF4444' }}>*</span>}
        </div>
        <div
          style={{
            flex: 1,
            minHeight: inputH,
            height: inputH,
            border: '1px solid #D1D5DB',
            borderRadius: 4,
            backgroundColor: '#F9FAFB',
            padding: '2px 8px',
            fontSize: Math.max(10, fs - 2),
            color: '#9CA3AF',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
          }}
        >
          {item.placeholder || item.label}
          {item.suffix && <span style={{ marginLeft: 'auto', color: '#6B7280', fontSize: 10 }}>{item.suffix}</span>}
        </div>
      </div>
    );
  };

  return (
    <div
      onMouseDown={handleWrapperMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(index);
      }}
      style={{
        position: 'absolute',
        left: compX,
        top: compY,
        width: compW,
        height: compH,
        outline: isSelected ? '2px solid #1677FF' : '1px dashed #CBD5E1',
        outlineOffset: isSelected ? 0 : -1,
        backgroundColor: isSelected ? 'rgba(239,246,255,0.6)' : 'rgba(255,255,255,0.85)',
        borderRadius: 4,
        cursor: 'move',
        boxShadow: isSelected ? '0 4px 14px rgba(22,119,255,0.25)' : '0 1px 3px rgba(0,0,0,0.06)',
        zIndex: isSelected ? 30 : 10,
        overflow: 'visible',
      }}
    >
      {/* Nội dung control */}
      {renderContent()}

      {/* Thanh toolbar nổi khi được chọn */}
      {isSelected && (
        <div
          data-toolbar="true"
          style={{
            position: 'absolute',
            top: -28,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 60,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Badge tọa độ & kích thước */}
          <div
            style={{
              backgroundColor: '#1677FF',
              color: '#FFF',
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 3,
              whiteSpace: 'nowrap',
              lineHeight: '18px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              display: 'flex',
              gap: 4,
            }}
          >
            <span>{compX},{compY}</span>
            <span>·</span>
            <span>{compW}×{compH}</span>
          </div>

          {/* Nhóm nút tác vụ nhanh */}
          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {item.type === 'button' && (
              <Tooltip title="Bo gọn phạm vi theo độ dài & cỡ chữ bên trong">
                <button
                  onClick={() => onFitToText(index)}
                  style={{
                    ...qBtnStyle,
                    width: 'auto',
                    padding: '0 8px',
                    backgroundColor: '#10B981',
                    color: '#FFF',
                    fontWeight: 600,
                    fontSize: 10,
                    borderColor: '#059669',
                  }}
                >
                  Bo gọn text
                </button>
              </Tooltip>
            )}
            <Tooltip title="Thu nhỏ kích thước (-20px rộng, -4px cao)">
              <button onClick={() => onQuickResize(index, -20, -4)} style={qBtnStyle}>−</button>
            </Tooltip>
            <Tooltip title="Phóng to kích thước (+20px rộng, +4px cao)">
              <button onClick={() => onQuickResize(index, 20, 4)} style={qBtnStyle}>+</button>
            </Tooltip>
            <Tooltip title="Nhân bản (Duplicate)">
              <button
                onClick={() => onDuplicate(index)}
                style={{ ...qBtnStyle, backgroundColor: '#1677FF', color: '#FFF', borderColor: '#1677FF' }}
              >
                <CopyOutlined style={{ fontSize: 10 }} />
              </button>
            </Tooltip>
            <Tooltip title="Xóa">
              <button
                onClick={() => onDelete(index)}
                style={{ ...qBtnStyle, backgroundColor: '#FF4D4F', color: '#FFF', borderColor: '#FF4D4F' }}
              >
                <DeleteOutlined style={{ fontSize: 10 }} />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Resize handles: Nằm ngoài content, z-index cao, hit area lớn để dễ kéo */}
      {isSelected && (
        <>
          {/* Cạnh phải: Thay đổi Width (ew-resize) */}
          <div
            data-resize="e"
            title="Kéo cạnh phải để thay đổi chiều Rộng (Width)"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartResize(e, index, 'e');
            }}
            style={{
              position: 'absolute',
              right: -8,
              top: 0,
              bottom: 0,
              width: 16,
              cursor: 'ew-resize',
              zIndex: 70,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 6,
                height: 24,
                backgroundColor: '#1677FF',
                borderRadius: 3,
                border: '1.5px solid #FFF',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}
            />
          </div>

          {/* Cạnh đáy: Thay đổi Height (ns-resize) */}
          <div
            data-resize="s"
            title="Kéo đáy để thay đổi chiều Cao (Height)"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartResize(e, index, 's');
            }}
            style={{
              position: 'absolute',
              bottom: -8,
              left: 0,
              right: 0,
              height: 16,
              cursor: 'ns-resize',
              zIndex: 70,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                height: 6,
                width: 24,
                backgroundColor: '#1677FF',
                borderRadius: 3,
                border: '1.5px solid #FFF',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }}
            />
          </div>

          {/* Góc dưới phải: Thay đổi cả Width và Height (nwse-resize) */}
          <div
            data-resize="se"
            title="Kéo góc để thu to nhỏ cả Rộng và Cao"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onStartResize(e, index, 'se');
            }}
            style={{
              position: 'absolute',
              right: -10,
              bottom: -10,
              width: 22,
              height: 22,
              cursor: 'nwse-resize',
              zIndex: 75,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 13,
                height: 13,
                backgroundColor: '#1677FF',
                borderRadius: '50%',
                border: '2px solid #FFF',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};

/* Style nút bấm nhanh trên toolbar */
const qBtnStyle: React.CSSProperties = {
  minWidth: 22,
  height: 20,
  border: '1px solid #CBD5E1',
  borderRadius: 3,
  backgroundColor: '#FFF',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 4px',
  lineHeight: 1,
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
};

/* ========================================================================
 *  MAIN BUILDER MODAL
 * ======================================================================== */
export const FormIoBuilderModal: React.FC<FormIoBuilderModalProps> = ({
  visible,
  initialSchema,
  onCancel,
  onSave,
}) => {
  const [components, setComponents] = useState<FormIoComponent[]>([]);
  const [selectedCompIndex, setSelectedCompIndex] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState<string>('Biểu mẫu tùy chỉnh');
  const [templateModalOpen, setTemplateModalOpen] = useState<boolean>(false);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [editForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState<'designer' | 'preview' | 'json'>('designer');
  const [previewData, setPreviewData] = useState<Record<string, any>>({});
  const isInitializedRef = useRef(false);

  // Canvas mở rộng theo không gian còn trống (full-screen page)
  const [canvasWidth, setCanvasWidth] = useState<number>(CANVAS_W);
  const [canvasMinHeight, setCanvasMinHeight] = useState<number>(680);
  const canvasWidthRef = useRef<number>(CANVAS_W);
  const canvasViewportRef = useRef<HTMLDivElement>(null);

  // Undo / Redo
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const historyRef = useRef<HistorySnapshot[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isApplyingHistoryRef = useRef(false);
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formTitleRef = useRef(formTitle);
  const selectedCompIndexRef = useRef(selectedCompIndex);

  // Ref luôn lưu bản mới nhất của components để đọc đồng bộ khi bắt đầu kéo rê
  const componentsRef = useRef<FormIoComponent[]>(components);
  useEffect(() => {
    componentsRef.current = components;
  }, [components]);

  useEffect(() => {
    formTitleRef.current = formTitle;
  }, [formTitle]);

  useEffect(() => {
    selectedCompIndexRef.current = selectedCompIndex;
  }, [selectedCompIndex]);

  /* Đo bề rộng vùng canvas để canvas luôn rộng tối đa theo màn hình */
  useEffect(() => {
    if (!visible) return;
    const el = canvasViewportRef.current;
    if (!el) return;

    const update = () => {
      const w = Math.max(CANVAS_W, Math.floor(el.clientWidth - 32));
      if (w !== canvasWidthRef.current) {
        canvasWidthRef.current = w;
        setCanvasWidth(w);
      }
      const h = Math.max(680, Math.floor(el.clientHeight - 32));
      setCanvasMinHeight((prev) => (prev === h ? prev : h));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible, activeTab]);

  /* Khóa cuộn trang nền khi đang mở chế độ thiết kế toàn màn hình */
  useEffect(() => {
    if (!visible) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [visible]);

  /* ========================================================================
   *  UNDO / REDO HISTORY
   * ======================================================================== */
  const cloneComponents = (list: FormIoComponent[]): FormIoComponent[] =>
    JSON.parse(JSON.stringify(list || []));

  const syncHistoryButtons = useCallback(() => {
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(
      historyIndexRef.current >= 0 &&
        historyIndexRef.current < historyRef.current.length - 1
    );
  }, []);

  const pushHistory = useCallback((snap: HistorySnapshot) => {
    const hist = historyRef.current;
    const current = hist[historyIndexRef.current];
    const sameAsCurrent =
      !!current &&
      current.formTitle === snap.formTitle &&
      JSON.stringify(current.components) === JSON.stringify(snap.components);
    if (sameAsCurrent) return;

    // Cắt bỏ nhánh redo cũ khi có thay đổi mới
    hist.splice(historyIndexRef.current + 1);
    hist.push({
      components: cloneComponents(snap.components),
      selectedCompIndex: snap.selectedCompIndex,
      formTitle: snap.formTitle,
    });
    // Giới hạn bộ nhớ lịch sử
    if (hist.length > 100) hist.shift();
    historyIndexRef.current = hist.length - 1;
    syncHistoryButtons();
  }, [syncHistoryButtons]);

  /** Ghi nhận thay đổi đang chờ (debounce) trước khi undo/redo */
  const flushPendingHistory = useCallback(() => {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    if (historyIndexRef.current < 0) return;
    pushHistory({
      components: componentsRef.current,
      selectedCompIndex: selectedCompIndexRef.current,
      formTitle: formTitleRef.current,
    });
  }, [pushHistory]);

  const applySnapshot = useCallback((snap: HistorySnapshot) => {
    isApplyingHistoryRef.current = true;
    const cloned = cloneComponents(snap.components);
    componentsRef.current = cloned;
    setComponents(cloned);
    setFormTitle(snap.formTitle);
    setSelectedCompIndex(
      snap.selectedCompIndex !== null && snap.selectedCompIndex < cloned.length
        ? snap.selectedCompIndex
        : cloned.length > 0
          ? 0
          : null
    );
    syncHistoryButtons();
  }, [syncHistoryButtons]);

  const handleUndo = useCallback(() => {
    flushPendingHistory();
    const idx = historyIndexRef.current;
    if (idx <= 0) return;
    historyIndexRef.current = idx - 1;
    applySnapshot(historyRef.current[idx - 1]);
  }, [applySnapshot, flushPendingHistory]);

  const handleRedo = useCallback(() => {
    flushPendingHistory();
    const idx = historyIndexRef.current;
    if (idx < 0 || idx >= historyRef.current.length - 1) return;
    historyIndexRef.current = idx + 1;
    applySnapshot(historyRef.current[idx + 1]);
  }, [applySnapshot, flushPendingHistory]);

  /* Reset lịch sử khi đóng modal (khởi tạo lịch sử nằm trong effect khởi tạo modal) */
  useEffect(() => {
    if (visible) return;
    historyRef.current = [];
    historyIndexRef.current = -1;
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    setCanUndo(false);
    setCanRedo(false);
  }, [visible]);

  /* Tự động ghi nhận lịch sử (debounce) khi nội dung form thay đổi */
  useEffect(() => {
    if (!visible || historyIndexRef.current < 0) return;

    if (isApplyingHistoryRef.current) {
      isApplyingHistoryRef.current = false;
      return;
    }

    if (historyTimerRef.current) clearTimeout(historyTimerRef.current);
    historyTimerRef.current = setTimeout(() => {
      historyTimerRef.current = null;
      pushHistory({
        components,
        selectedCompIndex: selectedCompIndexRef.current,
        formTitle,
      });
    }, 350);

    return () => {
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
        historyTimerRef.current = null;
      }
    };
  }, [components, formTitle, visible, pushHistory]);

  /* Phím tắt Ctrl+Z / Ctrl+Y (và Ctrl+Shift+Z) */
  useEffect(() => {
    if (!visible) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Escape đóng trang thiết kế (trừ khi đang mở modal chọn mẫu)
      if (e.key === 'Escape') {
        if (!templateModalOpen) onCancel();
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = key === 'y' || (key === 'z' && e.shiftKey);
      if (!isUndo && !isRedo) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditingText =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        !!target?.isContentEditable;
      // Trong ô nhập liệu: để trình duyệt tự xử lý undo/redo của text
      if (isEditingText) return;

      e.preventDefault();
      if (isUndo) handleUndo();
      else handleRedo();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible, handleUndo, handleRedo, templateModalOpen, onCancel]);

  /** Thông báo dùng chung 1 key để không bị xếp chồng khi bấm nhiều lần */
  const notify = useCallback(
    (type: 'success' | 'error' | 'warning' | 'info', content: string) => {
      const key = 'formio-builder-notify';
      message.destroy(key);
      message[type]({ content, key, duration: 2 });
    },
    []
  );

  /* Khởi tạo modal */
  useEffect(() => {
    if (visible && !isInitializedRef.current) {
      isInitializedRef.current = true;
      if (initialSchema?.components && initialSchema.components.length > 0) {
        let curY = 20;
        const normalized = initialSchema.components.map((c) => {
          const comp = { ...c };
          if (comp.x === undefined || comp.y === undefined) {
            comp.x = 20;
            comp.y = curY;
            comp.w = comp.colSpan ? Math.round((comp.colSpan / 12) * 780) : 380;
            comp.h = comp.type === 'textarea' ? 80 : comp.type === 'button' ? 40 : comp.type === 'heading' ? 36 : 58;
            curY += (comp.h || 58) + 12;
          } else {
            comp.w = comp.w ?? comp.width ?? 380;
            comp.h = comp.h ?? comp.height ?? 58;
          }
          if (comp.type === 'button' && comp.autoFit === undefined) {
            comp.autoFit = true;
          }
          return comp;
        });
        setComponents(normalized);
        componentsRef.current = normalized;
        const nextTitle = initialSchema.title || 'Biểu mẫu tùy chỉnh';
        setFormTitle(nextTitle);
        setSelectedCompIndex(0);
        historyRef.current = [];
        historyIndexRef.current = -1;
        pushHistory({ components: normalized, selectedCompIndex: 0, formTitle: nextTitle });
      } else {
        const defaultTpl = FORM_TEMPLATES[1];
        const cloned = JSON.parse(JSON.stringify(defaultTpl.schema.components));
        setComponents(cloned);
        componentsRef.current = cloned;
        const nextTitle = defaultTpl.schema.title || 'Biên bản nghiệm thu';
        setFormTitle(nextTitle);
        setSelectedCompIndex(0);
        historyRef.current = [];
        historyIndexRef.current = -1;
        pushHistory({ components: cloned, selectedCompIndex: 0, formTitle: nextTitle });
      }
    } else if (!visible) {
      isInitializedRef.current = false;
    }
  }, [visible, initialSchema, pushHistory]);

  /* Đồng bộ Form Properties khi chọn component */
  useEffect(() => {
    if (selectedCompIndex !== null && components[selectedCompIndex]) {
      const comp = components[selectedCompIndex];
      editForm.setFieldsValue({
        label: comp.label,
        key: comp.key,
        x: comp.x ?? 20,
        y: comp.y ?? 20,
        w: comp.w ?? comp.width ?? 380,
        h: comp.h ?? comp.height ?? 58,
        fontSize: comp.fontSize,
        autoFit: comp.autoFit ?? (comp.type === 'button'),
        placeholder: comp.placeholder,
        suffix: comp.suffix,
        description: comp.description,
        buttonTheme: comp.buttonTheme || 'primary',
        required: comp.validate?.required || false,
        min: comp.validate?.min,
        max: comp.validate?.max,
        options: comp.values ? comp.values.map((v) => `${v.label}:${v.value}`).join('\n') : '',
      });
    }
  }, [selectedCompIndex, components, editForm]);

  /* Chọn Form mẫu */
  const handleSelectTemplate = (template: FormTemplateOption) => {
    const cloned = JSON.parse(JSON.stringify(template.schema.components));
    setComponents(cloned);
    componentsRef.current = cloned;
    setFormTitle(template.schema.title || template.name);
    setSelectedCompIndex(cloned.length > 0 ? 0 : null);
    setTemplateModalOpen(false);
    notify('success', `Đã áp dụng: ${template.name}`);
  };

  /* Thêm control từ Toolbox */
  const handleAddControl = (type: string) => {
    const ts = Date.now().toString().slice(-4);
    const g = snapToGrid ? 10 : 1;
    const maxY = components.reduce((acc, c) => Math.max(acc, (c.y || 0) + (c.h || 58)), 10);
    const nextY = Math.round((maxY + 15) / g) * g;

    let newComp: FormIoComponent;

    if (type === 'button') {
      const btnLabel = 'Nút Xác Nhận';
      const { w: fitW, h: fitH } = calculateButtonFitSize(btnLabel, 13);
      newComp = {
        key: `btn_${ts}`,
        label: btnLabel,
        type: 'button',
        buttonTheme: 'primary',
        x: 20,
        y: nextY,
        w: fitW,
        h: fitH,
        fontSize: 13,
        autoFit: true,
      };
    } else if (type === 'heading') {
      newComp = {
        key: `heading_${ts}`,
        label: 'TIÊU ĐỀ PHÂN ĐOẠN',
        type: 'heading',
        x: 20,
        y: nextY,
        w: 780,
        h: 36,
        fontSize: 13,
      };
    } else if (type === 'number') {
      newComp = {
        key: `num_${ts}`,
        label: 'Số đo kiểm tra *',
        type: 'number',
        suffix: 'cm',
        placeholder: 'VD: 12',
        x: 20,
        y: nextY,
        w: 220,
        h: 56,
        validate: { required: true, min: 0, max: 100 },
      };
    } else if (type === 'textarea') {
      newComp = {
        key: `ta_${ts}`,
        label: 'Ghi chú hiện trường',
        type: 'textarea',
        placeholder: 'Nhập ghi chú chi tiết...',
        x: 20,
        y: nextY,
        w: 780,
        h: 80,
      };
    } else if (type === 'select') {
      newComp = {
        key: `sel_${ts}`,
        label: 'Lựa chọn tiêu chuẩn *',
        type: 'select',
        values: [
          { label: 'Mác 250 (B20)', value: 'M250' },
          { label: 'Mác 300 (B22.5)', value: 'M300' },
          { label: 'Mác 350 (B25)', value: 'M350' },
        ],
        defaultValue: 'M300',
        x: 20,
        y: nextY,
        w: 360,
        h: 56,
        validate: { required: true },
      };
    } else if (type === 'radio') {
      newComp = {
        key: `radio_${ts}`,
        label: 'Đánh giá kỹ thuật *',
        type: 'radio',
        values: [
          { label: 'Đạt', value: 'Pass' },
          { label: 'Không đạt', value: 'Fail' },
        ],
        defaultValue: 'Pass',
        x: 20,
        y: nextY,
        w: 360,
        h: 56,
        validate: { required: true },
      };
    } else if (type === 'datetime') {
      newComp = {
        key: `dt_${ts}`,
        label: 'Thời gian nghiệm thu *',
        type: 'datetime',
        x: 20,
        y: nextY,
        w: 360,
        h: 56,
        validate: { required: true },
      };
    } else if (type === 'checkbox') {
      newComp = {
        key: `cb_${ts}`,
        label: 'Đã xác nhận CO/CQ & bản vẽ',
        type: 'checkbox',
        defaultValue: true,
        x: 20,
        y: nextY,
        w: 320,
        h: 34,
      };
    } else {
      newComp = {
        key: `tf_${ts}`,
        label: 'Trường văn bản *',
        type: 'textfield',
        placeholder: 'Nhập nội dung...',
        x: 20,
        y: nextY,
        w: 360,
        h: 56,
      };
    }

    const updated = [...components, newComp];
    setComponents(updated);
    componentsRef.current = updated;
    setSelectedCompIndex(updated.length - 1);
    notify('success', `Đã thêm "${newComp.label}" tại (${newComp.x}, ${newComp.y})`);
  };

  /* === DRAG MOVE: ĐỌC ĐỒNG BỘ TỪ componentsRef (Tránh lỗi async NaN) === */
  const handleStartMove = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const target = componentsRef.current[index];
    if (!target) return;

    setSelectedCompIndex(index);
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = target.x ?? 20;
    const initialY = target.y ?? 20;
    const compW = target.w ?? target.width ?? 200;

    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const g = snapToGrid ? 10 : 1;
      let nx = Math.max(0, initialX + (ev.clientX - startX));
      let ny = Math.max(0, initialY + (ev.clientY - startY));

      if (snapToGrid) {
        nx = Math.round(nx / g) * g;
        ny = Math.round(ny / g) * g;
      }
      if (nx + compW > canvasWidthRef.current) {
        nx = Math.max(0, canvasWidthRef.current - compW);
      }

      setComponents((prev) => {
        const l = [...prev];
        if (!l[index]) return prev;
        l[index] = { ...l[index], x: nx, y: ny };
        componentsRef.current = l;
        return l;
      });
      editForm.setFieldsValue({ x: nx, y: ny });
    };

    const onUp = () => {
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [snapToGrid, editForm]);

  /* === DRAG RESIZE: ĐỌC ĐỒNG BỘ TỪ componentsRef (Tránh lỗi async NaN) === */
  const handleStartResize = useCallback((e: React.MouseEvent, index: number, dir: 'e' | 's' | 'se') => {
    e.stopPropagation();
    e.preventDefault();
    const target = componentsRef.current[index];
    if (!target) return;

    setSelectedCompIndex(index);
    document.body.style.userSelect = 'none';

    const startX = e.clientX;
    const startY = e.clientY;
    const initialW = target.w ?? target.width ?? 200;
    const initialH = target.h ?? target.height ?? 40;
    const initialX = target.x ?? 20;

    const minW = target.type === 'button' ? 40 : target.type === 'heading' ? 60 : 70;
    const minH = target.type === 'heading' ? 24 : target.type === 'button' ? 26 : 30;

    const onMove = (ev: MouseEvent) => {
      ev.preventDefault();
      const g = snapToGrid ? 10 : 1;
      let nw = initialW;
      let nh = initialH;

      if (dir === 'e' || dir === 'se') {
        nw = Math.max(minW, initialW + (ev.clientX - startX));
        if (snapToGrid) nw = Math.round(nw / g) * g;
        if (initialX + nw > canvasWidthRef.current) nw = Math.max(minW, canvasWidthRef.current - initialX);
      }
      if (dir === 's' || dir === 'se') {
        nh = Math.max(minH, initialH + (ev.clientY - startY));
        if (snapToGrid) nh = Math.round(nh / g) * g;
      }

      setComponents((prev) => {
        const l = [...prev];
        if (!l[index]) return prev;
        // Người dùng đã tự kéo resize -> tắt autoFit để giữ nguyên kích thước họ muốn
        l[index] = { ...l[index], w: nw, h: nh, width: nw, height: nh, autoFit: false };
        componentsRef.current = l;
        return l;
      });
      editForm.setFieldsValue({ w: nw, h: nh, autoFit: false });
    };

    const onUp = () => {
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [snapToGrid, editForm]);

  /* === BO GỌN KÍCH THƯỚC NÚT THEO ĐỘ LỚN & ĐỘ DÀI CỦA TEXT === */
  const handleFitToText = useCallback((index: number) => {
    const target = componentsRef.current[index];
    if (!target) return;
    const fs = target.fontSize || 13;
    const { w: fitW, h: fitH } = calculateButtonFitSize(target.label || 'Nút bấm', fs);

    setComponents((prev) => {
      const l = [...prev];
      if (!l[index]) return prev;
      let nextW = fitW;
      const curX = l[index].x ?? 20;
      if (curX + nextW > canvasWidthRef.current) nextW = canvasWidthRef.current - curX;
      l[index] = { ...l[index], w: nextW, h: fitH, width: nextW, height: fitH, autoFit: true };
      componentsRef.current = l;
      return l;
    });
    editForm.setFieldsValue({ w: fitW, h: fitH, autoFit: true });
    notify('success', `Đã bo gọn nút theo text: ${fitW}×${fitH}px`);
  }, [editForm]);

  /* Đổi kích thước nhanh qua phím tắt (+/-) */
  const handleQuickResize = useCallback((index: number, dW: number, dH: number) => {
    setComponents((prev) => {
      const l = [...prev];
      const t = l[index];
      if (!t) return prev;
      const minW = t.type === 'button' ? 40 : 70;
      const minH = t.type === 'button' ? 26 : 30;
      let nw = Math.max(minW, (t.w ?? t.width ?? 200) + dW);
      const nh = Math.max(minH, (t.h ?? t.height ?? 40) + dH);
      if ((t.x ?? 0) + nw > canvasWidthRef.current) nw = canvasWidthRef.current - (t.x ?? 0);
      l[index] = { ...t, w: nw, h: nh, width: nw, height: nh, autoFit: false };
      componentsRef.current = l;
      editForm.setFieldsValue({ w: nw, h: nh, autoFit: false });
      return l;
    });
  }, [editForm]);

  /* Nhân bản control */
  const handleDuplicate = (index: number) => {
    const s = components[index];
    const ts = Date.now().toString().slice(-4);
    const copy: FormIoComponent = {
      ...s,
      key: `${s.key}_cp_${ts}`,
      label: `${s.label} (Copy)`,
      x: Math.min(canvasWidthRef.current - (s.w || 200), (s.x || 0) + 20),
      y: (s.y || 0) + 20,
    };
    const u = [...components, copy];
    setComponents(u);
    componentsRef.current = u;
    setSelectedCompIndex(u.length - 1);
    notify('success', `Đã nhân bản "${copy.label}"`);
  };

  /* Xóa control */
  const handleDelete = (index: number) => {
    const list = components.filter((_, i) => i !== index);
    setComponents(list);
    componentsRef.current = list;
    if (selectedCompIndex === index) {
      setSelectedCompIndex(list.length > 0 ? Math.min(index, list.length - 1) : null);
    } else if (selectedCompIndex !== null && selectedCompIndex > index) {
      setSelectedCompIndex(selectedCompIndex - 1);
    }
  };

  /* Cập nhật từ Properties Panel */
  const handleUpdateProperties = (values: any) => {
    if (selectedCompIndex === null) return;
    const cur = components[selectedCompIndex];
    if (!cur) return;

    let parsedValues = cur.values;
    if (values.options && (cur.type === 'select' || cur.type === 'radio')) {
      parsedValues = values.options
        .split('\n')
        .map((line: string) => {
          const p = line.split(':');
          return { label: p[0]?.trim() || line.trim(), value: p[1]?.trim() || p[0]?.trim() || line.trim() };
        })
        .filter((o: any) => o.label);
    }

    const v = (field: string, fallback: any) =>
      values[field] !== undefined && values[field] !== null ? Number(values[field]) : fallback;

    let finalW = v('w', cur.w ?? 380);
    let finalH = v('h', cur.h ?? 58);
    const newFs = values.fontSize !== undefined && values.fontSize !== null ? Number(values.fontSize) : cur.fontSize;

    // Nếu là button và bật chế độ tự động bo gọn (autoFit)
    const isAutoFit = cur.type === 'button' ? (values.autoFit ?? cur.autoFit ?? true) : false;
    if (cur.type === 'button' && isAutoFit) {
      const fit = calculateButtonFitSize(values.label ?? cur.label, newFs || 13);
      finalW = fit.w;
      finalH = fit.h;
      editForm.setFieldsValue({ w: finalW, h: finalH });
    }

    const updatedComp: FormIoComponent = {
      ...cur,
      label: values.label ?? cur.label,
      key: values.key || cur.key,
      x: v('x', cur.x ?? 20),
      y: v('y', cur.y ?? 20),
      w: finalW,
      h: finalH,
      width: finalW,
      height: finalH,
      fontSize: newFs,
      autoFit: isAutoFit,
      placeholder: values.placeholder,
      suffix: values.suffix,
      description: values.description,
      buttonTheme: values.buttonTheme,
      validate: { ...cur.validate, required: values.required, min: values.min, max: values.max },
      values: parsedValues,
    };

    const list = [...components];
    list[selectedCompIndex] = updatedComp;
    setComponents(list);
    componentsRef.current = list;
  };

  const handleSaveAll = () => {
    if (components.length === 0) {
      notify('error', 'Biểu mẫu phải có ít nhất 1 thành phần.');
      return;
    }
    onSave({ display: 'form', title: formTitle || 'Biểu mẫu tùy chỉnh', components });
    // Không hiển thị thêm thông báo ở đây: component cha đã thông báo khi lưu
  };

  const currentComp = selectedCompIndex !== null ? components[selectedCompIndex] : null;
  const maxCanvasY = components.reduce((acc, c) => Math.max(acc, (c.y || 0) + (c.h || 58)), 620);
  const canvasHeight = Math.max(maxCanvasY + 60, 680, canvasMinHeight);

  const getComponentIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      heading: <FontSizeOutlined style={{ color: '#8B5CF6' }} />,
      button: <BorderOutlined style={{ color: '#2563EB' }} />,
      number: <NumberOutlined style={{ color: '#0EA5E9' }} />,
      textarea: <UnorderedListOutlined style={{ color: '#F59E0B' }} />,
      select: <DownSquareOutlined style={{ color: '#10B981' }} />,
      radio: <CheckCircleOutlined style={{ color: '#14B8A6' }} />,
      datetime: <CalendarOutlined style={{ color: '#6366F1' }} />,
      checkbox: <CheckSquareOutlined style={{ color: '#3B82F6' }} />,
    };
    return icons[type] || <FileTextOutlined style={{ color: '#64748B' }} />;
  };

  return (
    <>
      {visible &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1350,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#F1F5F9',
            }}
          >
            <style>{`
              .formio-builder-tabs { height: 100%; display: flex; flex-direction: column; }
              .formio-builder-tabs > .ant-tabs-nav { flex: 0 0 auto; margin-bottom: 8px; }
              .formio-builder-tabs > .ant-tabs-body-holder { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
              .formio-builder-tabs .ant-tabs-body { flex: 1 1 auto; min-height: 0; }
              .formio-builder-tabs .ant-tabs-content { height: 100%; }
              .formio-builder-tabs .ant-tabs-content > div { height: 100%; }

              .formio-builder-toolbox { width: 190px; }
              .formio-builder-props { width: 300px; }
              @media (max-width: 1500px) {
                .formio-builder-toolbox { width: 175px; }
                .formio-builder-props { width: 280px; }
              }
              @media (max-width: 1200px) {
                .formio-builder-toolbox { width: 155px; }
                .formio-builder-props { width: 245px; }
              }
            `}</style>

            {/* HEADER: tiêu đề + thao tác */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                rowGap: 8,
                columnGap: 16,
                padding: '10px 16px',
                backgroundColor: '#FFFFFF',
                borderBottom: '1px solid #E2E8F0',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 380px' }}>
                <ToolOutlined style={{ color: '#1677FF', fontSize: 22, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#1F2937',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      Visual WinForms Form Designer
                    </span>
                    <Tag color="blue" style={{ marginInlineEnd: 0 }}>Toàn màn hình</Tag>
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Kéo thả tự do • Kéo cạnh/góc để đổi kích thước • Nút tự bo gọn theo text
                  </Text>
                </div>
              </div>
              <Space size={8} wrap style={{ flexShrink: 0, maxWidth: '100%' }}>
                <Tooltip title="Hoàn tác (Ctrl+Z)">
                  <Button
                    icon={<UndoOutlined />}
                    onClick={handleUndo}
                    disabled={!canUndo}
                  >
                    Hoàn tác
                  </Button>
                </Tooltip>
                <Tooltip title="Làm lại (Ctrl+Y hoặc Ctrl+Shift+Z)">
                  <Button
                    icon={<RedoOutlined />}
                    onClick={handleRedo}
                    disabled={!canRedo}
                  >
                    Làm lại
                  </Button>
                </Tooltip>
                <Button
                  type="primary"
                  ghost
                  icon={<AppstoreOutlined />}
                  onClick={() => setTemplateModalOpen(true)}
                  style={{ fontWeight: 600 }}
                >
                  Form Mẫu ({FORM_TEMPLATES.length})
                </Button>
                <Popconfirm
                  title="Xóa trắng toàn bộ biểu mẫu?"
                  onConfirm={() => {
                    setComponents([]);
                    componentsRef.current = [];
                    setSelectedCompIndex(null);
                  }}
                  okText="Xóa"
                  cancelText="Hủy"
                >
                  <Button icon={<ClearOutlined />} danger>
                    Xóa trắng
                  </Button>
                </Popconfirm>
                <Divider type="vertical" style={{ height: 28, margin: 0 }} />
                <Button onClick={onCancel}>Hủy</Button>
                <Button type="primary" onClick={handleSaveAll}>
                  Áp dụng Biểu mẫu này
                </Button>
              </Space>
            </div>

            {/* BODY: tabs chiếm toàn bộ chiều cao còn lại */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                padding: '10px 16px 14px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Tabs
                className="formio-builder-tabs"
                activeKey={activeTab}
                onChange={(k) => setActiveTab(k as any)}
                items={[
            {
              key: 'designer',
              label: (
                <Space>
                  <ToolOutlined />
                  <span style={{ fontWeight: 600 }}>1. Canvas Thiết Kế WinForms</span>
                  <Tag color="blue">{components.length} phần tử</Tag>
                </Space>
              ),
              children: (
                <div
                  style={{
                    userSelect: 'none',
                    height: '100%',
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Thanh điều khiển trên đỉnh canvas */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      rowGap: 8,
                      columnGap: 16,
                      padding: '8px 12px',
                      backgroundColor: '#F1F5F9',
                      borderRadius: 6,
                      marginBottom: 10,
                      border: '1px solid #E2E8F0',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 1 400px', minWidth: 240 }}>
                      <Text strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Tên Biểu mẫu:</Text>
                      <Input
                        size="small"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        style={{ flex: 1, minWidth: 140, fontWeight: 600 }}
                      />
                    </div>
                    <Space size={16} wrap style={{ flexShrink: 0, maxWidth: '100%' }}>
                      <Checkbox checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)}>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>Hít lưới 10px (Snap to Grid)</span>
                      </Checkbox>
                      <span style={{ fontSize: 12, color: '#64748B' }}>
                        Khổ Canvas: <b>{canvasWidth}px</b> × <b>{canvasHeight}px</b>
                      </span>
                      <span style={{ fontSize: 12, color: '#64748B' }}>
                        Hoàn tác: <b>Ctrl+Z</b> · Làm lại: <b>Ctrl+Y</b>
                      </span>
                    </Space>
                  </div>

                  {/* 3 Khối: Toolbox, Canvas, Properties */}
                  <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
                    {/* KHỐI 1: TOOLBOX */}
                    <div
                      className="formio-builder-toolbox"
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 8,
                        flexShrink: 0,
                        minHeight: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#475569',
                          textTransform: 'uppercase',
                          marginBottom: 8,
                          paddingBottom: 4,
                          borderBottom: '1px solid #E2E8F0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <ToolOutlined /> Toolbox
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, overflowY: 'auto' }}>
                        {[
                          { type: 'button', icon: <BorderOutlined style={{ color: '#2563EB' }} />, label: '+ Nút bấm', color: '#1D4ED8' },
                          { type: 'heading', icon: <FontSizeOutlined style={{ color: '#8B5CF6' }} />, label: '+ Tiêu đề mục' },
                          { type: 'textfield', icon: <FileTextOutlined style={{ color: '#1677FF' }} />, label: '+ Ô Text (Chuỗi)' },
                          { type: 'number', icon: <NumberOutlined style={{ color: '#0EA5E9' }} />, label: '+ Ô nhập Số đo' },
                          { type: 'textarea', icon: <UnorderedListOutlined style={{ color: '#F59E0B' }} />, label: '+ Ghi chú nhiều dòng' },
                          { type: 'select', icon: <DownSquareOutlined style={{ color: '#10B981' }} />, label: '+ ComboBox (Chọn)' },
                          { type: 'radio', icon: <CheckCircleOutlined style={{ color: '#14B8A6' }} />, label: '+ Đạt / Không đạt' },
                          { type: 'datetime', icon: <CalendarOutlined style={{ color: '#6366F1' }} />, label: '+ Ngày & Giờ' },
                          { type: 'checkbox', icon: <CheckSquareOutlined style={{ color: '#3B82F6' }} />, label: '+ CheckBox (Hộp kiểm)' },
                        ].map((t) => (
                          <Button
                            key={t.type}
                            size="small"
                            block
                            icon={t.icon}
                            onClick={() => handleAddControl(t.type)}
                            style={{ textAlign: 'left', fontWeight: 500, color: t.color }}
                          >
                            {t.label}
                          </Button>
                        ))}
                      </div>
                      <div
                        style={{
                          marginTop: 'auto',
                          paddingTop: 8,
                          borderTop: '1px solid #E2E8F0',
                          fontSize: 11,
                          color: '#64748B',
                          lineHeight: 1.35,
                        }}
                      >
                        <b>Hướng dẫn WinForms:</b>
                        <br />• Kéo tự do trên lưới.
                        <br />• Kéo cạnh/góc đổi kích thước.
                        <br />• Bấm <b>Bo gọn text</b> để nút ôm khít chữ.
                      </div>
                    </div>

                    {/* KHỐI 2: CANVAS */}
                    <div
                      ref={canvasViewportRef}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        backgroundColor: '#334155',
                        borderRadius: 6,
                        overflow: 'auto',
                        padding: 16,
                        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.2)',
                      }}
                      onClick={() => setSelectedCompIndex(null)}
                    >
                      <div
                        style={{
                          position: 'relative',
                          margin: '0 auto',
                          width: canvasWidth,
                          height: canvasHeight,
                          backgroundColor: '#FFFFFF',
                          borderRadius: 4,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                          backgroundImage: 'radial-gradient(circle, #CBD5E1 1.2px, transparent 1.2px)',
                          backgroundSize: '20px 20px',
                          flexShrink: 0,
                        }}
                      >
                        {components.length === 0 ? (
                          <div
                            style={{
                              position: 'absolute',
                              top: '40%',
                              left: '50%',
                              transform: 'translate(-50%,-50%)',
                              textAlign: 'center',
                              color: '#94A3B8',
                            }}
                          >
                            <AimOutlined style={{ fontSize: 48, marginBottom: 12, color: '#CBD5E1' }} />
                            <div style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>
                              Canvas WinForms Trống
                            </div>
                            <div style={{ fontSize: 13, marginTop: 4 }}>
                              Bấm linh kiện từ Toolbox bên trái hoặc chọn Form mẫu có sẵn.
                            </div>
                          </div>
                        ) : (
                          components.map((item, index) => (
                            <CanvasControl
                              key={item.key || index}
                              item={item}
                              index={index}
                              isSelected={selectedCompIndex === index}
                              onSelect={setSelectedCompIndex}
                              onStartMove={handleStartMove}
                              onStartResize={handleStartResize}
                              onDuplicate={handleDuplicate}
                              onDelete={handleDelete}
                              onQuickResize={handleQuickResize}
                              onFitToText={handleFitToText}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    {/* KHỐI 3: PROPERTIES PANEL */}
                    <div
                      className="formio-builder-props"
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 10,
                        flexShrink: 0,
                        overflowY: 'auto',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#475569',
                          textTransform: 'uppercase',
                          marginBottom: 8,
                          paddingBottom: 4,
                          borderBottom: '1px solid #E2E8F0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <EditOutlined /> Properties {currentComp && getComponentIcon(currentComp.type)}
                      </div>

                      {currentComp ? (
                        <Form
                          form={editForm}
                          layout="vertical"
                          size="small"
                          onValuesChange={(_, all) => handleUpdateProperties(all)}
                        >
                          <div
                            style={{
                              backgroundColor: '#E2E8F0',
                              padding: '4px 8px',
                              borderRadius: 4,
                              marginBottom: 8,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            Layout & Tọa độ (Pixel)
                          </div>

                          <Row gutter={6}>
                            <Col span={12}>
                              <Form.Item label="X (Left)" name="x" style={{ marginBottom: 6 }}>
                                <InputNumber style={{ width: '100%' }} min={0} max={canvasWidth} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item label="Y (Top)" name="y" style={{ marginBottom: 6 }}>
                                <InputNumber style={{ width: '100%' }} min={0} />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Row gutter={6}>
                            <Col span={12}>
                              <Form.Item label="Width (Rộng)" name="w" style={{ marginBottom: 6 }}>
                                <InputNumber style={{ width: '100%' }} min={30} max={canvasWidth} />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item label="Height (Cao)" name="h" style={{ marginBottom: 6 }}>
                                <InputNumber style={{ width: '100%' }} min={20} max={600} />
                              </Form.Item>
                            </Col>
                          </Row>

                          {/* Đối với nút bấm: Tính năng bo gọn theo text */}
                          {currentComp.type === 'button' && (
                            <div
                              style={{
                                backgroundColor: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                padding: '6px 8px',
                                borderRadius: 4,
                                marginBottom: 8,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#1E40AF' }}>
                                  Bo gọn theo chữ:
                                </span>
                                <Button
                                  size="small"
                                  type="primary"
                                  onClick={() => handleFitToText(selectedCompIndex!)}
                                  style={{ height: 22, fontSize: 11, padding: '0 8px' }}
                                >
                                  Bo gọn ngay
                                </Button>
                              </div>
                              <Form.Item name="autoFit" valuePropName="checked" style={{ marginBottom: 0 }}>
                                <Checkbox>
                                  <span style={{ fontSize: 11, color: '#1E3A8A' }}>
                                    Tự động ôm khít khi đổi chữ / cỡ chữ
                                  </span>
                                </Checkbox>
                              </Form.Item>
                            </div>
                          )}

                          <Form.Item label="Cỡ chữ (Font Size px)" name="fontSize" style={{ marginBottom: 6 }}>
                            <InputNumber style={{ width: '100%' }} min={10} max={36} placeholder="Tự động theo chiều cao" />
                          </Form.Item>

                          <div
                            style={{
                              backgroundColor: '#E2E8F0',
                              padding: '4px 8px',
                              borderRadius: 4,
                              marginBottom: 8,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            Dữ liệu & Hiển thị
                          </div>

                          <Form.Item label="Nhãn (Text / Label)" name="label" rules={[{ required: true, message: 'Nhập nhãn' }]} style={{ marginBottom: 6 }}>
                            <Input />
                          </Form.Item>

                          <Form.Item label="Mã trường (Key)" name="key" rules={[{ required: true, message: 'Nhập key' }]} style={{ marginBottom: 6 }}>
                            <Input />
                          </Form.Item>

                          {currentComp.type === 'button' && (
                            <Form.Item label="Màu sắc Nút Bấm" name="buttonTheme" style={{ marginBottom: 6 }}>
                              <Segmented
                                block
                                options={[
                                  { label: 'Primary', value: 'primary' },
                                  { label: 'Default', value: 'default' },
                                  { label: 'Danger', value: 'danger' },
                                ]}
                              />
                            </Form.Item>
                          )}

                          {currentComp.type !== 'heading' && currentComp.type !== 'button' && (
                            <>
                              <Form.Item label="Gợi ý (Placeholder)" name="placeholder" style={{ marginBottom: 6 }}>
                                <Input />
                              </Form.Item>
                              <Form.Item label="Đơn vị / Hậu tố" name="suffix" style={{ marginBottom: 6 }}>
                                <Input placeholder="cm, MPa, kg..." />
                              </Form.Item>
                              <Form.Item name="required" valuePropName="checked" style={{ marginBottom: 6 }}>
                                <Checkbox>
                                  <span style={{ fontWeight: 600 }}>Bắt buộc nhập</span>
                                </Checkbox>
                              </Form.Item>
                            </>
                          )}

                          {(currentComp.type === 'select' || currentComp.type === 'radio') && (
                            <Form.Item
                              label="Tùy chọn (Mỗi dòng một mục 'Nhãn:Giá trị')"
                              name="options"
                              style={{ marginBottom: 6 }}
                            >
                              <Input.TextArea rows={3} />
                            </Form.Item>
                          )}

                          {currentComp.type === 'number' && (
                            <Row gutter={6}>
                              <Col span={12}>
                                <Form.Item label="Min" name="min" style={{ marginBottom: 6 }}>
                                  <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item label="Max" name="max" style={{ marginBottom: 6 }}>
                                  <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                            </Row>
                          )}

                          <Form.Item label="Mô tả / Hướng dẫn thêm" name="description" style={{ marginBottom: 6 }}>
                            <Input.TextArea rows={2} />
                          </Form.Item>
                        </Form>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px 10px', color: '#94A3B8' }}>
                          <EditOutlined style={{ fontSize: 28, marginBottom: 8 }} />
                          <div style={{ fontSize: 12 }}>
                            Bấm vào bất kỳ nút bấm hoặc ô nhập trên Canvas để tùy chỉnh tọa độ, kích thước và thuộc tính.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ),
            },
            {
              key: 'preview',
              label: (
                <Space>
                  <DesktopOutlined />
                  <span style={{ fontWeight: 600 }}>2. Xem Trước Trực Tiếp</span>
                </Space>
              ),
              children: (
                <div style={{ height: '100%', overflow: 'auto', paddingRight: 4 }}>
                  <Card
                    title={<Text strong>Giao diện Biểu mẫu Người dùng sẽ nghiệm thu</Text>}
                    style={{ borderRadius: 8 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                      <DynamicFormIoRenderer
                        schema={{ display: 'form', title: formTitle, components }}
                        initialData={previewData}
                        onChange={(d) => setPreviewData(d)}
                      />
                    </div>
                    <Divider />
                    <Text strong>Dữ liệu Form:</Text>
                    <pre
                      style={{
                        backgroundColor: '#0F172A',
                        color: '#38BDF8',
                        padding: 12,
                        borderRadius: 6,
                        maxHeight: 140,
                        overflow: 'auto',
                        fontSize: 12,
                        marginTop: 6,
                      }}
                    >
                      {JSON.stringify(previewData, null, 2)}
                    </pre>
                  </Card>
                </div>
              ),
            },
            {
              key: 'json',
              label: (
                <Space>
                  <CodeOutlined />
                  <span style={{ fontWeight: 600 }}>3. JSON Schema</span>
                </Space>
              ),
              children: (
                <div style={{ height: '100%', overflow: 'auto', paddingRight: 4 }}>
                  <Card
                    title="FormIO JSON Schema"
                    extra={
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify({ display: 'form', title: formTitle, components }, null, 2)
                          );
                          notify('success', 'Đã sao chép JSON Schema!');
                        }}
                      >
                        Sao chép JSON
                      </Button>
                    }
                  >
                    <pre
                      style={{
                        backgroundColor: '#0F172A',
                        color: '#4ADE80',
                        padding: 16,
                        borderRadius: 6,
                        maxHeight: 'calc(100vh - 260px)',
                        overflow: 'auto',
                        fontSize: 12,
                      }}
                    >
                      {JSON.stringify({ display: 'form', title: formTitle, components }, null, 2)}
                    </pre>
                  </Card>
                </div>
              ),
            },
          ]}
              />
            </div>
          </div>,
          document.body
        )}

      {/* MODAL CHỌN FORM MẪU */}
      <Modal
        title={
          <Space align="center">
            <AppstoreOutlined style={{ color: '#1677FF', fontSize: 20 }} />
            <Title level={4} style={{ margin: 0, fontSize: 16 }}>
              Thư Viện Form Mẫu Nghiệm Thu Công Trường (WinForms Layout)
            </Title>
          </Space>
        }
        open={templateModalOpen}
        onCancel={() => setTemplateModalOpen(false)}
        footer={null}
        width={780}
        zIndex={1400}
        centered
      >
        <Alert
          message="Chọn Form mẫu hoặc bắt đầu với Canvas trống."
          description="Các mẫu được thiết kế sẵn tọa độ WinForms. Bạn có thể tự do kéo di chuyển, bo gọn nút hoặc co giãn các ô text."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Row gutter={[16, 16]}>
          {FORM_TEMPLATES.map((tpl) => (
            <Col span={12} key={tpl.id}>
              <Card
                hoverable
                onClick={() => handleSelectTemplate(tpl)}
                style={{
                  height: '100%',
                  borderRadius: 8,
                  border: tpl.id === 'blank' ? '2px dashed #94A3B8' : '1px solid #E2E8F0',
                }}
                styles={{ body: { padding: 14 } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>{tpl.icon}</span>
                  <Text strong style={{ fontSize: 14 }}>{tpl.name}</Text>
                </div>
                <Tag color={tpl.id === 'blank' ? 'default' : 'blue'} style={{ marginBottom: 8 }}>
                  {tpl.category}
                </Tag>
                <Paragraph type="secondary" style={{ fontSize: 12, minHeight: 36, marginBottom: 12 }}>
                  {tpl.description}
                </Paragraph>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    <b>{tpl.schema.components.length}</b> phần tử
                  </span>
                  <Button size="small" type="primary" ghost>
                    Áp dụng →
                  </Button>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Modal>
    </>
  );
};

export default FormIoBuilderModal;
