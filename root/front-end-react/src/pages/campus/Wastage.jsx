/**
 * Wastage — /campus/wastage ("Report Wastage"). Replaces
 * html/enduser/enduser_wastage.html + js/enduser/wastage.js.
 *
 * This is the parent. It owns the list of reports and which one is
 * selected, and does all the saving. Its children only display and report
 * back:
 *   <WastageForm>    the form; calls handleSubmit with the new report
 *   <AuditTimeline>  progress of the selected (or latest) report
 *   <WastageCard>    one report; calls handleSelect / handleArchive /
 *                    handleAddComment
 *
 * Works with the backend stopped: reports are then saved to and read from
 * the browser's local store (universalDB), like the original page. That
 * fallback is ONLY for "server not running"; if the server answers and
 * refuses, the visitor sees a red message instead.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import universalDB from "../../legacy/universalDB";
import {
  generateSensorData,
  getMetricCategory,
  getMetricUnit,
} from "../../legacy/sensorSimulator";
import { notifyOnStateChange } from "../../legacy/notifications";
import AuditTimeline from "./AuditTimeline";
import WastageCard from "./WastageCard";
import WastageForm from "./WastageForm";
import { getLocationKey } from "./wastageHelpers";
import campusCss from "./campus.css?inline";
import wastageCss from "./wastage.css?inline";

// True when the request never reached the server (backend stopped). Any
// other error means the server answered and said no.
function isNetworkError(error) {
  return String(error?.message || "").startsWith("Cannot reach server");
}

// Loads this user's reports that are not archived, newest first.
// Backend reports plus any saved in the browser while the backend was down.
async function fetchMyReports(user) {
  let reports = [];

  try {
    const list = await api.get("/wastage-reports");
    if (Array.isArray(list)) {
      reports = list
        .filter((r) => r.reporter_id === user.user_id)
        .map((r) => ({
          id: r.wastage_report_id,
          type: r.type || "Energy",
          // "reported" -> "Reported", to match the status table
          status: r.status
            ? r.status.charAt(0).toUpperCase() + r.status.slice(1)
            : "Reported",
          specificData: r.details?.specificData || {},
          systemData: r.details?.systemData || {},
          costImpact: r.details?.costImpact || null,
          metricTarget: r.details?.metricTarget || null,
          photoUrls: r.details?.photo_urls || [],
          priority: r.details?.priority || "Low",
          archived: r.details?.archived || false,
          comments: r.details?.comments || [],
          timestamp: r.details?.timestamp,
          dismissReason: r.details?.dismissReason,
          dismissComment: r.details?.dismissComment,
          dismissedAt: r.details?.dismissedAt,
          details: r.details || {}, // kept whole, to send back when updating
          fromBackend: true,
        }));
    }
  } catch (err) {
    console.warn("[EndUser] Failed to fetch wastage reports:", err.message);
  }

  // Add reports saved in the browser that the backend does not have
  universalDB.data.workflow.wastageReports
    .filter((r) => r.reporterEmail === user.email)
    .forEach((local) => {
      if (!reports.some((r) => r.id === local.id)) reports.push(local);
    });

  return reports
    .filter((r) => !r.archived)
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
}

// Changes a report saved in the browser's store (made while the backend was
// down). `changes` is merged into the report.
function updateLocalReport(report, changes) {
  const local = universalDB.data.workflow.wastageReports.find(
    (r) => r.id === report.id,
  );
  Object.assign(local, changes);
  universalDB.save();
}

export default function Wastage() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState(null); // the clicked card
  const [toastVisible, setToastVisible] = useState(false);
  const [errorText, setErrorText] = useState(""); // red toast when not empty

  // The selected report, looked up fresh so it is never out of date
  const selectedReport = reports.find((r) => r.id === selectedId) || null;

  // Load the reports when the page opens
  useEffect(() => {
    fetchMyReports(user).then(setReports);
  }, [user]);

  function showToast() {
    setErrorText("");
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3500);
  }

  // A red message in the same toast, instead of a blocking popup
  function showError(message) {
    setErrorText(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 5000);
  }

  // Called by <WastageForm> with { type, priority, specificData, photos }
  async function handleSubmit({ type, priority, specificData, photos }) {
    const report = {
      id: "WR-" + Date.now().toString(36).toUpperCase(),
      source: "User-Reported",
      reporterName: user.name,
      reporterEmail: user.email,
      type: type,
      specificData: specificData,
      priority: priority,
      metricUnit: getMetricUnit(type),
      metricCategory: getMetricCategory(type),
      systemData: generateSensorData(type, specificData), // simulated sensor
      status: "Reported",
      timestamp: new Date().toISOString(),
    };

    // Set if the report saves but its photos do not
    let photoError = "";

    // 1. Try the backend
    try {
      const saved = await api.post("/wastage-reports", {
        reporter_id: user.user_id,
        type: type,
        status: "Reported",
        details: {
          specificData: specificData,
          priority: priority,
          metricUnit: report.metricUnit,
          metricCategory: report.metricCategory,
          systemData: report.systemData,
          location: getLocationKey(type, specificData),
          timestamp: report.timestamp,
        },
      });

      // Photos can only be attached once the report exists on the backend
      if (photos.length > 0) {
        try {
          await api.upload(
            `/wastage-reports/${saved.wastage_report_id}/photos`,
            "files",
            photos,
          );
        } catch (err) {
          photoError =
            "Report submitted, but the photos failed to upload: " + err.message;
        }
      }
    } catch (err) {
      // The server answered but refused: do not pretend it worked
      if (!isNetworkError(err)) {
        showError("Could not submit your report: " + err.message);
        return false; // tells <WastageForm> to keep what the visitor typed
      }
      // 2. Backend is not running: save in the browser instead
      console.warn("[EndUser] Saving locally only:", err.message);
      universalDB.data.workflow.wastageReports.push(report);
      universalDB.save();
    }

    if (photoError) {
      showError(photoError);
    } else {
      showToast();
    }
    setReports(await fetchMyReports(user));
    notifyOnStateChange(report, "submitted", user.name); // tell the officers
    return true;
  }

  // Clicking a card opens it read-only in the form and in the timeline
  function handleSelect(report) {
    setSelectedId(report.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleArchive(report) {
    try {
      if (report.fromBackend) {
        // Its own route: a visitor may archive, but not edit, a report
        await api.patch(`/wastage-reports/${report.id}/archive`);
      } else {
        updateLocalReport(report, {
          archived: true,
          archivedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      showError("Could not archive this report: " + err.message);
      return;
    }
    if (selectedId === report.id) setSelectedId(null);
    setReports(await fetchMyReports(user));
    showToast();
  }

  // Returns true when the comment was saved, so the card knows whether to
  // clear the text box (on failure the visitor keeps what they typed).
  async function handleAddComment(report, text) {
    try {
      if (report.fromBackend) {
        // Its own route: the server adds the comment to the list itself
        await api.post(`/wastage-reports/${report.id}/comments`, {
          text: text,
          author: user.name,
        });
      } else {
        const comment = {
          author: user.name,
          role: "Campus Visitor",
          text: text,
          timestamp: new Date().toISOString(),
        };
        updateLocalReport(report, {
          comments: [...(report.comments || []), comment],
        });
      }
    } catch (err) {
      showError("Could not save your comment: " + err.message);
      return false;
    }
    setReports(await fetchMyReports(user));
    return true;
  }

  return (
    <div className="campus-page wastage-page">
      <style>{campusCss}</style>
      <style>{wastageCss}</style>

      <div className="header-row">
        <div className="page-header">
          <h1>Welcome, {user.name}</h1>
          <p>
            Help us improve our campus sustainability by logging cases of
            energy, water, emissions or food wastage.
          </p>
        </div>
      </div>

      <div className="eu-grid">
        <WastageForm
          email={user.email}
          reports={reports}
          selectedReport={selectedReport}
          onSubmit={handleSubmit}
          onNewReport={() => setSelectedId(null)}
        />
        {/* Shows the clicked report, otherwise the latest one */}
        <AuditTimeline
          report={selectedReport || reports[0] || null}
          showLabel={selectedReport !== null}
        />
      </div>

      <div className="ticket-section">
        <h2>
          My Wastage Logs
          <span className="ticket-count">{reports.length}</span>
        </h2>

        {reports.length === 0 ? (
          <div className="empty-state">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d1d5db"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
            <p>You haven't logged any wastage reports yet.</p>
          </div>
        ) : (
          reports.map((report) => (
            <WastageCard
              key={report.id}
              report={report}
              isSelected={report.id === selectedId}
              onSelect={handleSelect}
              onArchive={handleArchive}
              onAddComment={handleAddComment}
            />
          ))
        )}
      </div>

      <div
        className={
          "eu-toast" +
          (toastVisible ? " show" : "") +
          (errorText ? " error" : "")
        }
      >
        {errorText || "Wastage Report Logged Successfully!"}
      </div>
    </div>
  );
}
