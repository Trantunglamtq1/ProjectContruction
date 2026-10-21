import type { Point } from './types';
import { buildAutoArcSvgPath, solveCircumcircle, shouldBeArc, snapToRightAngle } from './autoArc';
export { buildAutoArcSvgPath, solveCircumcircle, shouldBeArc, snapToRightAngle };

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
  _tension = 1.0
): string {
  if (points.length === 0) return '';
  return buildAutoArcSvgPath(points, isClosed);
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
