import { useCallback, useEffect, useState } from "react";

// Loads one page of a list whenever the params change.
// fetcher(params) must resolve to { [key]: rows, total, pages }.
// Old rows stay on screen (flagged "stale") while the next page loads.
export default function usePagedList(fetcher, key, params) {
  const [refresh, setRefresh] = useState(0);
  const [res, setRes] = useState({ sig: null, rows: [], total: 0, pages: 1, error: null });
  const paramsKey = JSON.stringify(params);
  const sig = `${paramsKey}|${refresh}`;

  useEffect(() => {
    let cancelled = false;
    fetcher(JSON.parse(paramsKey))
      .then((data) => {
        if (!cancelled) {
          setRes({ sig, rows: data[key] || [], total: data.total ?? 0, pages: data.pages || 1, error: null });
        }
      })
      .catch((err) => {
        if (!cancelled) setRes({ sig, rows: [], total: 0, pages: 1, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [fetcher, key, paramsKey, sig]);

  const reload = useCallback(() => setRefresh((r) => r + 1), []);

  // Update one row in place after an edit, without refetching
  const patchRow = useCallback(
    (id, row) => setRes((r) => ({ ...r, rows: r.rows.map((x) => (x.id === id ? { ...x, ...row } : x)) })),
    []
  );

  return { ...res, loading: res.sig === null, stale: res.sig !== sig, reload, patchRow };
}
