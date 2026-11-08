import { describe, expect, it } from 'vitest';
import { calculateButtonFitSize } from '../formioLayout';

describe('calculateButtonFitSize', () => {
  it('never returns a button smaller than the minimum size', () => {
    const { w, h } = calculateButtonFitSize('', 13, false);

    expect(w).toBeGreaterThanOrEqual(50);
    expect(h).toBeGreaterThanOrEqual(28);
  });

  it('grows the width as the label gets longer', () => {
    const short = calculateButtonFitSize('OK', 13, true);
    const long = calculateButtonFitSize('Xác nhận nghiệm thu hoàn thành', 13, true);

    expect(long.w).toBeGreaterThan(short.w);
  });

  it('reserves extra width for the icon', () => {
    const withIcon = calculateButtonFitSize('Xác nhận', 13, true);
    const withoutIcon = calculateButtonFitSize('Xác nhận', 13, false);

    expect(withIcon.w - withoutIcon.w).toBe(20);
  });

  it('scales height with font size', () => {
    expect(calculateButtonFitSize('Lưu', 13).h).toBe(29); // round(13 * 2.2)
    expect(calculateButtonFitSize('Lưu', 20).h).toBe(44); // round(20 * 2.2)
  });

  it('keeps a 28px minimum height for very small fonts', () => {
    expect(calculateButtonFitSize('Lưu', 10).h).toBe(28);
  });

  it('falls back to a sane font size when 0 is passed', () => {
    expect(calculateButtonFitSize('Lưu', 0).h).toBe(29);
  });

  it('measures text with canvas when a DOM is available', () => {
    const originalDocument = globalThis.document;
    const ctx = {
      font: '',
      measureText: (text: string) => ({ width: text.length * 10 }),
    };

    // Giả lập document/canvas để chạy nhánh đo text thật (trình duyệt)
    (globalThis as unknown as { document: unknown }).document = {
      createElement: () => ({ getContext: () => ctx }),
    };

    try {
      const size = calculateButtonFitSize('ABC', 13, false);
      // 3 ký tự * 10px + padding 32px (không icon)
      expect(size.w).toBe(62);
    } finally {
      (globalThis as unknown as { document: unknown }).document = originalDocument;
    }
  });
});
