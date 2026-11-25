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

// The status words the server sends a student -> pill style and wording.
// Status only: never priority, dates or names.
const STATUS_CLASS = {
  Reported: "status-reported",
  Assigned: "status-dispatched",
  Visited: "status-progress",
  Checking: "status-progress",
  Fixed: "status-closed",
};
const STATUS_LABEL = {
  Reported: "Reported",
  Assigned: "Technician assigned",
  Visited: "Work started",
  Checking: "Waiting for check",
  Fixed: "Fixed",
};

export function statusLabel(status) {
  return STATUS_LABEL[status] || status;
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
