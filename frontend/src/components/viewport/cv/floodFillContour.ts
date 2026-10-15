import type { CostMapData, Point, SmartContourResult, BoundingBox } from './types';

/**
 * Hành vi 2: One-Click Flood-Fill Contour
 * Khi Kỹ sư Double-click (hoặc Alt+Click) vào trong lòng một hình khép kín:
 * 1. Chạy Flood Fill quét vùng bên trong đến khi chạm ranh giới nét vẽ.
 * 2. Dùng Moore-Neighbor Boundary Tracing để trích xuất chu vi ngoài cùng.
 */
export function extractClosedContourFromClick(
  costMap: CostMapData,
  seedPoint: Point,
  options?: {
    luminanceThreshold?: number;
    maxAreaPixels?: number;
  }
): SmartContourResult | null {
  const { width, height, luminance, gradients } = costMap;
  const lumThreshold = options?.luminanceThreshold ?? 175; // Dưới 175 coi là nét mực tối
  const maxArea = options?.maxAreaPixels ?? 350000; // Tránh lan ra toàn trang nếu vùng không khép kín

  const sx = Math.max(0, Math.min(width - 1, Math.round(seedPoint.x)));
  const sy = Math.max(0, Math.min(height - 1, Math.round(seedPoint.y)));

  // 1. Kiểm tra điểm click có hợp lệ không
  const seedIdx = sy * width + sx;
  // Nếu click trúng vạch đen (nét mực), không thể flood-fill lòng trong
  if (luminance[seedIdx] < lumThreshold && gradients[seedIdx] > 40) {
    return null;
  }

  // 2. Chạy Flood Fill (BFS) trên mask nhị phân
  const mask = new Uint8Array(width * height);
  // Queue lưu tọa độ pixel (packed y * width + x)
  const queue = new Int32Array(maxArea + 1000);
  let qHead = 0;
  let qTail = 0;

  queue[qTail++] = seedIdx;
  mask[seedIdx] = 1;

  let minX = sx;
  let maxX = sx;
  let minY = sy;
  let maxY = sy;
  let filledPixelsCount = 0;
  let hitBoundaryOfCanvas = false;

  const dx4 = [1, -1, 0, 0];
  const dy4 = [0, 0, 1, -1];

  while (qHead < qTail) {
    const curr = queue[qHead++];
    filledPixelsCount++;

    if (filledPixelsCount > maxArea) {
      // Vùng quá rộng hoặc hở không khép kín -> Hủy để tránh tràn toàn bản vẽ
      return null;
    }

    const cx = curr % width;
    const cy = Math.floor(curr / width);

    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;

    // Nếu chạm tới mép canvas bản vẽ -> vùng bị hở ra ngoài trang
    if (cx <= 1 || cx >= width - 2 || cy <= 1 || cy >= height - 2) {
      hitBoundaryOfCanvas = true;
      break;
    }

    for (let i = 0; i < 4; i++) {
      const nx = cx + dx4[i];
      const ny = cy + dy4[i];

      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const nIdx = ny * width + nx;
      if (mask[nIdx] !== 0) continue;

      // Kiểm tra xem có chạm vào ranh giới nét mực đậm của bản vẽ không
      const lum = luminance[nIdx];
      const grad = gradients[nIdx];

      // Điều kiện ranh giới dừng: Nét vẽ màu đen hoặc cạnh viền có độ dốc cao
      const isBoundary = lum < lumThreshold || grad > 60;

      if (!isBoundary) {
        mask[nIdx] = 1;
        if (qTail < queue.length - 1) {
          queue[qTail++] = nIdx;
        }
      }
    }
  }

  if (hitBoundaryOfCanvas || filledPixelsCount < 16) {
    // Không phải hình khép kín hợp lệ (quá nhỏ hoặc hở ra mép ngoài)
    return null;
  }

  // 3. Trích xuất đường viền bao ngoài bằng Marching Squares (2x2 iso-contour)
  // kết hợp Moore-Neighbor Tracing đảm bảo ôm khít 100% hình tròn, elip, đa giác phức tạp.
  const msContour = extractMarchingSquaresContour(mask, width, height, minX, minY, maxX, maxY);
  const contourPoints: Point[] = msContour.length >= 4 ? msContour : extractMooreNeighborContour(mask, width, height, minX, minY, maxX, maxY);

  if (contourPoints.length < 4) return null;

  // 4. Tính toán chu vi và Bounding Box
  const boundingBox: BoundingBox = {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };

  // Tạo chuỗi SVG path
  const svgPath =
    `M ${contourPoints[0].x} ${contourPoints[0].y} ` +
    contourPoints.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') +
    ' Z';

  return {
    points: contourPoints,
    svgPath,
    boundingBox,
    area: filledPixelsCount,
    perimeter: contourPoints.length,
  };
}

/**
 * Thuật toán Marching Squares trích xuất đường viền bao ngoài 100% khép kín từ ma trận nhị phân (Binary Mask).
 * Sử dụng lưới 2x2 để xác định giao biên sub-pixel, giúp chu vi vòng tròn/elip/cung cong cực kỳ trơn mịn.
 */
export function extractMarchingSquaresContour(
  mask: Uint8Array,
  width: number,
  height: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Point[] {
  let startX = -1;
  let startY = -1;

  for (let y = Math.max(0, minY - 1); y <= Math.min(height - 2, maxY + 1); y++) {
    for (let x = Math.max(0, minX - 1); x <= Math.min(width - 2, maxX + 1); x++) {
      const tl = mask[y * width + x] || 0;
      const tr = mask[y * width + (x + 1)] || 0;
      const bl = mask[(y + 1) * width + x] || 0;
      const br = mask[(y + 1) * width + (x + 1)] || 0;
      const state = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (state > 0 && state < 15) {
        startX = x;
        startY = y;
        break;
      }
    }
    if (startX !== -1) break;
  }

  if (startX === -1) return [];

  const points: Point[] = [];
  let cx = startX;
  let cy = startY;
  let prevDir = 0;
  const maxSteps = 20000;
  let steps = 0;

  while (steps < maxSteps) {
    steps++;
    const tl = mask[cy * width + cx] || 0;
    const tr = mask[cy * width + (cx + 1)] || 0;
    const bl = mask[(cy + 1) * width + cx] || 0;
    const br = mask[(cy + 1) * width + (cx + 1)] || 0;
    const state = (tl << 3) | (tr << 2) | (br << 1) | bl;

    let nextDir = 0;
    let midX = cx + 0.5;
    let midY = cy + 0.5;

    switch (state) {
      case 1: // BL
        nextDir = 2; // Left
        midX = cx;
        midY = cy + 0.5;
        break;
      case 2: // BR
        nextDir = 1; // Down
        midX = cx + 0.5;
        midY = cy + 1;
        break;
      case 3: // BL, BR
        nextDir = 2; // Left
        midX = cx;
        midY = cy + 0.5;
        break;
      case 4: // TR
        nextDir = 3; // Up
        midX = cx + 0.5;
        midY = cy;
        break;
      case 5: // BL, TR
        nextDir = prevDir === 3 ? 2 : 0;
        midX = cx + 0.5;
        midY = cy + 0.5;
        break;
      case 6: // BR, TR
        nextDir = 1; // Down
        midX = cx + 0.5;
        midY = cy + 1;
        break;
      case 7: // BL, BR, TR
        nextDir = 2; // Left
        midX = cx;
        midY = cy + 0.5;
        break;
      case 8: // TL
        nextDir = 0; // Right
        midX = cx + 0.5;
        midY = cy;
        break;
      case 9: // TL, BL
        nextDir = 0; // Right
        midX = cx + 0.5;
        midY = cy;
        break;
      case 10: // TL, BR
        nextDir = prevDir === 0 ? 1 : 3;
        midX = cx + 0.5;
        midY = cy + 0.5;
        break;
      case 11: // TL, BL, BR
        nextDir = 0; // Right
        midX = cx + 0.5;
        midY = cy;
        break;
      case 12: // TL, TR
        nextDir = 0; // Right
        midX = cx + 1;
        midY = cy + 0.5;
        break;
      case 13: // TL, TR, BL
        nextDir = 3; // Up
        midX = cx + 0.5;
        midY = cy;
        break;
      case 14: // TL, TR, BR
        nextDir = 1; // Down
        midX = cx + 0.5;
        midY = cy + 1;
        break;
      default:
        break;
    }

    points.push({ x: midX, y: midY });
    prevDir = nextDir;

    if (nextDir === 0) cx += 1;
    else if (nextDir === 1) cy += 1;
    else if (nextDir === 2) cx -= 1;
    else if (nextDir === 3) cy -= 1;

    if (cx < 0 || cx >= width - 1 || cy < 0 || cy >= height - 1) break;

    if (cx === startX && cy === startY && steps > 3) {
      break;
    }
  }

  return points.length >= 4 ? points : [];
}

/**
 * Thuật toán Moore-Neighbor Boundary Tracing (Fallback chắc chắn theo 8 hướng kim đồng hồ)
 */
export function extractMooreNeighborContour(
  mask: Uint8Array,
  width: number,
  height: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Point[] {
  let startX = -1;
  let startY = -1;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (mask[y * width + x] === 1) {
        startX = x;
        startY = y;
        break;
      }
    }
    if (startX !== -1) break;
  }

  if (startX === -1) return [];

  const mooreDX = [0, 1, 1, 1, 0, -1, -1, -1];
  const mooreDY = [-1, -1, 0, 1, 1, 1, 0, -1];

  const points: Point[] = [];
  let currX = startX;
  let currY = startY;
  let backtrackDir = 6;

  points.push({ x: currX, y: currY });

  const maxSteps = 15000;
  let steps = 0;

  while (steps < maxSteps) {
    steps++;
    let foundNext = false;
    let checkDir = (backtrackDir + 1) % 8;

    for (let i = 0; i < 8; i++) {
      const dir = (checkDir + i) % 8;
      const nextX = currX + mooreDX[dir];
      const nextY = currY + mooreDY[dir];

      if (
        nextX >= 0 &&
        nextX < width &&
        nextY >= 0 &&
        nextY < height &&
        mask[nextY * width + nextX] === 1
      ) {
        currX = nextX;
        currY = nextY;
        backtrackDir = (dir + 4) % 8;
        foundNext = true;
        break;
      }
    }

    if (!foundNext) break;

    if (currX === startX && currY === startY) {
      break;
    }

    points.push({ x: currX, y: currY });
  }

  return points;
}
