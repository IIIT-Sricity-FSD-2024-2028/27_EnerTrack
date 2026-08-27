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
 * Returns the current user's role from localStorage.
 * Sent as the x-role header for RBAC on every request.
 */
function _getRole() {
  try {
    const user = JSON.parse(localStorage.getItem("currentUser") || "null");
    return user ? user.role : "";
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
 * Core fetch wrapper. Adds Content-Type, x-role and x-org-id headers
 * automatically. Throws an Error with a human-readable message on HTTP errors.
 */
async function _apiFetch(path, options = {}) {
  const orgId = _getOrgId();
  const headers = {
    "Content-Type": "application/json",
    "x-role": _getRole(),
    ...(orgId ? { "x-org-id": orgId } : {}),
    ...(options.headers || {}),
  };

  // A caller can opt out of a header by passing it as undefined — file
  // uploads do this for Content-Type so the browser can supply the multipart
  // boundary itself. Without this, fetch would send the literal "undefined".
  Object.keys(headers).forEach((key) => {
    if (headers[key] === undefined) delete headers[key];
  });

  // FormData bodies are not JSON, so only try to pretty-print the ones that are.
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  console.log(
    `[API Request] ${options.method || "GET"} ${path}`,
    isFormData ? "(file upload)" : options.body ? JSON.parse(options.body) : "",
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
};

window.api = api;
