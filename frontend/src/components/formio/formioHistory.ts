import type { FormIoComponent } from '../../types/inspection';

export interface HistorySnapshot {
  components: FormIoComponent[];
  selectedCompIndex: number | null;
  formTitle: string;
}

export interface HistoryState {
  items: HistorySnapshot[];
  index: number;
}

export const HISTORY_LIMIT = 100;

export const createHistory = (): HistoryState => ({ items: [], index: -1 });

/** Deep-clone để snapshot không bị ảnh hưởng khi component tiếp tục mutate state. */
export const cloneComponents = (list: FormIoComponent[]): FormIoComponent[] =>
  JSON.parse(JSON.stringify(list || []));

const cloneSnapshot = (snap: HistorySnapshot): HistorySnapshot => ({
  components: cloneComponents(snap.components),
  selectedCompIndex: snap.selectedCompIndex,
  formTitle: snap.formTitle,
});

/**
 * So sánh nội dung (bỏ qua selection) để không ghi lịch sử khi người dùng
 * chỉ click chọn component mà không sửa gì.
 */
export const isSameSnapshot = (
  a: HistorySnapshot | undefined,
  b: HistorySnapshot
): boolean =>
  !!a &&
  a.formTitle === b.formTitle &&
  JSON.stringify(a.components) === JSON.stringify(b.components);

/**
 * Thêm snapshot mới. Trả về chính state cũ nếu nội dung không đổi.
 * Khi có thay đổi mới sau khi undo, nhánh redo cũ bị cắt bỏ.
 */
export function pushSnapshot(
  state: HistoryState,
  snapshot: HistorySnapshot
): HistoryState {
  const current = state.items[state.index];
  if (isSameSnapshot(current, snapshot)) return state;

  const items = state.items.slice(0, state.index + 1);
  items.push(cloneSnapshot(snapshot));

  if (items.length > HISTORY_LIMIT) {
    items.shift();
  }

  return { items, index: items.length - 1 };
}

export const canUndo = (state: HistoryState): boolean => state.index > 0;

export const canRedo = (state: HistoryState): boolean =>
  state.index >= 0 && state.index < state.items.length - 1;

export function undo(state: HistoryState): {
  state: HistoryState;
  snapshot: HistorySnapshot | null;
} {
  if (!canUndo(state)) return { state, snapshot: null };

  const index = state.index - 1;
  return { state: { ...state, index }, snapshot: state.items[index] };
}

export function redo(state: HistoryState): {
  state: HistoryState;
  snapshot: HistorySnapshot | null;
} {
  if (!canRedo(state)) return { state, snapshot: null };

  const index = state.index + 1;
  return { state: { ...state, index }, snapshot: state.items[index] };
}
