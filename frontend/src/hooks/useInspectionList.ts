import { getSelectedProjectId } from '../services/projectScope';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { inspectionApi } from '../services/inspectionApi';
import { readInspectionListState, updateInspectionListState } from './inspectionListState';
import { useInspectionSearchParams } from './useInspectionSearchParams';

export function useInspectionList() {
  const [params, setParams] = useInspectionSearchParams();
  const { user } = useAuth();
  const state = readInspectionListState(params);
  const [searchText, setSearchText] = useState(state.search);
  useEffect(() => { setSearchText(state.search); }, [state.search]);
  useEffect(() => {
    if (searchText === state.search) return;
    const timer = window.setTimeout(() => setParams(previous => updateInspectionListState(previous, { search: searchText })), 350);
    return () => window.clearTimeout(timer);
  }, [searchText, state.search, setParams]);
  const query = useQuery({
    queryKey: ['inspections', user?.role, state.search, state.status, state.page, state.pageSize, getSelectedProjectId()],
    queryFn: ({ signal }) => inspectionApi.getInspections({ pageNumber: state.page, pageSize: state.pageSize,
      search: state.search || undefined, status: state.status === 'ALL' ? undefined : state.status }, signal),
  });
  return { searchText, setSearchText, statusFilter: state.status,
    setStatusFilter: (status: string) => setParams(previous => updateInspectionListState(previous, { status })),
    pageIndex: state.page, pageSize: state.pageSize,
    setPagination: (page: number, pageSize: number) => setParams(previous => updateInspectionListState(previous, { page, pageSize })),
    clearFilters: () => { setSearchText(''); setParams(previous => updateInspectionListState(previous, { search: '', status: 'ALL' })); },
    loading: query.isFetching, inspections: query.data?.items || [], totalCount: query.data?.totalCount ?? 0,
    listError: query.error, loadData: () => { void query.refetch(); },
  };
}
