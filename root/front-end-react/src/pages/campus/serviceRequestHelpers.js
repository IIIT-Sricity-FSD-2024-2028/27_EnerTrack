// Shared by Dashboard.jsx (My Reports) and Archives.jsx.
//
// The form saves a report as "[Type] text — Location: place" because the
// backend has no location field. splitDescription() undoes that. A
// description that does not match (e.g. a request made elsewhere) is
// returned whole, with no location and no type.

const LOCATION_MARKER = " — Location: ";

export function splitDescription(raw) {
  let text = raw || "";
  let issueType = "";
  let location = "";

  const typeMatch = text.match(/^\[([^\]]*)\]\s*/);
  if (typeMatch) {
    issueType = typeMatch[1];
    text = text.slice(typeMatch[0].length);
  }

  const at = text.lastIndexOf(LOCATION_MARKER);
  if (at !== -1) {
    location = text.slice(at + LOCATION_MARKER.length).trim();
    text = text.slice(0, at);
  }

  return { description: text, location, issueType };
}

// The five steps shown in the "What Happens Next" timeline.
export const TIMELINE_STEPS = [
  {
    num: 1,
    label: "You Report",
    desc: "Submit this form — takes under 1 minute.",
  },
  {
    num: 2,
    label: "System Admin Review",
    desc: "The Administrator triages and forwards your request.",
  },
  {
    num: 3,
    label: "Dispatched",
    desc: "A Technician is assigned and briefed.",
  },
  {
    num: 4,
    label: "Work in Progress",
    desc: "Technician assesses and carries out repairs.",
  },
  {
    num: 5,
    label: "Resolved",
    desc: "Issue is verified and closed. Track it below.",
  },
];

// Works out which timeline step a request is on, from its status and the
// work orders raised from it. Returns { step, note }: `note` is the small
// sentence shown under the active step.
export function getProgress(status, orders = []) {
  const s = String(status || "open").toLowerCase();
  if (
    ["closed", "resolved", "completed"].includes(s) ||
    orders.some((wo) => wo.status === "closed")
  ) {
    return { step: 5, note: "" };
  }

  const working = orders.find((wo) =>
    ["inprogress", "approval", "review"].includes(wo.status),
  );
  if (working) {
    const notes = {
      inprogress: "The technician is carrying out the repairs.",
      approval: "The repair cost estimate is waiting for approval.",
      review: "Repairs are done and are being verified.",
    };
    return { step: 4, note: notes[working.status] };
  }

  if (orders.some((wo) => wo.status === "new" && wo.assigned_to_id)) {
    return {
      step: 3,
      note: "A technician has been assigned and will pick this up shortly.",
    };
  }

  return { step: 2, note: "Your report is with the administrator for review." };
}

// Turns a raw status ("open", "inprogress", "closed", ...) into the pill's
// CSS class and label. Same rules as deriveStatusMeta() in enduser.js.
export function getStatusInfo(statusValue) {
  const status = String(statusValue || "open").toLowerCase();

  if (["closed", "resolved", "completed"].includes(status)) {
    return { cssClass: "status-closed", label: "Completed" };
  }
  if (
    ["in_progress", "inprogress", "approval", "review", "new"].includes(status)
  ) {
    return { cssClass: "status-progress", label: "In Progress" };
  }
  if (["pending", "pending_category"].includes(status)) {
    return { cssClass: "status-forwarded", label: "Under Review" };
  }
  if (status === "dispatched") {
    return { cssClass: "status-dispatched", label: "Dispatched" };
  }
  return { cssClass: "status-reported", label: "Reported" };
}
