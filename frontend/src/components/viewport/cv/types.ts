export type PointRole = 'anchor' | 'arc_mid';

export interface Point {
  x: number;
  y: number;
  role?: PointRole;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface CostMapData {
  width: number;
  height: number;
  // Mảng 1 chiều Float32Array lưu chi phí tại mỗi pixel: cost trong khoảng [0.05, 1.0]
  // 0.05: Nét mực đậm, cạnh rõ nét (chi phí cực thấp -> thuật toán bám vào)
  // 1.0: Nền trắng không có nét vẽ (chi phí cao -> thuật toán né tránh)
  costs: Float32Array;
  // Gradient magnitude [0, 255]
  gradients: Float32Array;
  // Luminance [0, 255]
  luminance: Uint8Array;
}

export interface SmartPathResult {
  points: Point[];
  svgPath: string;
  isSnappedToEdge: boolean;
  isOrtho: boolean;
  totalCost: number;
}

export interface SmartContourResult {
  points: Point[];
  svgPath: string;
  boundingBox: BoundingBox;
  area: number;
  perimeter: number;
}

export interface SavedObjectData {
  id: string;
  code: string;
  name: string;
  status: 'PENDING' | 'PASS' | 'FAIL' | 'IN_PROGRESS';
  pageNumber: number;
  svgPath: string;
  points: Point[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  originalSheetWidth: number;
  originalSheetHeight: number;
  color: string;
  createdAt: string;
}
