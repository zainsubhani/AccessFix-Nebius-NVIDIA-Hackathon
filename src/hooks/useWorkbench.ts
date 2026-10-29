import { useCallback, useEffect, useRef, useState } from 'react';
import { ACTIVE_STATES, type Config, type Run, type RunMode } from '../../shared/types';

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(12_000);
  const response = await fetch(url, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data as T;
}
export function useWorkbench() {
  const [config, setConfig] = useState<Config>();
  const [runs, setRuns] = useState<Run[]>([]);
  const [run, setRun] = useState<Run>();
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem('accessfix-run') || '');
  const mutation = useRef(false);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const [nextConfig, nextRuns] = await Promise.all([api<Config>('/api/config', { signal }), api<Run[]>('/api/runs', { signal })]);
    if (signal?.aborted) return;
    setConfig(nextConfig); setRuns(nextRuns); setConnectionError('');
    const active = nextRuns.find(item => item.id === nextConfig.activeRunId);
    if (!selectedRef.current && active) setSelectedId(active.id);
  }, []);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { await refresh(controller.signal); }
      catch { if (!controller.signal.aborted) setConnectionError('The local runner is unavailable. Reconnecting automatically; saved results remain visible.'); }
      finally { if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(poll, 3500); } }
    };
    void poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, [refresh]);
  useEffect(() => {
    if (!selectedId) { setRun(undefined); sessionStorage.removeItem('accessfix-run'); return; }
    sessionStorage.setItem('accessfix-run', selectedId);
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const next = await api<Run>(`/api/runs/${selectedId}`, { signal: controller.signal });
        if (!controller.signal.aborted && selectedRef.current === selectedId) {
          setRun(next); setConnectionError('');
          if (!ACTIVE_STATES.includes(next.state)) setConfig(current => current?.activeRunId === next.id ? { ...current, activeRunId: undefined } : current);
        }
        if (ACTIVE_STATES.includes(next.state) && !controller.signal.aborted) timer = setTimeout(poll, 900);
      } catch (error) {
        if (!controller.signal.aborted) {
          if (error instanceof Error && error.message === 'Run not found.') { setSelectedId(''); setRun(undefined); setError('That saved run is no longer available. Start a new audit.'); }
          else { setConnectionError('Could not refresh this run. Reconnecting; the run may still be working.'); timer = setTimeout(poll, 2500); }
        }
      }
    };
    void poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, [selectedId]);
  const select = (id: string) => { setError(''); if (id !== selectedRef.current) { setRun(undefined); setSelectedId(id); } };
  const start = async (fixture: string, mode: RunMode) => {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError('');
    try {
      const next = await api<Run>('/api/runs', { method: 'POST', body: JSON.stringify({ fixture, mode }) });
      setRun(next); setSelectedId(next.id); await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'The run could not start.'); }
    finally { mutation.current = false; setBusy(false); }
  };
  const cancel = async () => {
    const active = runs.find(item => item.id === config?.activeRunId);
    if (!active || mutation.current) return;
    mutation.current = true; setBusy(true); setError('');
    try { await api(`/api/runs/${active.id}/cancel`, { method: 'POST', body: '{}' }); await refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not cancel this run.'); }
    finally { mutation.current = false; setBusy(false); }
  };
  return { config, runs, run, error, connectionError, loading, busy, start, cancel, select, refresh, active: !!config?.activeRunId };
}
