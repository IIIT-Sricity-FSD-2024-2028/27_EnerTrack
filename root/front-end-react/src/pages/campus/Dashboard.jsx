/**
 * Dashboard — /campus/dashboard ("Report an Issue"), the Campus Visitor's
 * home page.
 *
 * This is the parent. It:
 *   - loads the question lists, the buildings and the visitor's reports via Redux
 *   - gives <ReportForm> a function to call on submit
 *   - shows the status-only list and a few tips
 *
 * The server decides priority, team and duplicates and takes the reporter
 * from the login, so there is no offline fallback here: a report that did not
 * reach the server is not a report, and the visitor is told so.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { unwrapLoad } from "../../store/loadState";
import { useToast } from "../../ui/useToast";
import { useDispatch, useSelector } from "react-redux";
import { useAuth } from "../../auth/useAuth";
import { fetchBuildings, selectAllBuildings } from "../../store/slices/buildingsSlice";
import {
  confirmFixed as confirmFixedThunk,
  fetchCampusIssues,
  fetchMyServiceRequests,
  fetchServiceCatalogue,
  plusOneServiceRequest,
  selectCampusIssues,
  selectMyServiceRequests,
  selectServiceCatalogue,
  stillBroken as stillBrokenThunk,
  submitServiceReport,
} from "../../store/slices/serviceRequestsSlice";
import ReportForm from "./ReportForm";
import MyReports from "./MyReports";
import WasteOutcomes from "./WasteOutcomes";
import { formatReportedOn } from "./serviceRequestHelpers";
import campusCss from "./campus.css?inline";

export default function Dashboard() {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const catalogue = useSelector(selectServiceCatalogue);
  const buildings = useSelector(selectAllBuildings);
  const myTickets = useSelector(selectMyServiceRequests);
  const campusIssues = useSelector(selectCampusIssues);

  const [showNearby, setShowNearby] = useState(false);
  const showToast = useToast();
  const [loadError, setLoadError] = useState("");
  // A submitted report opened from My Reports, shown read-only in place of the form.
  const [viewing, setViewing] = useState(null);

  const tickets = useMemo(() => [...myTickets].reverse(), [myTickets]);
  const nearby = showNearby ? campusIssues : [];

  function viewReport(ticket) {
    setViewing(ticket);
    setShowNearby(false);
    document.getElementById("report-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const loadTickets = useCallback(
    () => dispatch(fetchMyServiceRequests()),
    [dispatch],
  );

  useEffect(() => {
    Promise.all([
      // Cached loads: a skip (already loaded) is not an error.
      unwrapLoad(dispatch(fetchServiceCatalogue())),
      unwrapLoad(dispatch(fetchBuildings())),
    ]).catch((e) => setLoadError(e.message));
    loadTickets();
  }, [dispatch, loadTickets]);

  // Keep the list current without a refresh: every 30 seconds, and when the
  // student comes back to this tab.
  useEffect(() => {
    const timer = setInterval(loadTickets, 30000);
    const onFocus = () => loadTickets();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadTickets]);

  function show(text, error = false) {
    showToast(text, error ? "error" : "success");
  }

  // "It is fixed" on a fixed issue. Returns true when it went through.
  async function confirmFixed(id) {
    try {
      await dispatch(confirmFixedThunk(id)).unwrap();
      show("Thanks for letting us know.");
      return true;
    } catch (e) {
      show(e.message, true);
      return false;
    }
  }

  // "Still broken": what is still wrong (required) and an optional photo.
  // It goes back to the technician who fixed it, if they are free.
  async function stillBroken(id, reason, photo) {
    try {
      await dispatch(stillBrokenThunk({ id, reason, photo })).unwrap();
      show("Sent back. We have asked the technician who fixed it to look again.");
      return true;
    } catch (e) {
      show(e.message, true);
      return false;
    }
  }

  async function loadNearby(buildingId, floor) {
    if (!buildingId || !floor) return setShowNearby(false);
    try {
      await dispatch(fetchCampusIssues({ buildingId, floor })).unwrap();
      setShowNearby(true);
    } catch {
      setShowNearby(false);
    }
  }

  async function handleSubmit(payload) {
    const result = await dispatch(submitServiceReport(payload)).unwrap();
    if (result.outcome === "covered") return result; // the form asks "same problem?"
    const when = result.ticket?.reported_on
      ? ` Reported on ${formatReportedOn(result.ticket.reported_on)}.`
      : "";
    show(
      result.outcome === "joined"
        ? `Already reported, you've been added.${when}`
        : result.outcome === "already_reported"
          ? "You've already reported this one."
          : `Report submitted.${when}`,
    );
    setShowNearby(false);
    return result;
  }

  async function handlePlusOne(id) {
    try {
      await dispatch(plusOneServiceRequest(id)).unwrap();
      show("Added. Thanks, you're counted as affected.");
    } catch (e) {
      show(e.message, true);
    }
  }

  return (
    <div className="campus-page">
      <style>{campusCss}</style>

      <div className="header-row">
        <div className="page-header">
          <h1>Welcome, {user.name}</h1>
          <p>Anyone on campus can log an issue and we'll take it from there.</p>
        </div>
      </div>

      {loadError && <div className="form-error">{loadError}</div>}

      <div className="eu-grid">
        <div>
          {catalogue ? (
            <ReportForm
              key={viewing ? viewing.id : "new"}
              viewing={viewing}
              onNew={() => setViewing(null)}
              email={user.email}
              catalogue={catalogue}
              buildings={buildings}
              nearby={nearby}
              onSubmit={handleSubmit}
              onPlusOne={handlePlusOne}
              onFloorChange={loadNearby}
            />
          ) : (
            !loadError && <p>Loading the form…</p>
          )}
        </div>
        <InfoPanel />
      </div>

      <MyReports
        tickets={tickets}
        viewingId={viewing?.id}
        onView={viewReport}
        onConfirm={confirmFixed}
        onStillBroken={stillBroken}
      />

      <WasteOutcomes />
    </div>
  );
}

/* ── Right-hand panel: a few tips. ── */

const TIPS = [
  {
    id: "check",
    text: (
      <>
        Check <strong>Campus issues</strong> first. If it is already there,
        press +1.
      </>
    ),
  },
  {
    id: "see",
    text: (
      <>
        Only describe what you can <strong>see</strong>. We work out how urgent
        it is.
      </>
    ),
  },
  {
    id: "waste",
    text: (
      <>
        Lights, AC or a tap left on? Report it under <strong>Energy, water or food being wasted</strong>. General Maintenance switches it off.
      </>
    ),
  },
  {
    id: "safety",
    text: (
      <>
        In danger? Call <strong>campus security</strong> straight away.
      </>
    ),
  },
];

function InfoPanel() {
  return (
    <div className="right-panel">
      <div className="info-card">
        <h3>Tips for a Good Report</h3>
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
