/**
 * WasteSignals — what the Sustainability Officer opens wastage cases from.
 *
 * Single waste reports (lights left on, a tap running) are General
 * Maintenance jobs and never reach the officer one by one. Here they are
 * grouped by place: three or more in 30 days, any food or smoke report,
 * food weigh-ins rising this week, or a meter well above last
 * year make a hotspot. The officer opens a case, or watches it; a watched
 * signal comes back when a new report arrives.
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import { TYPE_COLORS } from "./auditShared";
import { OpenCaseModal } from "./CaseModals";

const SOURCE_LABEL = { reports: "Reports", food_log: "Food weigh-ins", meter: "Meter" };

function when(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function WasteSignals({ reloadKey = 0, onChanged, showToast }) {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("hotspots"); // 'hotspots' | 'all'
  const [opening, setOpening] = useState(null); // { signal } or { signal: null } for a manual case
  const [busy, setBusy] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let live = true;
    api
      .get("/wastage-reports/signals")
      .then((rows) => {
        if (!live) return;
        setSignals(Array.isArray(rows) ? rows : []);
        setError(null);
      })
      .catch((err) => live && setError(err.message || "The signals could not be loaded."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [reloadKey, retryKey]);

  async function openCase(body) {
    setBusy(true);
    try {
      await api.post("/wastage-reports", body);
      setOpening(null);
      showToast?.("Case opened. Plan its remedy in Wastage cases below.", "success");
      setRetryKey((k) => k + 1);
      onChanged?.();
    } catch (err) {
      showToast?.("Could not open the case: " + err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleWatch(signal) {
    try {
      if (signal.watched) await api.post("/wastage-reports/signals/unwatch", { key: signal.key });
      else await api.post("/wastage-reports/signals/watch", { key: signal.key });
      setSignals((list) => list.map((s) => (s.key === signal.key ? { ...s, watched: !s.watched } : s)));
    } catch (err) {
      showToast?.(err.message, "error");
    }
  }

  const active = signals.filter((s) => !s.case_id && !s.watched);
  const hotspots = active.filter((s) => s.hotspot);
  const shown = tab === "hotspots" ? hotspots : signals;

  return (
    <section className="so-panel" aria-labelledby="wasteSignalsTitle">
      <div className="so-panel-head">
        <div>
          <h2 id="wasteSignalsTitle">Waste signals</h2>
          <p>
            Patterns, not single reports. One-off waste is fixed by General Maintenance; open a case when it keeps happening.
          </p>
        </div>
        <div className="so-panel-tools">
          <div className="so-tabs" role="tablist" aria-label="Filter waste signals">
            <button type="button" role="tab" aria-selected={tab === "hotspots"} onClick={() => setTab("hotspots")}>
              Hotspots ({hotspots.length})
            </button>
            <button type="button" role="tab" aria-selected={tab === "all"} onClick={() => setTab("all")}>
              All groups ({signals.length})
            </button>
          </div>
          <button type="button" className="so-btn" onClick={() => setOpening({ signal: null })} title="Open a case from something you saw on Monitoring">
            New case
          </button>
        </div>
      </div>

      {error && signals.length === 0 ? (
        <div className="so-empty" role="alert">
          Signals could not be loaded: {error}{" "}
          <button type="button" className="so-btn" onClick={() => setRetryKey((k) => k + 1)}>
            Retry
          </button>
        </div>
      ) : loading && signals.length === 0 ? (
        <div className="so-empty">Loading signals…</div>
      ) : shown.length === 0 ? (
        <div className="so-empty">
          {tab === "hotspots"
            ? "No hotspots. Waste reports are being handled one by one; nothing is repeating."
            : "No waste has been reported in the last 30 days."}
        </div>
      ) : (
        <ul className="so-signals">
          {shown.map((s) => (
            <li key={s.key} className={`so-signal${s.hotspot ? " is-hot" : ""}`}>
              <span className="so-signal-kind" style={{ color: TYPE_COLORS[s.kind] || "#6b7280" }}>
                {s.kind}
              </span>
              <div className="so-signal-main">
                <strong>{s.location || "Unknown place"}</strong>
                <span>{s.reasons.length ? s.reasons.join(" · ") : `${s.incidents} report${s.incidents === 1 ? "" : "s"}`}</span>
                <small>
                  {SOURCE_LABEL[s.source]}
                  {s.people ? ` · ${s.people} ${s.people === 1 ? "person" : "people"}` : ""} · last {when(s.last_at)}
                </small>
              </div>
              <div className="so-signal-actions">
                {s.case_id ? (
                  <span className="so-status ready">Case open</span>
                ) : (
                  <>
                    <button type="button" className={`so-btn${s.hotspot ? " primary" : ""}`} onClick={() => setOpening({ signal: s })}>
                      Open case
                    </button>
                    <button type="button" className="so-link" onClick={() => toggleWatch(s)}>
                      {s.watched ? "Stop watching" : "Watch"}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {opening && <OpenCaseModal signal={opening.signal} busy={busy} onSubmit={openCase} onClose={() => setOpening(null)} />}
    </section>
  );
}
