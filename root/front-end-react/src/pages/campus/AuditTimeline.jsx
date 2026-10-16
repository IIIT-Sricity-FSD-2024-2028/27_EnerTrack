/**
 * AuditTimeline — the "Sustainability Audit Flow" card on /campus/wastage.
 *
 * Display only. The parent (Wastage.jsx) decides which report to show:
 * the one the user clicked, otherwise their latest, otherwise none.
 *
 * Props:
 *   report     the report to show progress for, or null
 *   showLabel  true when the user clicked a card -> "Showing audit trail for #id"
 *
 * Replaces renderAuditTimeline() in js/enduser/wastage.js.
 */
import { STATUS_MAP, TIMELINE_STEPS } from "./wastageHelpers";

// Works out how one step looks for the given report.
// Returns { dotClass, note } — note is the small sentence under the step.
function getStepLook(stepNum, report) {
  // No report yet: step 1 is where the visitor is
  if (!report) {
    return { dotClass: stepNum === 1 ? "active" : "pending", note: "" };
  }

  const status = STATUS_MAP[report.status];
  const activeStep = status ? status.step : 2;
  const hint = status ? status.hint : "Your report is being processed.";

  // Dismissed: step 1 done, step 2 (officer validation) marked dismissed,
  // the rest never reached
  if (report.status === "Dismissed") {
    if (stepNum < 2) return { dotClass: "done", note: "" };
    if (stepNum === 2) {
      return {
        dotClass: "dismissed",
        note: "This report was dismissed by the officer.",
      };
    }
    return { dotClass: "pending", note: "" };
  }

  // Delivered is the end of the flow: every step is done. (Finalized is
  // also on step 6, but still waiting to be sent, so it shows as active.)
  if (report.status === "Delivered") return { dotClass: "done", note: "" };

  if (stepNum < activeStep) return { dotClass: "done", note: "" };
  if (stepNum === activeStep) return { dotClass: "active", note: hint };
  return { dotClass: "pending", note: "" };
}

export default function AuditTimeline({ report, showLabel }) {
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
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          Sustainability Audit Flow
        </h3>

        {showLabel && report && (
          <div className="trail-label">
            Showing audit trail for <strong>#{report.id}</strong>
          </div>
        )}

        <ul className="timeline">
          {TIMELINE_STEPS.map((step) => {
            const look = getStepLook(step.num, report);

            return (
              <li key={step.num}>
                <div className={`tl-dot ${look.dotClass}`}>{step.num}</div>
                <div>
                  <p className="tl-label">{step.label}</p>
                  <p className="tl-desc">{step.desc}</p>
                  {look.note && (
                    <p
                      className={
                        look.dotClass === "dismissed"
                          ? "tl-active-desc muted"
                          : "tl-active-desc"
                      }
                    >
                      {look.note}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
