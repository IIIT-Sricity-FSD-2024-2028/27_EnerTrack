/**
 * backendStatus.js — whether the backend can be reached right now.
 *
 * api/client.js reports into this on every request: a failed network call
 * marks the backend offline, and any HTTP answer at all (even a 404 or 403)
 * proves it is running and marks it online again. The banner in
 * ui/BackendStatusBanner.jsx shows it, so every page tells the person what is
 * wrong instead of quietly showing empty tables and zeros.
 *
 * Plain module state with subscribers (read it in React with
 * useSyncExternalStore), so the API client does not have to import React.
 */

let state = { offline: false, recovered: false };
const listeners = new Set();

function set(next) {
  if (next.offline === state.offline && next.recovered === state.recovered)
    return;
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return state;
}

/** A request could not reach the server at all. */
export function markOffline() {
  set({ offline: true, recovered: false });
}

/** The server answered. If we had been offline, say it is back. */
export function markOnline() {
  if (state.offline) set({ offline: false, recovered: true });
}

/** Hide the "connected again" message. */
export function dismissRecovered() {
  set({ offline: false, recovered: false });
}
