/**
 * backendStatus.js: the API client's line into the store for "is the backend
 * reachable?".
 *
 * api/client.js calls markOffline() when a request cannot connect and
 * markOnline() on any HTTP answer (even a 404 or 403 proves the server is
 * up). The state itself lives in the `ui` slice (store/slices/uiSlice.js),
 * and ui/BackendStatusBanner.jsx reads it from there.
 *
 * The store hands us its dispatch at start-up (bindBackendStatus, called in
 * store/index.js) so this file, and the API client, never import the store.
 * That import would be circular: the store's slices import the API client.
 */
import { backendOffline, backendOnline } from "../store/slices/uiSlice";

let dispatch = null;
// Mirror of ui.backend.offline, so a normal successful request does not
// dispatch anything at all.
let offline = false;

export function bindBackendStatus(storeDispatch) {
  dispatch = storeDispatch;
}

/** A request could not reach the server at all. */
export function markOffline() {
  if (!dispatch || offline) return;
  offline = true;
  dispatch(backendOffline());
}

/** The server answered. If we had been offline, the banner says it is back. */
export function markOnline() {
  if (!dispatch || !offline) return;
  offline = false;
  dispatch(backendOnline());
}
