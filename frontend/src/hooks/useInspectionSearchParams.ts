import { useCallback } from 'react';
import { useSearchParams, type NavigateOptions } from 'react-router-dom';

// Table rows may still hold the previous render's handlers during navigation.
// Compose each update from the browser's current URL so a rapid open/close
// cannot overwrite a filter or another query parameter just committed.
export function useInspectionSearchParams() {
  const [params, setParams] = useSearchParams();
  const updateParams = useCallback((update: (current: URLSearchParams) => URLSearchParams, options?: NavigateOptions) => {
    setParams(update(new URLSearchParams(window.location.search)), options);
  }, [setParams]);
  return [params, updateParams] as const;
}
