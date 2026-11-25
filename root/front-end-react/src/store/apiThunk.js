/**
 * apiThunk.js: createAsyncThunk with this app's error shape.
 *
 * createAsyncThunk turns a thrown Error into a plain object, which drops custom
 * fields. Our API client marks "backend unreachable" errors with
 * `isNetworkError`, and pages check that flag through isNetworkError() from
 * api/client.js. This keeps the flag, so
 *
 *   try { await dispatch(updateInvoice({ id, changes })).unwrap(); }
 *   catch (err) { if (isNetworkError(err)) ...; else toast(err.message); }
 *
 * works exactly as `await api.patch(...)` did before.
 *
 * Use this for every thunk that calls the API, not createAsyncThunk directly.
 */
import { createAsyncThunk } from "@reduxjs/toolkit";

function serializeError(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || "Something went wrong.",
    isNetworkError: Boolean(error?.isNetworkError),
  };
}

export function apiThunk(type, payloadCreator, options = {}) {
  return createAsyncThunk(type, payloadCreator, { serializeError, ...options });
}
