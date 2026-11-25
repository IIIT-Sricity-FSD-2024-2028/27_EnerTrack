/**
 * useLiveData: load some slices when a page opens, keep them fresh, and say
 * whether the page has what it needs.
 *
 *   // module level, so the array is the same on every render
 *   const LOADS = [fetchAlerts, fetchFaults, fetchMeters, fetchBuildings];
 *
 *   const { loading, error, reload, updatedAt } = useLiveData(LOADS);
 *
 * - Every thunk is dispatched with { force: true } on open and then every
 *   `intervalMs` (default 30 s; pass 0 for no polling).
 * - loading: some slice has never loaded yet. A refresh on top of data
 *   already shown does not count, so the page never flashes a spinner.
 * - ready:   every slice has data (so an error is only a failed refresh).
 * - error:   the first slice whose last load failed, else "".
 * - reload:  load everything again now (a Retry button, or after an action).
 * - updatedAt: when the last full reload finished without error.
 *
 * Each thunk must be a load thunk from createCrudSlice (fetchAll) or
 * createResourceSlice (fetch); its slice name is read from its type.
 */
import { useCallback, useEffect, useState } from "react";
import { shallowEqual, useDispatch, useSelector } from "react-redux";

const sliceOf = (thunk) => thunk.typePrefix.split("/")[0];

export function useLiveData(thunks, { intervalMs = 30000 } = {}) {
  const dispatch = useDispatch();
  const [updatedAt, setUpdatedAt] = useState(null);

  const loads = useSelector(
    (state) => thunks.map((t) => state[sliceOf(t)]),
    shallowEqual,
  );
  const loading = loads.some(
    (l) => l.status === "idle" || l.status === "loading",
  );
  const ready = loads.every((l) => l.status === "succeeded");
  const error = loads.find((l) => l.error)?.error || "";

  // setState only inside .then, the pattern react-hooks/set-state-in-effect
  // accepts (the effect below calls this).
  const reload = useCallback(
    () =>
      Promise.all(thunks.map((t) => dispatch(t({ force: true })))).then(
        (results) => {
          if (results.every((r) => !r.error)) setUpdatedAt(new Date());
        },
      ),
    [dispatch, thunks],
  );

  useEffect(() => {
    reload();
    if (!intervalMs) return undefined;
    const timer = setInterval(reload, intervalMs);
    return () => clearInterval(timer);
  }, [reload, intervalMs]);

  return { loading, ready, error, reload, updatedAt };
}
