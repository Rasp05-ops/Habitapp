import { useCallback, useEffect, useRef, useState } from "react";

/** Loads data with loading / error / reload, and ignores results that arrive after unmount or a newer call. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const run = useRef(0);

  const load = useCallback(async () => {
    const id = ++run.current;
    setLoading(true);
    try { const d = await fn(); if (id === run.current) { setData(d); setError(null); } }
    catch (e) { if (id === run.current) setError(e); }
    finally { if (id === run.current) setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); return () => { run.current++; }; }, [load]);
  return { data, setData, error, loading, reload: load };
}
