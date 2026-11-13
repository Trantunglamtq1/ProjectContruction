import { useEffect, useState } from 'react';
import { fetchPrivateFile } from '../services/privateFiles';
import { PROJECT_ACCESS_CHANGED, PROJECT_ACCESS_DENIED } from '../services/projectScope';

export function usePrivateFile(url: string) {
  const [source, setSource] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    setSource(undefined);
    const clear = () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); setSource(undefined); };
    window.addEventListener(PROJECT_ACCESS_CHANGED, clear); window.addEventListener(PROJECT_ACCESS_DENIED, clear);
    void fetchPrivateFile(url, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setSource(objectUrl);
    }).catch(() => { setSource(undefined); });
    return () => { clear(); window.removeEventListener(PROJECT_ACCESS_CHANGED, clear); window.removeEventListener(PROJECT_ACCESS_DENIED, clear); };
  }, [url]);
  return source;
}
