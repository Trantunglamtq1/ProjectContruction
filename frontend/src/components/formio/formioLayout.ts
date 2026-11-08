/**
 * Các hàm layout thuần (không phụ thuộc React) của FormIO Builder.
 * Tách riêng để có thể unit test bằng Vitest mà không cần render cả component.
 */

/**
 * Tính toán kích thước bo gọn chuẩn xác theo độ lớn (fontSize) và độ dài của text.
 * Trong môi trường không có DOM (unit test) sẽ dùng phép đo ước lượng theo số ký tự.
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
