import type { Point } from './types';

export interface Circle3P {
  center: Point;
  radius: number;
  sweepFlag: 0 | 1;
  isValid: boolean;
}

/**
 * Giải phương trình đường tròn ngoại tiếp đi qua 3 điểm P1, P2, P3
 * Sử dụng định thức và phương pháp giải hệ Cramer cho hai đường trung trực.
 */
export function solveCircumcircle(p1: Point, p2: Point, p3: Point): Circle3P | null {
  // Vector p1 -> p2 và p2 -> p3
  const a1 = p2.x - p1.x;
  const b1 = p2.y - p1.y;
  const c1 = (p2.x * p2.x + p2.y * p2.y - (p1.x * p1.x + p1.y * p1.y)) / 2;

  const a2 = p3.x - p2.x;
  const b2 = p3.y - p2.y;
  const c2 = (p3.x * p3.x + p3.y * p3.y - (p2.x * p2.x + p2.y * p2.y)) / 2;

  // Định thức chính det = a1 * b2 - b1 * a2
  // Trong hệ tọa độ màn hình (Y hướng xuống):
  // det > 0 tương đương rẽ phải (Clockwise)
  // det < 0 tương đương rẽ trái (Counter-Clockwise)
  const det = a1 * b2 - b1 * a2;

  // Ba điểm thẳng hàng hoặc quá gần nhau
  if (Math.abs(det) < 1e-5) {
    return null;
  }

  const cx = (c1 * b2 - b1 * c2) / det;
  const cy = (a1 * c2 - c1 * a2) / det;

  const radius = Math.hypot(p1.x - cx, p1.y - cy);

  // Nếu bán kính quá lớn (> 50.000px) hoặc quá nhỏ, coi như đoạn thẳng
  if (!isFinite(radius) || radius > 50000 || radius < 0.5) {
    return null;
  }

  // Trong SVG Path: sweep-flag = 1 nghĩa là quay theo chiều kim đồng hồ (positive-angle)
  const sweepFlag: 0 | 1 = det > 0 ? 1 : 0;

  return {
    center: { x: cx, y: cy },
    radius,
    sweepFlag,
    isValid: true,
  };
}

/**
 * Tính góc nội tiếp theta = ∠(P_prev, P_curr, P_next) tại điểm P_curr (đơn vị: độ)
 */
export function calculateInteriorAngleDeg(pPrev: Point, pCurr: Point, pNext: Point): number {
  const v1x = pPrev.x - pCurr.x;
  const v1y = pPrev.y - pCurr.y;
  const v2x = pNext.x - pCurr.x;
  const v2y = pNext.y - pCurr.y;

  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);

  if (mag1 < 1e-4 || mag2 < 1e-4) return 180;

  const dot = v1x * v2x + v1y * v2y;
  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

/**
 * Kiểm tra một đoạn thẳng có gần như song song trục ngang (0°) hoặc trục đứng (90°)
 */
export function isNearAxisAligned(p1: Point, p2: Point): boolean {
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) return true;
  return dx / len > 0.92 || dy / len > 0.92;
}

/**
 * Tự động phân biệt Cung Tròn vs. Góc Vuông / Đường thẳng (Smart Corner Detection)
 * - Cung tròn: 110° < theta < 177°
 * - Góc vuông: 75° <= theta <= 105° và các cạnh gần trục ngang/dọc
 * - Đường thẳng: theta >= 177°
 * - Nếu giữ Shift: ép thành góc vuông / đường thẳng
 */
export function shouldBeArc(
  pPrev: Point,
  pCurr: Point,
  pNext: Point,
  isShiftPressed = false
): boolean {
  if (isShiftPressed) return false;

  const angle = calculateInteriorAngleDeg(pPrev, pCurr, pNext);

  // 1. Thẳng hàng (theta >= 177°) -> Giữ nguyên đường thẳng L
  if (angle >= 177) return false;

  // 2. Góc vuông / hình chữ nhật (75° <= theta <= 105°)
  if (angle >= 75 && angle <= 105) {
    if (isNearAxisAligned(pPrev, pCurr) || isNearAxisAligned(pCurr, pNext)) {
      return false;
    }
  }

  // 3. Góc nhọn gắt (theta < 75°) -> Đỉnh nhọn sắc nét L
  if (angle < 75) {
    return false;
  }

  // 4. Đường cong / Cung tròn mượt mà (110° < theta < 177°)
  if (angle > 110 && angle < 177) {
    return true;
  }

  // Vùng lân cận 105° - 110°: nếu không gần trục ngang dọc thì có thể là cung thoải
  if (!isNearAxisAligned(pPrev, pCurr) && !isNearAxisAligned(pCurr, pNext)) {
    return true;
  }

  return false;
}

/**
 * Hỗ trợ bắt chuẩn góc vuông 90° (Smart Ortho Snapping)
 */
export function snapToRightAngle(
  pPrev: Point | null,
  pCurr: Point,
  cursor: Point,
  isShiftPressed: boolean
): { point: Point; isSnapped: boolean } {
  const dx = cursor.x - pCurr.x;
  const dy = cursor.y - pCurr.y;

  // 1. Khi giữ phím Shift: ép hướng ngang/dọc tuyệt đối từ pCurr
  if (isShiftPressed) {
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { point: { x: cursor.x, y: pCurr.y }, isSnapped: true };
    } else {
      return { point: { x: pCurr.x, y: cursor.y }, isSnapped: true };
    }
  }

  // 2. Nếu có điểm trước pPrev: bắt góc vuông 90° so với đoạn pPrev -> pCurr
  if (pPrev) {
    const v1x = pCurr.x - pPrev.x;
    const v1y = pCurr.y - pPrev.y;
    const len1 = Math.hypot(v1x, v1y);

    const v2x = cursor.x - pCurr.x;
    const v2y = cursor.y - pCurr.y;
    const len2 = Math.hypot(v2x, v2y);

    if (len1 > 2 && len2 > 2) {
      const angle = calculateInteriorAngleDeg(pPrev, pCurr, cursor);

      // Nếu góc gần 90° (75° - 105°) và cạnh trước gần trục ngang/dọc
      if (angle >= 75 && angle <= 105) {
        if (Math.abs(v1x) / len1 > 0.92) {
          // Đoạn trước nằm ngang -> Đoạn mới ép thẳng đứng chuẩn xác
          return { point: { x: pCurr.x, y: cursor.y }, isSnapped: true };
        } else if (Math.abs(v1y) / len1 > 0.92) {
          // Đoạn trước thẳng đứng -> Đoạn mới ép nằm ngang chuẩn xác
          return { point: { x: cursor.x, y: pCurr.y }, isSnapped: true };
        }
      }

      // Nếu góc gần 180° (thẳng hàng >= 177°)
      if (angle >= 177) {
        const proj = (v2x * v1x + v2y * v1y) / (len1 * len1);
        return {
          point: {
            x: Math.round(pCurr.x + proj * v1x),
            y: Math.round(pCurr.y + proj * v1y),
          },
          isSnapped: true,
        };
      }
    }
  }

  return { point: cursor, isSnapped: false };
}

/**
 * Cơ chế "Chấm 3 Điểm Tự Bẻ Cong Liên Hoàn (Progressive 3-Point Auto-Arc)"
 * Hỗ trợ:
 * - Click = đỉnh thẳng 'anchor'
 * - Shift + Click = điểm giữa cung 'arc_mid'
 * - Khép hình về points[0] với 3 trường hợp chính xác:
 *   1. lastPoint.role === 'arc_mid': Cạnh đóng là cung tròn qua (P_{n-2}, lastPoint, P0) -> A ... Z
 *   2. points.length === 3 && points[1].role === 'arc_mid' && isShiftPressed: Khép thành đường tròn 360° qua 3 điểm (P0, P1, P2) -> 2 lệnh A nối tiếp + Z
 *   3. lastPoint.role === 'anchor' (mặc định): Cạnh đóng là đoạn thẳng -> L P0.x P0.y Z
 */
export function buildAutoArcSvgPath(
  points: Point[],
  isClosed = false,
  isShiftPressed = false
): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  // ==========================================
  // TRƯỜNG HỢP 2 — KHÉP THÀNH HÌNH TRÒN 360° TỪ 3 ĐIỂM
  // (points.length === 3 && points[1].role === 'arc_mid' && isShiftPressed)
  // ==========================================
  if (isClosed && n === 3 && points[1].role === 'arc_mid' && isShiftPressed) {
    const circle = solveCircumcircle(points[0], points[1], points[2]);
    if (circle && circle.isValid) {
      const rStr = circle.radius.toFixed(1);
      const sweep = circle.sweepFlag;
      // Điểm đối diện trên đường kính so với points[0] qua tâm đường tròn
      const oppX = (2 * circle.center.x - points[0].x).toFixed(1);
      const oppY = (2 * circle.center.y - points[0].y).toFixed(1);
      const p0x = points[0].x.toFixed(1);
      const p0y = points[0].y.toFixed(1);
      return `M ${p0x} ${p0y} A ${rStr} ${rStr} 0 0 ${sweep} ${oppX} ${oppY} A ${rStr} ${rStr} 0 0 ${sweep} ${p0x} ${p0y} Z`;
    }
  }

  // ==========================================
  // XÂY DỰNG ĐƯỜNG DẪN QUA CÁC ĐỈNH ĐÃ CHẤM
  // ==========================================
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  let i = 0;

  while (i < n - 1) {
    const nextPt = points[i + 1];

    // Nếu điểm tiếp theo là 'arc_mid'
    if (nextPt.role === 'arc_mid') {
      // Nếu là điểm cuối cùng trong mảng và hình đang khép kín (Trường hợp 1)
      if (i + 1 === n - 1 && isClosed) {
        break; // Sẽ xử lý ở khối Khép Hình bên dưới
      }

      // Nếu có điểm thứ 3 để hoàn thiện cung tròn: P_curr -> nextPt (arc_mid) -> thirdPt
      if (i + 2 < n) {
        const thirdPt = points[i + 2];
        const circle = solveCircumcircle(points[i], nextPt, thirdPt);
        if (circle && circle.isValid) {
          const rStr = circle.radius.toFixed(1);
          const sweep = circle.sweepFlag;
          d += ` A ${rStr} ${rStr} 0 0 ${sweep} ${nextPt.x.toFixed(1)} ${nextPt.y.toFixed(1)}`;
          d += ` A ${rStr} ${rStr} 0 0 ${sweep} ${thirdPt.x.toFixed(1)} ${thirdPt.y.toFixed(1)}`;
        } else {
          d += ` L ${nextPt.x.toFixed(1)} ${nextPt.y.toFixed(1)} L ${thirdPt.x.toFixed(1)} ${thirdPt.y.toFixed(1)}`;
        }
        i += 2;
        continue;
      } else {
        // Điểm arc_mid ở cuối mảng và chưa khép hình
        d += ` L ${nextPt.x.toFixed(1)} ${nextPt.y.toFixed(1)}`;
        i += 1;
        continue;
      }
    }

    // Điểm tiếp theo là 'anchor' hoặc thông thường:
    // TUYỆT ĐỐI VẼ ĐƯỜNG THẲNG L! KHÔNG TỰ Ý BẺ CONG KHI NGƯỜI DÙNG KHÔNG NHẤN SHIFT!
    d += ` L ${nextPt.x.toFixed(1)} ${nextPt.y.toFixed(1)}`;
    i += 1;
  }

  // ==========================================
  // XỬ LÝ KHÉP KÍN HÌNH (isClosed === true)
  // ==========================================
  if (isClosed && n >= 3) {
    const lastPoint = points[n - 1];

    // TRƯỜNG HỢP 1 — Cạnh đóng cuối cùng là Cung Tròn (lastPoint.role === 'arc_mid')
    if (lastPoint.role === 'arc_mid') {
      const prevPt = points[n - 2];
      const circle = solveCircumcircle(prevPt, lastPoint, points[0]);
      if (circle && circle.isValid) {
        const rStr = circle.radius.toFixed(1);
        const sweep = circle.sweepFlag;
        d += ` A ${rStr} ${rStr} 0 0 ${sweep} ${lastPoint.x.toFixed(1)} ${lastPoint.y.toFixed(1)}`;
        d += ` A ${rStr} ${rStr} 0 0 ${sweep} ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} Z`;
      } else {
        d += ` L ${lastPoint.x.toFixed(1)} ${lastPoint.y.toFixed(1)} L ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} Z`;
      }
    } else {
      // TRƯỜNG HỢP 3 — Cạnh đóng cuối cùng là Đoạn Thẳng (lastPoint.role === 'anchor')
      d += ` L ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} Z`;
    }
  } else if (isClosed && n === 2) {
    d += ' Z';
  }

  return d;
}
