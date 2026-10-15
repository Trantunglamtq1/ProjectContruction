import type { CostMapData, Point, SmartPathResult } from './types';
import { findNearestEdgeSnap } from './imageCostMap';

interface HeapNode {
  index: number;
  fCost: number;
}

/**
 * Min-Heap siêu nhẹ tối ưu bộ nhớ phục vụ A* với hàng chục nghìn điểm ảnh
 */
class MinHeap {
  private nodes: HeapNode[] = [];

  get size(): number {
    return this.nodes.length;
  }

  isEmpty(): boolean {
    return this.nodes.length === 0;
  }

  push(index: number, fCost: number): void {
    this.nodes.push({ index, fCost });
    this.bubbleUp(this.nodes.length - 1);
  }

  pop(): HeapNode | undefined {
    if (this.nodes.length === 0) return undefined;
    const top = this.nodes[0];
    const bottom = this.nodes.pop()!;
    if (this.nodes.length > 0) {
      this.nodes[0] = bottom;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(n: number): void {
    const node = this.nodes[n];
    while (n > 0) {
      const parentN = (n - 1) >> 1;
      const parent = this.nodes[parentN];
      if (node.fCost >= parent.fCost) break;
      this.nodes[parentN] = node;
      this.nodes[n] = parent;
      n = parentN;
    }
  }

  private bubbleDown(n: number): void {
    const length = this.nodes.length;
    const node = this.nodes[n];
    while (true) {
      const rightChildN = (n + 1) << 1;
      const leftChildN = rightChildN - 1;
      let swapN = -1;
      let minCost = node.fCost;

      if (leftChildN < length && this.nodes[leftChildN].fCost < minCost) {
        minCost = this.nodes[leftChildN].fCost;
        swapN = leftChildN;
      }
      if (rightChildN < length && this.nodes[rightChildN].fCost < minCost) {
        swapN = rightChildN;
      }

      if (swapN === -1) break;
      this.nodes[n] = this.nodes[swapN];
      this.nodes[swapN] = node;
      n = swapN;
    }
  }
}

// 8 hướng lân cận trên ma trận điểm ảnh (Chebyshev / Euclidean)
const DX = [-1, 0, 1, -1, 1, -1, 0, 1];
const DY = [-1, -1, -1, 0, 0, 1, 1, 1];
const STEP_DIST = [1.414, 1.0, 1.414, 1.0, 1.0, 1.414, 1.0, 1.414];

/**
 * Thuật toán Intelligent Scissors / Magnetic Livewire
 * Tìm đường cong chi phí tối thiểu giữa P1 và P2 bám theo nét mực bản vẽ.
 */
export function findMagneticPath(
  costMap: CostMapData,
  start: Point,
  end: Point,
  options?: {
    snapRadius?: number;
    orthoThreshold?: number;
    maxIterations?: number;
  }
): SmartPathResult {
  const { width, height, costs } = costMap;
  const snapRadius = options?.snapRadius ?? 14;
  const orthoThreshold = options?.orthoThreshold ?? 12;
  const maxIterations = options?.maxIterations ?? 30000;

  // 1. Tự động Snap điểm đích P2 vào nét mực gần nhất
  const snapResult = findNearestEdgeSnap(costMap, end, snapRadius);
  const targetPt = snapResult.point;

  const sx = Math.max(0, Math.min(width - 1, Math.round(start.x)));
  const sy = Math.max(0, Math.min(height - 1, Math.round(start.y)));
  const tx = Math.max(0, Math.min(width - 1, Math.round(targetPt.x)));
  const ty = Math.max(0, Math.min(height - 1, Math.round(targetPt.y)));

  // Nếu 2 điểm trùng nhau
  if (sx === tx && sy === ty) {
    return {
      points: [{ x: sx, y: sy }],
      svgPath: `M ${sx} ${sy}`,
      isSnappedToEdge: snapResult.isSnapped,
      isOrtho: false,
      totalCost: 0,
    };
  }

  // 2. Thu hẹp không gian tìm kiếm trong một Bounding Box mở rộng linh hoạt
  const dx = Math.abs(tx - sx);
  const dy = Math.abs(ty - sy);
  const distStraight = Math.hypot(dx, dy);

  // Margin tính theo khoảng cách: đủ rộng để ôm theo cung tròn uốn cong nhưng đủ hẹp để chạy dưới 10ms
  const margin = Math.max(30, Math.min(180, Math.round(distStraight * 0.45)));
  const minX = Math.max(0, Math.min(sx, tx) - margin);
  const maxX = Math.min(width - 1, Math.max(sx, tx) + margin);
  const minY = Math.max(0, Math.min(sy, ty) - margin);
  const maxY = Math.min(height - 1, Math.max(sy, ty) + margin);

  // 3. Khởi tạo mảng gCost và parent để truy vết đường đi
  const totalPixels = width * height;
  const gCost = new Float32Array(totalPixels);
  gCost.fill(Infinity);

  const parent = new Int32Array(totalPixels);
  parent.fill(-1);

  const startIndex = sy * width + sx;
  const targetIndex = ty * width + tx;

  gCost[startIndex] = 0;

  const openSet = new MinHeap();
  // Heuristic: khoảng cách Euclide nhân chi phí tối thiểu 0.05
  const hStart = distStraight * 0.05;
  openSet.push(startIndex, hStart);

  let iterations = 0;
  let found = false;

  while (!openSet.isEmpty() && iterations < maxIterations) {
    iterations++;
    const current = openSet.pop()!;
    const u = current.index;

    if (u === targetIndex) {
      found = true;
      break;
    }

    const ux = u % width;
    const uy = Math.floor(u / width);
    const uGCost = gCost[u];
    const uCost = costs[u];

    for (let i = 0; i < 8; i++) {
      const vx = ux + DX[i];
      const vy = uy + DY[i];

      if (vx < minX || vx > maxX || vy < minY || vy > maxY) continue;

      const v = vy * width + vx;
      const vCost = costs[v];

      // Chi phí bước di chuyển
      const stepCost = STEP_DIST[i] * ((uCost + vCost) * 0.5);
      const tentativeGCost = uGCost + stepCost;

      if (tentativeGCost < gCost[v]) {
        gCost[v] = tentativeGCost;
        parent[v] = u;

        // Heuristic Euclide về đích
        const h = Math.hypot(vx - tx, vy - ty) * 0.05;
        openSet.push(v, tentativeGCost + h);
      }
    }
  }

  // 4. Nếu A* tìm thấy đường đi bám nét
  if (found) {
    const rawPath: Point[] = [];
    let curr = targetIndex;
    let pathCostSum = 0;

    while (curr !== -1) {
      const px = curr % width;
      const py = Math.floor(curr / width);
      rawPath.push({ x: px, y: py });
      pathCostSum += costs[curr];
      curr = parent[curr];
    }

    rawPath.reverse();

    // Đánh giá chất lượng: chi phí trung bình của đường đi
    const avgCost = pathCostSum / Math.max(1, rawPath.length);

    // Nếu chi phí trung bình thấp (< 0.70): đường đi bám dọc theo nét vẽ bản vẽ (cung tròn/góc L)
    if (avgCost < 0.70 || rawPath.length > 3) {
      return {
        points: rawPath,
        svgPath: `M ${rawPath[0].x} ${rawPath[0].y} ` + rawPath.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' '),
        isSnappedToEdge: true,
        isOrtho: false,
        totalCost: pathCostSum,
      };
    }
  }

  // 5. Fallback thông minh: Nếu giữa P1 và P2 là khoảng trắng (không có nét vẽ)
  // Tự động kiểm tra bắt góc vuông 90° (Auto-Ortho Snap)
  const isNearlyVertical = dx <= orthoThreshold && dy > orthoThreshold;
  const isNearlyHorizontal = dy <= orthoThreshold && dx > orthoThreshold;

  if (isNearlyVertical) {
    const orthoEnd: Point = { x: sx, y: targetPt.y };
    return {
      points: [start, orthoEnd],
      svgPath: `M ${start.x} ${start.y} L ${orthoEnd.x} ${orthoEnd.y}`,
      isSnappedToEdge: false,
      isOrtho: true,
      totalCost: distStraight,
    };
  }

  if (isNearlyHorizontal) {
    const orthoEnd: Point = { x: targetPt.x, y: sy };
    return {
      points: [start, orthoEnd],
      svgPath: `M ${start.x} ${start.y} L ${orthoEnd.x} ${orthoEnd.y}`,
      isSnappedToEdge: false,
      isOrtho: true,
      totalCost: distStraight,
    };
  }

  // Nối thẳng trực tiếp
  return {
    points: [start, targetPt],
    svgPath: `M ${start.x} ${start.y} L ${targetPt.x} ${targetPt.y}`,
    isSnappedToEdge: false,
    isOrtho: false,
    totalCost: distStraight,
  };
}
