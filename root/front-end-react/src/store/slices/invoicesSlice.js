/**
 * invoicesSlice.js: /invoices (id: invoice_id). Owner: Person 3.
 *
 * CRUD from createCrudSlice (see its header). Archiving is an update:
 *   dispatch(updateInvoice({ id, changes: { archived: true } }))
 *
 * Extra:
 *   uploadInvoiceDocument({ id, file })
 *     POST /invoices/:id/document (multipart, PDF only). The server answers
 *     with the updated invoice, which replaces the row, so "View PDF" shows
 *     at once.
 *   fetchInvoiceDocumentUrl(id)
 *     GET /invoices/:id/document as a temporary blob: URL. Not stored: it is
 *     UI state, and the component that asked for it revokes it.
 *
 * Selectors (normalized with normalizeInvoice):
 *   selectInvoiceRows       every invoice
 *   selectActiveInvoices    not archived (the Reports page)
 *   selectArchivedInvoices  archived (the Archives page)
 */
import { createSelector } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";
import { normalizeInvoice } from "../derive/finance";

export const uploadInvoiceDocument = apiThunk("invoices/uploadDocument", ({ id, file }) =>
  api.upload(`/invoices/${id}/document`, "file", file),
);

export const fetchInvoiceDocumentUrl = apiThunk("invoices/fetchDocumentUrl", (id) =>
  api.getBlobUrl(`/invoices/${id}/document`),
);

const invoices = createCrudSlice({
  name: "invoices",
  path: "/invoices",
  idKey: "invoice_id",
  extraReducers: (builder, { adapter, isRow }) => {
    builder.addCase(uploadInvoiceDocument.fulfilled, (state, { payload }) => {
      if (isRow(payload)) adapter.upsertOne(state, payload);
    });
  },
});

export const {
  fetchAll: fetchInvoices,
  fetchOne: fetchInvoice,
  create: createInvoice,
  update: updateInvoice,
  remove: removeInvoice,
} = invoices.thunks;

export const {
  selectAll: selectAllInvoices,
  selectById: selectInvoiceById,
  selectStatus: selectInvoicesStatus,
  selectError: selectInvoicesError,
} = invoices.selectors;

export const selectInvoiceRows = createSelector([selectAllInvoices], (rows) =>
  rows.map(normalizeInvoice),
);

export const selectActiveInvoices = createSelector([selectInvoiceRows], (rows) =>
  rows.filter((i) => !i.archived),
);

export const selectArchivedInvoices = createSelector([selectInvoiceRows], (rows) =>
  rows.filter((i) => i.archived),
);

export default invoices.reducer;
