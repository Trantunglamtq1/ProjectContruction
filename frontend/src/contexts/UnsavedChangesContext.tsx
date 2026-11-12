import { App } from 'antd';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';

type GuardContext = { register: (id: string, dirty: boolean) => void; discardAndRun: (action: () => void) => void; confirmExit: (action: () => void) => void };
const Context = createContext<GuardContext | null>(null);
const confirmation = { title: 'Bỏ thay đổi chưa lưu?', content: 'Nội dung vừa chỉnh sửa chưa được lưu. Bạn có thể tiếp tục chỉnh sửa hoặc bỏ thay đổi để rời khỏi đây.', okText: 'Bỏ thay đổi', cancelText: 'Tiếp tục chỉnh sửa', okButtonProps: { danger: true }, zIndex: 1600 };

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const { modal } = App.useApp();
  const dirtyIds = useRef(new Set<string>());
  const bypass = useRef(false);
  const prompting = useRef(false);
  const [count, setCount] = useState(0);
  const register = useCallback((id: string, dirty: boolean) => {
    if (dirtyIds.current.has(id) === dirty) return;
    if (dirty) dirtyIds.current.add(id); else dirtyIds.current.delete(id);
    setCount(dirtyIds.current.size);
  }, []);
  const discardAndRun = useCallback((action: () => void) => { bypass.current = true; action(); queueMicrotask(() => { bypass.current = false; }); }, []);
  const confirmExit = useCallback((action: () => void) => {
    if (dirtyIds.current.size) modal.confirm({ ...confirmation, onOk: () => discardAndRun(action) });
    else discardAndRun(action);
  }, [modal, discardAndRun]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !bypass.current && dirtyIds.current.size > 0 && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search));
  useEffect(() => {
    if (blocker.state !== 'blocked' || prompting.current) return;
    prompting.current = true;
    modal.confirm({ ...confirmation, onOk: () => { prompting.current = false; blocker.proceed(); }, onCancel: () => { prompting.current = false; blocker.reset(); } });
  }, [blocker, modal]);
  useEffect(() => {
    if (!count) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [count]);
  return <Context.Provider value={{ register, discardAndRun, confirmExit }}>{children}</Context.Provider>;
}

export function useConfirmExit() {
  const context = useContext(Context);
  if (!context) throw new Error('useConfirmExit requires UnsavedChangesProvider');
  return context.confirmExit;
}

export function useUnsavedChanges(dirty: boolean) {
  const context = useContext(Context);
  const id = useId();
  const { modal } = App.useApp();
  const register = context?.register;
  const discardAndRun = context?.discardAndRun;
  useEffect(() => { register?.(id, dirty); return () => register?.(id, false); }, [register, id, dirty]);
  return useCallback((action: () => void) => {
    const run = () => discardAndRun ? discardAndRun(action) : action();
    if (dirty) modal.confirm({ ...confirmation, onOk: run }); else run();
  }, [dirty, discardAndRun, modal]);
}
