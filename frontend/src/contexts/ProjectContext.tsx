import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Result, Spin } from 'antd';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { projectApi, type ProjectDto } from '../services/projectApi';
import { PROJECT_ACCESS_CHANGED, PROJECT_ACCESS_DENIED, resolveProjectSelection, setSelectedProjectId, withProjectScope } from '../services/projectScope';
import { useAuth } from './AuthContext';
import { useConfirmExit } from './UnsavedChangesContext';

type ProjectState = { projects: ProjectDto[]; projectId: string | null; loading: boolean; error: unknown;
  denied: boolean; selectProject: (id: string, target?: string) => void; refresh: () => void };
const Context = createContext<ProjectState | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const confirmExit = useConfirmExit();
  const storageKey = `selected-project:${user?.id}`;
  const [saved, setSaved] = useState<string | null>(() => sessionStorage.getItem(storageKey));
  const [denied, setDenied] = useState(false);
  const query = useQuery({ queryKey: ['projects', user?.id], queryFn: projectApi.list, enabled: !!user?.id, refetchInterval: 15000, refetchOnWindowFocus: true });
  const projects = query.data ?? [];
  const requested = new URLSearchParams(location.search).get('projectId');
  const projectId = denied ? null : resolveProjectSelection(projects, requested, saved);
  const previous = useRef<string | null>(null);
  // Children mount only after project validation; API requests read this exact scope.
  setSelectedProjectId(projectId);

  useEffect(() => {
    previous.current = projectId;
  }, [projectId]);

  useEffect(() => {
    if (projectId && requested && saved !== projectId) {
      sessionStorage.setItem(storageKey, projectId);
      setSaved(projectId);
    }
  }, [projectId, requested, saved, storageKey]);

  useEffect(() => {
    if (projectId && !requested && location.pathname !== '/projects' && location.pathname !== '/admin/users') {
      navigate(withProjectScope(location.pathname + location.search + location.hash, projectId), { replace: true });
    }
  }, [projectId, requested, location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    const clear = () => {
      setDenied(true); setSaved(null); setSelectedProjectId(null); sessionStorage.removeItem(storageKey);
      void queryClient.cancelQueries();
      queryClient.removeQueries({ predicate: q => q.queryKey[0] !== 'projects' });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
    };
    const changed = (event: Event) => {
      const id = (event as CustomEvent<{ projectId: string }>).detail?.projectId;
      if (id === previous.current) clear();
      else void queryClient.invalidateQueries({ queryKey: ['projects'] });
    };
    window.addEventListener(PROJECT_ACCESS_DENIED, clear);
    window.addEventListener(PROJECT_ACCESS_CHANGED, changed);
    return () => { window.removeEventListener(PROJECT_ACCESS_DENIED, clear); window.removeEventListener(PROJECT_ACCESS_CHANGED, changed); setSelectedProjectId(null); };
  }, [queryClient, storageKey]);

  const selectProject = useCallback((id: string, target?: string) => {
    if (!projects.some(p => p.id === id)) return;
    confirmExit(() => {
      void queryClient.cancelQueries({ predicate: q => q.queryKey[0] !== 'projects' });
      queryClient.removeQueries({ predicate: q => q.queryKey[0] !== 'projects' });
      sessionStorage.setItem(storageKey, id); setSaved(id); setDenied(false); setSelectedProjectId(id);
      const path = target ?? (user?.role === 'Admin' ? '/projects' : `/${user?.role?.toLowerCase()}/drawings`);
      const url = new URL(path, window.location.origin); url.searchParams.set('projectId', id);
      navigate(url.pathname + url.search);
    });
  }, [projects, confirmExit, queryClient, storageKey, user?.role, navigate]);

  return <Context.Provider value={{ projects, projectId, denied, loading: query.isPending, error: query.error, selectProject, refresh: () => { void query.refetch(); } }}>{children}</Context.Provider>;
}

export function useProject() {
  const value = useContext(Context);
  if (!value) throw new Error('ProjectProvider is required');
  return value;
}

export function ProjectBoundary({ children }: { children: ReactNode }) {
  const { projectId, loading, denied, error } = useProject();
  const navigate = useNavigate();
  if (loading) return <Spin />;
  if (!projectId || error) return <Result status={denied ? '403' : 'info'} title={denied ? 'Quyền truy cập dự án đã thay đổi' : 'Chọn dự án để tiếp tục'}
    subTitle={denied ? 'Vui lòng chọn lại dự án được phân công. Phiên đăng nhập vẫn còn hiệu lực.' : 'Bạn chỉ có thể truy cập dữ liệu trong dự án được phân công.'}
    extra={<Button type="primary" onClick={() => navigate('/projects')}>Danh sách dự án</Button>} />;
  return <div key={projectId} style={{ display: 'contents' }}>{children}</div>;
}
