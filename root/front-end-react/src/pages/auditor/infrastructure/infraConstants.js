/**
 * infraConstants.js — the choices offered in the meter form.
 *
 * Copied from js/system_admin/data/mockData.js rather than imported from
 * pages/admin, so the auditor folder does not depend on the admin folder.
 * They match the backend's MeterType and MeterStatus enums.
 */
export const METER_TYPES = ["electricity", "gas", "water", "emissions", "food"];

export const METER_STATUSES = [
  "active",
  "faulty",
  "calibrating",
  "decommissioned",
];

/** The API path for each kind of record, used to save and delete. */
export const API_PATH = {
  campus: "/campus",
  building: "/buildings",
  department: "/departments",
  meter: "/meters",
};
