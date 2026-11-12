import { statusPresentations } from '../config/statuses';
export interface InspectionListState { search: string; status: string; page: number; pageSize: number }
const pageSizes = [10, 20, 50, 100];
export function readInspectionListState(params: URLSearchParams): InspectionListState {
  const page = Number(params.get('page') || 1);
  const pageSize = Number(params.get('pageSize') || 10);
  const status = params.get('status') || 'ALL';
  return { search: params.get('search') || '', status: Object.hasOwn(statusPresentations.inspection, status) ? status : 'ALL',
    page: Number.isInteger(page) && page > 0 && page <= 2147483647 ? page : 1,
    pageSize: pageSizes.includes(pageSize) ? pageSize : 10 };
}
export function updateInspectionListState(params: URLSearchParams, patch: Partial<InspectionListState>): URLSearchParams {
  const next = new URLSearchParams(params);
  const state = { ...readInspectionListState(params), ...patch };
  if (patch.search !== undefined || patch.status !== undefined) state.page = 1;
  state.search = state.search.trim();
  for (const [key, value, defaultValue] of [
    ['search', state.search, ''], ['status', state.status, 'ALL'], ['page', String(state.page), '1'], ['pageSize', String(state.pageSize), '10'],
  ]) { if (value === defaultValue) next.delete(key); else next.set(key, value); }
  return next;
}
