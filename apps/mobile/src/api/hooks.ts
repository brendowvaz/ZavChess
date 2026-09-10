import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage, isAbort } from './client';

export function useResource<T>(path: string | null, revision = 0) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean; key: string | null }>({ data: null, error: null, loading: !!path, key: path });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce(n => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    if (!path) { setState({ data: null, error: null, loading: false, key: null }); return; }
    setState({ data: null, error: null, loading: true, key: path });
    api.get<T>(path, controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ data, error: null, loading: false, key: path });
    }).catch(error => {
      if (!controller.signal.aborted && !isAbort(error)) setState({ data: null, error: errorMessage(error), loading: false, key: path });
    });
    return () => controller.abort();
  }, [path, revision, nonce]);
  return { ...(state.key === path ? state : { data: null, error: null, loading: !!path }), reload };
}

/** Serializes writes and cancels them when a screen is closed. */
export function useOperation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const run = async (operation: (signal: AbortSignal) => Promise<void>) => {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(true); setError(null);
    try { await operation(current.signal); }
    catch (e) { if (!current.signal.aborted && !isAbort(e)) setError(errorMessage(e)); }
    finally { if (!current.signal.aborted) { setBusy(false); controller.current = null; } }
  };
  return { busy, error, run, clearError: () => setError(null) };
}

export function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return debounced;
}
