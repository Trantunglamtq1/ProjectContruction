import type { CostMapData, Point } from './types';

/**
 * Trích xuất bản đồ độ tương phản cạnh (Sobel Edge) & Chi phí (Cost Map) từ dữ liệu Canvas.
 * Nơi có nét mực đậm hoặc cạnh sắc nét có chi phí thấp nhất (~0.05).
 * Nền trắng bản vẽ có chi phí cao nhất (~1.0).
 */
export function buildCostMapFromImageData(imageData: ImageData): CostMapData {
  const { width, height, data } = imageData;
  const totalPixels = width * height;

  const luminance = new Uint8Array(totalPixels);
  const gradients = new Float32Array(totalPixels);
  const costs = new Float32Array(totalPixels);

  // 1. Chuyển đổi RGB sang Luminance (Grayscale chuẩn ITU-R BT.601)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Luminance: 0 (Đen tuyệt đối) -> 255 (Trắng tuyệt đối)
    luminance[p] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  // 2. Tính toán ma trận vi phân Gradient Sobel 3x3
  let maxGradient = 1.0;

  for (let y = 1; y < height - 1; y++) {
    const rowOffset = y * width;
    const prevRow = rowOffset - width;
    const nextRow = rowOffset + width;

    for (let x = 1; x < width - 1; x++) {
      // 8 lân cận xung quanh (x, y)
      const p00 = luminance[prevRow + x - 1];
      const p01 = luminance[prevRow + x];
      const p02 = luminance[prevRow + x + 1];

      const p10 = luminance[rowOffset + x - 1];
      const p12 = luminance[rowOffset + x + 1];

      const p20 = luminance[nextRow + x - 1];
      const p21 = luminance[nextRow + x];
      const p22 = luminance[nextRow + x + 1];

      // Sobel kernel Gx:
      // [-1  0  1]
      // [-2  0  2]
      // [-1  0  1]
      const gx = -p00 + p02 - 2 * p10 + 2 * p12 - p20 + p22;

      // Sobel kernel Gy:
      // [-1 -2 -1]
      // [ 0  0  0]
      // [ 1  2  1]
      const gy = -p00 - 2 * p01 - p02 + p20 + 2 * p21 + p22;

      const grad = Math.hypot(gx, gy);
      gradients[rowOffset + x] = grad;
      if (grad > maxGradient) {
        maxGradient = grad;
      }
    }
  }

  // 3. Chuẩn hóa & Xây dựng Hàm Chi Phí (Cost Function) cho Intelligent Scissors
  // Trọng số: 40% độ đậm nét mực, 60% độ dốc cạnh Sobel
  const wDark = 0.4;
  const wEdge = 0.6;

  for (let i = 0; i < totalPixels; i++) {
    const lumNorm = luminance[i] / 255.0; // 0 (đen) -> 1 (trắng)
    const edgeNorm = Math.min(1.0, gradients[i] / (maxGradient * 0.7 + 0.001)); // 1 (cạnh rất mạnh) -> 0 (phẳng)

    // Chi phí đường đi:
    // Càng đậm (lumNorm thấp) & Cạnh càng rõ (edgeNorm cao) -> cost càng gần 0.05 (ưu tiên đi qua)
    // Nền trắng không cạnh -> cost ~ 1.0 (tránh đi qua)
    const cost = wDark * Math.pow(lumNorm, 1.8) + wEdge * (1.0 - edgeNorm) + 0.05;
    costs[i] = Math.max(0.05, Math.min(1.0, cost));
  }

  return {
    width,
    height,
    costs,
    gradients,
    luminance,
  };
}

/**
 * Tìm điểm cạnh/nét mực tốt nhất gần vị trí chuột (Snap to Edge)
 * trong bán kính radius (ví dụ 10-15px).
 */
export function findNearestEdgeSnap(
  costMap: CostMapData,
  point: Point,
  radius = 12
): { point: Point; isSnapped: boolean } {
  const { width, height, costs, luminance } = costMap;
  const px = Math.round(point.x);
  const py = Math.round(point.y);

  if (px < 0 || px >= width || py < 0 || py >= height) {
    return { point, isSnapped: false };
  }

  let bestX = px;
  let bestY = py;
  let minCost = costs[py * width + px];

  const minX = Math.max(0, px - radius);
  const maxX = Math.min(width - 1, px + radius);
  const minY = Math.max(0, py - radius);
  const maxY = Math.min(height - 1, py + radius);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const d = Math.hypot(x - px, y - py);
      if (d <= radius) {
        const idx = y * width + x;
        // Điểm có cost thấp và độ sáng dưới ngưỡng mực (nét mực đậm < 200)
        const cost = costs[idx] + (d / radius) * 0.15; // Phạt nhẹ theo khoảng cách
        if (cost < minCost && luminance[idx] < 210) {
          minCost = cost;
          bestX = x;
          bestY = y;
        }
      }
    }
  }

  // Nếu tìm được điểm nét vẽ có cost đáng kể thấp hơn hoặc nằm trong bán kính
  const dist = Math.hypot(bestX - px, bestY - py);
  if (dist > 0 && minCost < 0.6) {
    return { point: { x: bestX, y: bestY }, isSnapped: true };
  }

  return { point, isSnapped: false };
}
