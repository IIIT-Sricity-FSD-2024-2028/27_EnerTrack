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

// The steps a student sees. Status only: never priority, dates or names.
export const TIMELINE_STEPS = [
  { num: 1, label: "Reported", desc: "We have your report. It is sent to the right team automatically." },
  { num: 2, label: "On its way", desc: "A technician has been given the job." },
  { num: 3, label: "Work started", desc: "Someone has started working on it." },
  { num: 4, label: "Waiting for check", desc: "The work is done and is being checked." },
  { num: 5, label: "Fixed", desc: "The work is done. If it is still broken, tell us." },
];

// The status words the server sends a student -> timeline step, pill style, and wording.
const STATUS_STEP = { Reported: 1, Assigned: 2, Visited: 3, Checking: 4, Fixed: 5 };
const STATUS_CLASS = {
  Reported: "status-reported",
  Assigned: "status-dispatched",
  Visited: "status-progress",
  Checking: "status-progress",
  Fixed: "status-closed",
};
const STATUS_LABEL = {
  Reported: "Reported",
  Assigned: "On its way",
  Visited: "Work started",
  Checking: "Waiting for check",
  Fixed: "Fixed",
};

export function statusLabel(status) {
  return STATUS_LABEL[status] || status;
}

export function statusStep(status) {
  return STATUS_STEP[status] || 1;
}

export function statusClass(status) {
  return STATUS_CLASS[status] || "status-reported";
}

// "2026-05-01T..." -> "11 Nov, 9:42 pm"
export function formatReportedOn(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
