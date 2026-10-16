/**
 * api.js — Centralized API client for EnerTrack frontend.
 * All pages should load this script FIRST before any other JS.
 *
 * Every request carries the signed-in user's token as
 * `Authorization: Bearer <token>`; the backend works out role and organisation
 * from that, never from headers the browser could make up.
 *
 * Usage:
 *   const result = await api.get('/work-orders');        // GET
 *   const result = await api.post('/users/login', dto);  // POST
 *   const result = await api.patch('/alerts/id', dto);   // PATCH
 *   const result = await api.delete('/invoices/id');     // DELETE
 *
 * Every response from the backend is wrapped as:
 *   { success: true, data: <payload>, timestamp: "..." }
 * api.get/post/etc. unwrap and return the `data` field directly.
 */

import { markOffline, markOnline } from "./backendStatus";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000/api";

/**
 * The backend could not be reached at all (not running, wrong port, no
 * network). Told apart from an HTTP error by its class, not its message, so
 * rewording the message can never break the checks that depend on it.
 */
export class ApiNetworkError extends Error {
  constructor(cause) {
    super("Can't reach the backend. Check that the server is running, then try again.", {
      cause,
    });
    this.name = "ApiNetworkError";
    this.isNetworkError = true;
  }
}

/**
 * fetch() that reports whether the backend answered. Every request in this
 * file goes through here, so the connection banner is always up to date.
 */
async function _fetch(url, init) {
  let response;
  try {
    response = await fetch(url, init);
  } catch (networkErr) {
    markOffline();
    throw new ApiNetworkError(networkErr);
  }
  markOnline();
  return response;
}

/** Asks the backend whether it is up. Used by the banner's "Try again". */
export async function pingBackend() {
  try {
    await _fetch(API_BASE, { method: "GET" });
    return true;
  } catch {
    return false;
  }
}

/**
 * The sign-in token the backend issued at login, kept inside the
 * localStorage.currentUser session. It is the only thing the backend trusts to
 * know who is calling and what role they hold: the role and organisation are
 * read from the token's signature, not from anything the browser types.
 */
function _getToken() {
  try {
    const user = JSON.parse(localStorage.getItem("currentUser") || "null");
    return user && user.token ? user.token : "";
  } catch {
    return "";
  }
}

/** Event fired when the backend refuses our token (expired or invalid). */
export const SESSION_EXPIRED_EVENT = "enertrack:session-expired";

/**
 * A 401 on a request that carried a token means the session is no longer
 * valid. Drop it and tell the app, so the person lands on sign-in instead of
 * staring at pages that fail to load. A 401 with no token (a wrong password at
 * the sign-in form) is not an expired session and is left alone.
 */
function _endSessionIfRejected(response, hadToken) {
  if (response.status !== 401 || !hadToken) return;
  try {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("enertrack_impersonator");
  } catch {
    // storage unavailable: the event below still signs the app out
  }
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

/**
 * Core fetch wrapper. Adds Content-Type and the Authorization token
 * automatically. Throws an Error with a human-readable message on HTTP errors.
 */
async function _apiFetch(path, options = {}) {
  const token = _getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  // A caller can opt out of a header by passing it as undefined — file
  // uploads do this for Content-Type so the browser can supply the multipart
  // boundary itself. Without this, fetch would send the literal "undefined".
  Object.keys(headers).forEach((key) => {
    if (headers[key] === undefined) delete headers[key];
  });

  const response = await _fetch(`${API_BASE}${path}`, { ...options, headers });
  _endSessionIfRejected(response, Boolean(token));

  // Parse body whether success or error
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    // NestJS error format: { message, statusCode, error }
    const msg = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }

  // Backend wraps everything in { success, data, timestamp }
  // Return data directly for convenience
  return body.data !== undefined ? body.data : body;
}

/**
 * Uploads one or more files to a multipart endpoint.
 *
 *   api.upload('/invoices/abc-123/document', 'file', pdfFile);
 *   api.upload('/wastage-reports/abc-123/photos', 'files', [img1, img2]);
 *
 * The Content-Type header is deliberately NOT set here. A multipart request
 * needs a boundary marker in its Content-Type, and only the browser knows
 * what that boundary is — setting the header by hand produces a request the
 * server cannot parse. Passing `undefined` tells _apiFetch to leave it off so
 * fetch can fill it in.
 *
 * @param {string} path       API path, e.g. '/invoices/<id>/document'
 * @param {string} fieldName  Form field the backend expects ('file' or 'files')
 * @param {File|File[]} files One File, or an array of them
 */
function _apiUpload(path, fieldName, files) {
  const formData = new FormData();
  const list = Array.isArray(files) ? files : [files];
  list.forEach((file) => formData.append(fieldName, file));

  return _apiFetch(path, {
    method: "POST",
    body: formData,
    headers: { "Content-Type": undefined },
  });
}

/**
 * Fetches a binary file (an uploaded photo or document) as an object URL a
 * plain <img>/<a> tag can use.
 *
 * A bare <img src="..."> request carries no headers at all, but every route
 * in this app is gated on the Authorization token _apiFetch adds — a plain
 * <img> pointed at a protected file route would just 403. Routing the fetch
 * through here instead sends that token like any other API call, then hands
 * back a local blob: URL for the <img> to use.
 *
 * Caller is responsible for revoking the URL (URL.revokeObjectURL) once the
 * image is no longer needed, the same as any other object URL.
 *
 * @param {string} path API path, e.g. '/wastage-reports/<id>/photos/<file>'
 */
async function _apiFetchBlobUrl(path) {
  const token = _getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await _fetch(`${API_BASE}${path}`, { headers });
  _endSessionIfRejected(response, Boolean(token));
  if (!response.ok) {
    throw new Error(`Could not load file (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Public API surface
 */
const api = {
  get: (path) => _apiFetch(path, { method: "GET" }),
  post: (path, body) =>
    _apiFetch(path, { method: "POST", body: JSON.stringify(body) }),
  patch: (path, body) =>
    _apiFetch(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: (path, body) =>
    _apiFetch(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path) => _apiFetch(path, { method: "DELETE" }),
  upload: _apiUpload,
  getBlobUrl: _apiFetchBlobUrl,
};

/**
 * Checks whether an error is due to network failure / unreachable backend.
 */
export function isNetworkError(error) {
  return Boolean(error?.isNetworkError);
}

export default api;
