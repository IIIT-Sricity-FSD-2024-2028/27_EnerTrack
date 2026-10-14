/**
 * techUtils.js — small helpers shared by the technician pages.
 */

/**
 * Turns a long backend id into a short label for the screen.
 *
 *   formatId("550e8400-0003-4000-8000-000000000003", "WO")  ->  "WO-0003"
 *   formatId("WO-1234", "WO")                               ->  "WO-1234"
 *   formatId("abcd1234", "SR")                              ->  "SR-ABCD"
 *   formatId(null, "SR")                                    ->  "SR-XXXX"
 *
 * Ported from formatID() in js/technician/overviewPage.js.
 */
export function formatId(id, prefix) {
  if (!id) {
    return prefix + "-XXXX";
  }

  // Already in the short form.
  if (id.startsWith(prefix + "-")) {
    return id;
  }

  // A UUID: use its second block.
  const parts = id.split("-");
  if (parts.length > 1) {
    return prefix + "-" + parts[1].toUpperCase();
  }

  // Anything else: use its first four characters.
  return prefix + "-" + id.substring(0, 4).toUpperCase();
}

/**
 * "high" -> "High". Used for severity and status badges.
 */
export function capitalize(text) {
  if (!text) {
    return "";
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The badge colour for a fault severity. Faults only use three colours:
 * high and critical are both red ("critical").
 * Ported from severityClass() in js/technician/maintenancePage.js.
 */
export function severityClass(severity) {
  if (severity === "high" || severity === "critical") {
    return "critical";
  }
  if (severity === "moderate") {
    return "moderate";
  }
  return "low";
}

/**
 * Faults that still need a technician to diagnose them: active or pending,
 * and not yet handed off as a work order. A flagged fault keeps its status,
 * but the work order created for it carries its id in linked_fault_id.
 *
 * Used by both the Overview card and the Diagnostics page, so the two can
 * never show different numbers.
 */
export function faultsAwaitingDiagnosis(faults, workOrders) {
  // Ids of faults that already have a work order.
  const flaggedIds = [];
  for (const wo of workOrders) {
    if (wo.linked_fault_id) {
      flaggedIds.push(wo.linked_fault_id);
    }
  }

  return faults.filter(
    (f) =>
      (f.status === "active" || f.status === "pending") &&
      !flaggedIds.includes(f.fault_id),
  );
}

/**
 * The badge colour for a work-order priority. Work orders use
 * immediate / high / medium / low, but tech_shared.css only has badge
 * colours named high / moderate / low — so map onto those.
 */
export function priorityBadgeClass(priority) {
  if (priority === "immediate" || priority === "high") {
    return "high";
  }
  if (priority === "medium") {
    return "moderate";
  }
  return "low";
}

/**
 * When an alert was raised. Alerts have no timestamp field of their own, so
 * this uses the first message in the alert's thread, as the old page did.
 *
 *   "2026-05-05T08:00:00.000Z"  ->  "5/5/2026, 1:30:00 PM"  (in local time)
 */
export function alertTime(alert) {
  if (!alert.messages || alert.messages.length === 0) {
    return "—";
  }
  return new Date(alert.messages[0].timestamp).toLocaleString();
}

// Every role that can act on alerts. Facility Manager uses the Technician
// Administrator dashboard (see ROLE_AREA in src/routes.js).
const TECHNICIAN_ROLES = [
  "Technician Administrator",
  "Facility Manager",
  "Technician",
];

/**
 * The action a technician recorded on an alert ("Inspection Scheduled", ...).
 * The Alerts page saves it as a message on the alert's thread, so this is
 * the newest message posted by a technician, or "—" if there is none.
 */
export function actionTaken(alert) {
  if (!alert.messages) {
    return "—";
  }
  // Walk backwards so the newest technician message is found first.
  for (let i = alert.messages.length - 1; i >= 0; i--) {
    const message = alert.messages[i];
    if (TECHNICIAN_ROLES.includes(message.sender_role)) {
      return message.content;
    }
  }
  return "—";
}

/**
 * The name of a user from their id, e.g. the technician on a work order.
 * Returns "Unassigned" when there is no id or no user with that id.
 */
export function userName(users, userId) {
  if (!userId) {
    return "Unassigned";
  }
  const user = users.find((u) => u.user_id === userId);
  if (user) {
    return user.name;
  }
  return "Unassigned";
}

// Roles that can be given a work order.
const ASSIGNABLE_ROLES = [
  "Technician",
  "Technician Administrator",
  "Facility Manager",
];

/** The users that can be picked as a work order's technician. */
export function assignableUsers(users) {
  return users.filter((u) => ASSIGNABLE_ROLES.includes(u.role));
}

/**
 * Where a work order's cost estimate stands, for the board cards.
 * The estimate and the "is one needed" flag both live inside wo.details.
 */
export function estimateLabel(wo) {
  const details = wo.details || {};
  if (!details.estimateRequired) {
    return "Not required";
  }
  if (details.estimate) {
    return "Submitted";
  }
  return "Needed";
}

/**
 * The first word of a full name, for "Welcome back, Chirag".
 * Falls back to "there" while the session is still loading.
 */
export function firstName(fullName) {
  if (!fullName) {
    return "there";
  }
  return fullName.split(" ")[0];
}
