import { describe, expect, it } from 'vitest';
import type { FormIoComponent } from '../../../types/inspection';
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  createHistory,
  isSameSnapshot,
  pushSnapshot,
  redo,
  undo,
  type HistorySnapshot,
} from '../formioHistory';

const comp = (key: string): FormIoComponent => ({
  key,
  type: 'textfield',
  label: key,
});

const snap = (
  title: string,
  keys: string[],
  selectedCompIndex: number | null = null
): HistorySnapshot => ({
  formTitle: title,
  components: keys.map(comp),
  selectedCompIndex,
});

describe('formioHistory', () => {
  it('starts empty with no undo/redo available', () => {
    const state = createHistory();

    expect(state.index).toBe(-1);
    expect(state.items).toHaveLength(0);
    expect(canUndo(state)).toBe(false);
    expect(canRedo(state)).toBe(false);
    expect(undo(state).snapshot).toBeNull();
    expect(redo(state).snapshot).toBeNull();
  });

  it('records the first snapshot at index 0 without enabling undo', () => {
    const state = pushSnapshot(createHistory(), snap('Form A', ['a']));

    expect(state.index).toBe(0);
    expect(state.items).toHaveLength(1);
    expect(canUndo(state)).toBe(false);
    expect(canRedo(state)).toBe(false);
  });

  it('ignores selection-only changes (same components and title)', () => {
    const first = pushSnapshot(createHistory(), snap('Form A', ['a'], 0));
    const second = pushSnapshot(first, snap('Form A', ['a'], 1));

    expect(second).toBe(first);
    expect(second.items).toHaveLength(1);
  });

  it('pushes a new snapshot when content changes and enables undo', () => {
    const first = pushSnapshot(createHistory(), snap('Form A', ['a']));
    const second = pushSnapshot(first, snap('Form A', ['a', 'b']));

    expect(second.items).toHaveLength(2);
    expect(second.index).toBe(1);
    expect(canUndo(second)).toBe(true);
    expect(canRedo(second)).toBe(false);
  });

  it('undo moves back and redo moves forward to the same snapshots', () => {
    const s1 = snap('Form A', ['a']);
    const s2 = snap('Form A', ['a', 'b']);
    const state = pushSnapshot(pushSnapshot(createHistory(), s1), s2);

    const undone = undo(state);
    expect(undone.snapshot?.components).toHaveLength(1);
    expect(undone.state.index).toBe(0);
    expect(canRedo(undone.state)).toBe(true);

    const redone = redo(undone.state);
    expect(redone.snapshot?.components).toHaveLength(2);
    expect(redone.state.index).toBe(1);
    expect(canRedo(redone.state)).toBe(false);
  });

  it('drops the redo branch when a new change is made after undo', () => {
    const state = pushSnapshot(
      pushSnapshot(createHistory(), snap('Form A', ['a'])),
      snap('Form A', ['a', 'b'])
    );

    const undone = undo(state);
    const branched = pushSnapshot(undone.state, snap('Form A', ['a', 'c']));

    expect(branched.items).toHaveLength(2);
    expect(branched.index).toBe(1);
    expect(canRedo(branched)).toBe(false);
    expect(branched.items[1].components.map((c) => c.key)).toEqual(['a', 'c']);
  });

  it(`caps the history at ${HISTORY_LIMIT} snapshots`, () => {
    let state = createHistory();
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      state = pushSnapshot(state, snap('Form A', [`c${i}`]));
    }

    expect(state.items).toHaveLength(HISTORY_LIMIT);
    expect(state.index).toBe(HISTORY_LIMIT - 1);
    // 5 snapshot cũ nhất đã bị đẩy ra khỏi bộ nhớ
    expect(state.items[0].components[0].key).toBe('c5');
    expect(state.items[HISTORY_LIMIT - 1].components[0].key).toBe(
      `c${HISTORY_LIMIT + 4}`
    );
  });

  it('deep-clones snapshots so later mutations do not corrupt history', () => {
    const components = [comp('a')];
    const state = pushSnapshot(createHistory(), {
      formTitle: 'Form A',
      components,
      selectedCompIndex: 0,
    });

    components[0].label = 'mutated';
    components.push(comp('b'));

    expect(state.items[0].components).toHaveLength(1);
    expect(state.items[0].components[0].label).toBe('a');
  });

  it('isSameSnapshot ignores selectedCompIndex but compares title and components', () => {
    expect(
      isSameSnapshot(snap('Form A', ['a'], 0), snap('Form A', ['a'], 5))
    ).toBe(true);
    expect(isSameSnapshot(snap('Form A', ['a']), snap('Form B', ['a']))).toBe(
      false
    );
    expect(isSameSnapshot(snap('Form A', ['a']), snap('Form A', ['a', 'b']))).toBe(
      false
    );
    expect(isSameSnapshot(undefined, snap('Form A', ['a']))).toBe(false);
  });
});
