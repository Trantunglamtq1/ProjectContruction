import { describe, expect, it } from 'vitest';
import { readInspectionListState, updateInspectionListState } from '../inspectionListState';

describe('inspection list URL context', () => {
  it('restores supported filters and page size from a shared URL', () => {
    expect(readInspectionListState(new URLSearchParams('search=%23ABCD1234&status=Reviewed&page=3&pageSize=20')))
      .toEqual({ search: '#ABCD1234', status: 'Reviewed', page: 3, pageSize: 20 });
  });
  it.each(['page=-2&pageSize=0', 'page=Infinity&pageSize=13', 'page=2.5&pageSize=NaN', 'page=999999999999999999999&status=unknown'])('handles invalid URL values without sending broken pagination: %s', query => {
    const state = readInspectionListState(new URLSearchParams(query));
    expect(state.page).toBe(1);
    expect(state.pageSize).toBe(10);
    expect(state.status).toBe('ALL');
  });
  it('resets pagination for a search change but keeps detail links and unrelated context', () => {
    const original = new URLSearchParams('page=8&pageSize=50&inspectionId=detail-id&from=notification&status=Reviewed');
    const result = updateInspectionListState(original, { search: '  Cột C12  ' });
    expect(readInspectionListState(result)).toEqual({ search: 'Cột C12', status: 'Reviewed', page: 1, pageSize: 50 });
    expect(result.get('inspectionId')).toBe('detail-id');
    expect(result.get('from')).toBe('notification');
    expect(original.get('page')).toBe('8');
  });
  it('resets page on status changes and removes default query values', () => {
    const result = updateInspectionListState(new URLSearchParams('search=a&page=5&status=Draft'), { status: 'ALL', search: '' });
    expect(result.toString()).toBe('');
  });
  it('changes page and pageSize together without losing filters or selection', () => {
    const result = updateInspectionListState(new URLSearchParams('search=beam&status=Approved&inspectionId=id'), { page: 2, pageSize: 20 });
    expect(readInspectionListState(result)).toEqual({ search: 'beam', status: 'Approved', page: 2, pageSize: 20 });
    expect(result.get('inspectionId')).toBe('id');
  });
});
