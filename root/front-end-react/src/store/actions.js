/**
 * actions.js: app-wide actions that every slice may react to.
 *
 * resetData empties every data slice (users, work orders, invoices, ...) and
 * leaves only `auth` and `ui`. It fires on sign-out, on session expiry, and
 * whenever a Super Admin starts or stops acting as someone else, so one
 * person's data is never shown to another. Slices get this for free: the
 * root reducer in store/store.js handles it, so no slice needs a case for it.
 */
import { createAction } from "@reduxjs/toolkit";

export const resetData = createAction("app/resetData");
