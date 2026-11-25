/**
 * Dashboard — /campus/dashboard ("Report an Issue"), the Campus Visitor's
 * home page.
 *
 * This is the parent. It:
 *   - loads the question lists, the buildings and the visitor's reports
 *   - gives <ReportForm> a function to call on submit
 *   - shows the status-only list and a few tips
 *
 * The server decides priority, team and duplicates and takes the reporter
 * from the login, so there is no offline fallback here: a report that did not
 * reach the server is not a report, and the visitor is told so.
 */
import { useCallback, useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import ReportForm from "./ReportForm";
import MyReports from "./MyReports";
import WasteOutcomes from "./WasteOutcomes";
import { formatReportedOn } from "./serviceRequestHelpers";
import campusCss from "./campus.css?inline";

export default function Dashboard() {
  const { user } = useAuth();
  const [catalogue, setCatalogue] = useState(null);
  const [buildings, setBuildings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [toast, setToast] = useState({ text: "", error: false, show: false });
  const [loadError, setLoadError] = useState("");

  const loadTickets = useCallback(
    () =>
      api
        .get("/service-requests/mine")
        .then((list) =>
          setTickets(Array.isArray(list) ? [...list].reverse() : []),
        )
        .catch(() => setTickets([])),
    [],
  );

  useEffect(() => {
    Promise.all([api.get("/service-requests/catalogue"), api.get("/buildings")])
      .then(([cat, b]) => {
        setCatalogue(cat);
        setBuildings(Array.isArray(b) ? b : []);
      })
      .catch((e) => setLoadError(e.message));
    loadTickets();
  }, [loadTickets]);

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
    setToast({ text, error, show: true });
    setTimeout(
      () => setToast((t) => ({ ...t, show: false })),
      error ? 5000 : 4000,
    );
  }

  // The "Already reported here" row: open issues on the chosen floor.
  // "It is fixed" / "Still broken" on a fixed issue.
  async function respond(id, fixed) {
    try {
      await api.post(`/service-requests/${id}/${fixed ? "confirm-fixed" : "still-broken"}`, {});
      show(fixed ? "Thanks for letting us know." : "Sent again. We have marked it as a repeat.");
      await loadTickets();
    } catch (e) {
      show(e.message, true);
    }
  }

  async function loadNearby(buildingId, floor) {
    if (!buildingId || !floor) return setNearby([]);
    try {
      const list = await api.get(
        `/service-requests/campus-issues?building_id=${buildingId}&floor=${floor}`,
      );
      setNearby(Array.isArray(list) ? list : []);
    } catch {
      setNearby([]);
    }
  }

  async function handleSubmit(payload) {
    const result = await api.post("/service-requests/reports", payload);
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
    await loadTickets();
    setNearby([]);
    return result;
  }

  async function handlePlusOne(id) {
    try {
      await api.post(`/service-requests/${id}/plus-one`, {});
      show("Added. Thanks, you're counted as affected.");
      await loadTickets();
      setNearby((list) =>
        list.map((t) => (t.id === id ? { ...t, mine: true } : t)),
      );
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

      <MyReports tickets={tickets} onRespond={respond} />

      <WasteOutcomes />

      <div
        className={
          "eu-toast" +
          (toast.show ? " show" : "") +
          (toast.error ? " error" : "")
        }
      >
        {toast.text}
      </div>
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
