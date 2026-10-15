import type { Point } from './types';

/**
 * Khoảng cách vuông góc từ điểm P đến đoạn thẳng AB
 */
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  // Tọa độ hình chiếu vuông góc
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Rút gọn đường gấp khúc bằng thuật toán Ramer-Douglas-Peucker (RDP)
 * @param points Danh sách các điểm pixel ban đầu
 * @param epsilon Ngưỡng sai số cho phép (mặc định 1.5 pixel)
 */
export function simplifyRDP(points: Point[], epsilon = 1.5): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyRDP(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  } else {
    return [points[0], points[end]];
  }
}

/**
 * Rút gọn đường viền khép kín (Closed Loop RDP)
 */
export function simplifyClosedLoop(points: Point[], epsilon = 1.8): Point[] {
  if (points.length <= 4) return points;

  // Tìm điểm xa nhất để làm mốc chia đôi vòng khép kín
  let maxD = 0;
  let idxB = Math.floor(points.length / 2);

  for (let i = 0; i < points.length; i++) {
    const d = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
    if (d > maxD) {
      maxD = d;
      idxB = i;
    }
  }

  const part1 = simplifyRDP(points.slice(0, idxB + 1), epsilon);
  const part2 = simplifyRDP(points.slice(idxB).concat([points[0]]), epsilon);

  return part1.slice(0, -1).concat(part2.slice(0, -1));
}

/**
 * Chuyển đổi chuỗi điểm sau khi rút gọn thành đường cong Catmull-Rom Spline
 * dạng Cubic Bezier SVG Path (`M ... C ... Z`) mượt mà, tự động ôm khít
 * theo đường cong, cung tròn và góc lượn của bản vẽ.
 */
export function pointsToSmoothSvgPath(
  points: Point[],
  isClosed = false,
  tension = 1.0
): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  const n = points.length;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} `;

  for (let i = 0; i < (isClosed ? n : n - 1); i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    // Tính 2 điểm điều khiển Control Points C1 và C2 theo công thức Catmull-Rom to Cubic Bezier:
    // C1 = P1 + (P2 - P0) / (6 * tension)
    // C2 = P2 - (P3 - P1) / (6 * tension)
    const factor = 6.0 * tension;

    const cp1x = p1.x + (p2.x - (isClosed || i > 0 ? p0.x : p1.x)) / factor;
    const cp1y = p1.y + (p2.y - (isClosed || i > 0 ? p0.y : p1.y)) / factor;

    const cp2x = p2.x - ((isClosed || i < n - 2 ? p3.x : p2.x) - p1.x) / factor;
    const cp2y = p2.y - ((isClosed || i < n - 2 ? p3.y : p2.y) - p1.y) / factor;

    d += `C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `;
  }

  if (isClosed) {
    d += 'Z';
  }

  return d;
}

/**
 * Làm mượt chuỗi điểm bằng thuật toán Chaikin's Corner Cutting (Quadratic B-Spline)
 * Cắt góc lượn theo tỷ lệ 1/4 và 3/4 giúp biến các gấp khúc pixel thành đường lượn mượt mà.
 */
export function chaikinSmooth(
  points: Point[],
  iterations = 2,
  isClosed = false
): Point[] {
  if (points.length < 3) return points;

  let current = [...points];

  for (let it = 0; it < iterations; it++) {
    const next: Point[] = [];
    const len = current.length;

    if (!isClosed) {
      next.push(current[0]);
    }

    const maxIdx = isClosed ? len : len - 1;

    for (let i = 0; i < maxIdx; i++) {
      const p0 = current[i];
      const p1 = current[(i + 1) % len];

      // Q = 0.75 * P0 + 0.25 * P1
      const q: Point = {
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      };

      // R = 0.25 * P0 + 0.75 * P1
      const r: Point = {
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      };

      next.push(q);
      next.push(r);
    }

    if (!isClosed) {
      next.push(current[len - 1]);
    }

    current = next;
  }

  return current;
}
