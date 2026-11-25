/**
 * auditShared.js — constants and helpers shared by the officer's wastage
 * queue (audit/) and the Wastage Resolutions archive (archives/).
 */

// Same per-metric colours as the Monitoring chart legend
export const TYPE_COLORS = { Energy: "#059669", Water: "#0284c7", Emissions: "#7c3aed", Food: "#dc2626" };

/** Comment avatars, by the role recorded on the comment. */
export const ROLE_BADGES = {
  "Sustainability Officer": { label: "SO", color: "#059669" },
  "Finance Analyst": { label: "FA", color: "#6366f1" },
  // POST /:id/comments records the RBAC role name
  "Financial Analyst": { label: "FA", color: "#6366f1" },
};

// Wastage cases. Older records may still say "pending", "Reported" or
// "Validated" (all mean Open now) or "Finalized" / "Delivered" (Closed).
const STATUS_ALIASES = {
  open: "Open",
  pending: "Open",
  reported: "Open",
  validated: "Open",
  "forwarded to finance": "Forwarded to Finance",
  "cost impact added": "Cost Impact Added",
  "returned to so": "Returned to SO",
  "target set": "Target Set",
  "verify target": "Verify Target",
  "target met": "Target Met",
  "target missed": "Target Missed",
  finalized: "Closed",
  dismissed: "Dismissed",
  delivered: "Closed",
  closed: "Closed",
};

export function normalizeStatus(status) {
  if (!status) return "Open";
  return STATUS_ALIASES[String(status).trim().toLowerCase()] || status;
}
