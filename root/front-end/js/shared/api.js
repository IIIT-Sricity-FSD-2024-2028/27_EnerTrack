/**
 * api.js — Centralized API client for EnerTrack frontend.
 * All pages should load this script FIRST before any other JS.
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

const API_BASE = "http://localhost:3000/api";

/**
 * Returns the current user's ID from localStorage.
 * Sent as the x-user-id header for RBAC on every request.
 */
function _getUserId() {
  try {
    const user = JSON.parse(localStorage.getItem("currentUser") || "null");
    return user && user.user_id ? user.user_id : "";
  } catch (e) {
    return "";
  }
}

/**
 * Returns the current user's organisation id from localStorage.
 * Sent as the x-org-id header so the backend can scope data to that tenant.
 *
 * EnerTrack staff have no organisation, so this returns "" for them and the
 * header is omitted, which gives them the platform-wide view.
 */
function _getOrgId() {
  try {
    const user = JSON.parse(localStorage.getItem("currentUser") || "null");
    return user && user.organization_id ? user.organization_id : "";
  } catch (e) {
    return "";
  }
}

/**
 * Core fetch wrapper. Adds Content-Type, x-user-id and x-org-id headers
 * automatically. Throws an Error with a human-readable message on HTTP errors.
 */
async function _apiFetch(path, options = {}) {
  const orgId = _getOrgId();
  const userId = _getUserId();
  const headers = {
    "Content-Type": "application/json",
    ...(userId ? { "x-user-id": userId } : {}),
    ...(orgId ? { "x-org-id": orgId } : {}),
    ...(options.headers || {}),
  };

  console.log(
    `[API Request] ${options.method || "GET"} ${path}`,
    options.body ? JSON.parse(options.body) : "",
  );

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (networkErr) {
    console.error(`[API Network Error] ${path}`, networkErr);
    throw new Error(
      "Cannot reach server. Is the backend running on port 3000?",
    );
  }

  // Parse body whether success or error
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    // NestJS error format: { message, statusCode, error }
    const msg = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message || `HTTP ${response.status}`;
    console.error(`[API Error] ${response.status} on ${path}:`, body);
    throw new Error(msg);
  }

  console.log(`[API Response] ${path}:`, body);

  // Backend wraps everything in { success, data, timestamp }
  // Return data directly for convenience
  return body.data !== undefined ? body.data : body;
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
};

window.api = api;
