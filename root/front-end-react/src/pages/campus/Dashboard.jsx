/**
 * Dashboard — /campus/dashboard ("Report an Issue"), the Campus Visitor's
 * home page. Replaces html/enduser/enduser_dashboard.html + js/enduser/enduser.js.
 *
 * This is the parent. It:
 *   - loads the visitor's reports (useEffect) and passes them to <MyReports>
 *   - gives <IssueForm> a function to call on submit, and saves the report
 *   - shows the "submitted" toast
 *
 * Works with the backend stopped: reports are then saved to and read from
 * the old local store (universalDB), exactly like the original page. That
 * fallback is ONLY for "server not running". If the server is running but
 * refuses the report, the visitor is told, not shown a fake success.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import universalDB from "../../legacy/universalDB";
import IssueForm from "./IssueForm";
import MyReports from "./MyReports";
import campusCss from "./campus.css?inline";

// True when the request never reached the server (backend stopped). Any
// other error means the server answered and said no.
function isNetworkError(error) {
  return String(error?.message || "").startsWith("Cannot reach server");
}

// Loads this user's reports and returns them in the shape <MyReports> wants,
// newest first. Backend first; if that fails or finds nothing, the local store.
async function fetchMyTickets(user) {
  let tickets = [];

  try {
    const [requests, workOrders] = await Promise.all([
      api.get("/service-requests"),
      api.get("/work-orders"),
    ]);
    const orders = Array.isArray(workOrders) ? workOrders : [];

    if (Array.isArray(requests)) {
      tickets = requests
        .filter((sr) => sr.reporter_id === user.user_id)
        .map((sr) => {
          // A request's status follows its work orders: a closed work order
          // means it is done, an active one means it is being worked on.
          const related = orders.filter(
            (wo) => wo.source_request_id === sr.service_request_id,
          );
          let status = sr.status || "open";
          if (related.some((wo) => wo.status === "closed")) {
            status = "closed";
          } else if (
            status === "open" &&
            related.some((wo) =>
              ["new", "approval", "inprogress", "review"].includes(wo.status),
            )
          ) {
            status = "in_progress";
          }

          return {
            id: sr.service_request_id,
            description: sr.description,
            location: "Campus",
            priority: sr.priority
              ? sr.priority.charAt(0).toUpperCase() + sr.priority.slice(1)
              : "Medium",
            status: status,
            timestamp: sr.created_at, // the backend sends none, so no date
            issueType: "",
          };
        })
        // The backend lists oldest first, so reverse it: newest on top
        .reverse();
    }
  } catch (err) {
    console.warn(
      "[EndUser] Backend fetch failed, using local data",
      err.message,
    );
  }

  // Fallback: reports saved in the browser while the backend was down.
  // These do carry a real timestamp, so sort by it (newest first).
  if (tickets.length === 0) {
    tickets = universalDB.data.workflow.serviceRequests
      .filter((sr) => sr.reporterEmail === user.email)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  return tickets;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [toastVisible, setToastVisible] = useState(false);
  const [errorText, setErrorText] = useState(""); // red toast when not empty

  // Load the reports when the page opens
  useEffect(() => {
    fetchMyTickets(user).then(setTickets);
  }, [user]);

  function showToast() {
    setErrorText("");
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3500);
  }

  function showError(message) {
    setErrorText(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 5000);
  }

  // Called by <IssueForm> with { location, issueType, priority, description }
  async function handleSubmit(values) {
    const type = values.issueType || "General";

    // 1. Try the backend
    try {
      await api.post("/service-requests", {
        reporter_id: user.user_id || "550e8400-0006-4000-8000-000000000006",
        category: "General",
        issue_type: type,
        description: `[${type}] ${values.description} — Location: ${values.location}`,
        priority: values.priority.toLowerCase(),
        status: "open",
      });
      showToast();
      setTickets(await fetchMyTickets(user));
      return true;
    } catch (err) {
      // The server answered but refused (e.g. 403): do not pretend it worked
      if (!isNetworkError(err)) {
        showError("Could not submit your report: " + err.message);
        return false; // tells <IssueForm> to keep what the visitor typed
      }
      console.warn(
        "[EndUser] Could not reach backend, saving locally only:",
        err.message,
      );
    }

    // 2. Backend is not running: save in the browser instead
    universalDB.data.workflow.serviceRequests.push({
      id: "SR-" + Date.now().toString(36).toUpperCase(),
      source: "User-Reported",
      reporterName: user.name,
      reporterEmail: user.email,
      location: values.location,
      description: values.description,
      issueType: values.issueType || "General Maintenance",
      priority: values.priority,
      status: "Reported",
      category: null,
      assignedTo: null,
      costProposal: null,
      timestamp: new Date().toISOString(),
    });
    universalDB.save();
    showToast();
    setTickets(await fetchMyTickets(user));
    return true;
  }

  return (
    <div className="campus-page">
      <style>{campusCss}</style>

      <div className="header-row">
        <div className="page-header">
          <h1>Welcome, {user.name}</h1>
          <p>
            Anyone on campus — students, faculty, staff, or visitors — can log
            an issue and we'll take it from there.
          </p>
        </div>
      </div>

      <div className="eu-grid">
        <div>
          <IssueForm email={user.email} onSubmit={handleSubmit} />
        </div>
        <InfoPanel />
      </div>

      <MyReports tickets={tickets} />

      <div
        className={
          "eu-toast" +
          (toastVisible ? " show" : "") +
          (errorText ? " error" : "")
        }
      >
        {errorText || "Report submitted successfully!"}
      </div>
    </div>
  );
}

/* ── Right-hand info panel. Static: it never changes. ── */

const STEPS = [
  {
    state: "done",
    label: "You Report",
    desc: "Submit this form — takes under 1 minute.",
  },
  {
    state: "active",
    label: "System Admin Review",
    desc: "The Administrator triages and forwards your request.",
  },
  {
    state: "pending",
    label: "Dispatched",
    desc: "A Technician is assigned and briefed.",
  },
  {
    state: "pending",
    label: "Work in Progress",
    desc: "Technician assesses and carries out repairs.",
  },
  {
    state: "pending",
    label: "Resolved",
    desc: "Issue is verified and closed. Track it below.",
  },
];

// Each tip has an id, used as its React key
const TIPS = [
  {
    id: "location",
    text: (
      <>
        Be specific about the <strong>exact location</strong> — floor, room
        number, wing.
      </>
    ),
  },
  {
    id: "when",
    text: (
      <>
        Mention <strong>when</strong> the issue started or was first noticed.
      </>
    ),
  },
  {
    id: "safety",
    text: (
      <>
        If it's a <strong>safety hazard</strong>, set priority to High.
      </>
    ),
  },
  {
    id: "contact",
    text: (
      <>
        Leave a <strong>contact</strong> so we can reach you for more details if
        needed.
      </>
    ),
  },
];

function InfoPanel() {
  return (
    <div className="right-panel">
      <div className="info-card">
        <h3>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          What Happens Next
        </h3>
        <ul className="timeline">
          {STEPS.map((step, index) => (
            <li key={step.label}>
              <div className={`tl-dot ${step.state}`}>{index + 1}</div>
              <div>
                <p className="tl-label">{step.label}</p>
                <p className="tl-desc">{step.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="info-card">
        <h3>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
          </svg>
          Tips for a Good Report
        </h3>
        {TIPS.map((tip) => (
          <div className="tip-item" key={tip.id}>
            <div className="tip-dot"></div>
            <span>{tip.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
