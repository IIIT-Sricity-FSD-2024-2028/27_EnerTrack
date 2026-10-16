/**
 * AlertDetail — the right-hand panel on the Alerts page: details of the
 * selected alert, and one decision about what it was.
 *
 *   Real fault  → a Fault is created for it (unless it already has one) and
 *                 the alert is acknowledged. The fault shows up on Fault
 *                 Detection & Diagnostics, where it is flagged into a work
 *                 order; closing that order resolves the fault and alert.
 *   Monitor     → acknowledged, and kept in the queue as "Monitoring" until
 *                 someone decides it is a real fault or a false alarm
 *   False alarm → resolved straight away
 *
 * The old panel had "Initiate Response" and "Schedule Inspection", which
 * did the same thing (acknowledge, plus a fixed line in the thread), and a
 * separate Resolve button. Nothing ever turned an alert into a fault.
 *
 * It owns the form while it is being filled in and hands the result to the
 * page with onDecide({ decision, notes, asset, faultType }). The page does
 * the saving. The page renders this with key={alert id}, so picking another
 * alert starts a fresh form.
 *
 * `alert` is undefined when there are no open alerts left; the panel then
 * says so. `meter` and `building` are the sensor that raised it and where
 * that sensor is: they pre-fill a new fault's asset and type. `existingFault` is an unresolved fault already raised from this
 * alert, if any — then "Real fault" acknowledges without making a second.
 *
 * Ported from selectAlert() in js/technician/alertsPage.js.
 */
import { useState } from "react";
import { PinIcon } from "../components/icons";
import { capitalize } from "../techUtils";

const FAULT_TYPES = [
  "Electrical",
  "Mechanical",
  "Plumbing",
  "HVAC",
  "Electronics",
  "Other",
];

// The likely fault type for each kind of meter. Emissions and food meters
// have no obvious one, so the technician picks.
const FAULT_TYPE_FOR_METER = {
  electricity: "Electrical",
  water: "Plumbing",
  gas: "Mechanical",
};

/**
 * Where the alert came from, as the asset to repair: the sensor's building,
 * zone and code, e.g. "Building 2 – Zone 1 (M-006)". Falls back to the text
 * after the colon in the title ("Energy Surge: IT Server Room" → "IT Server
 * Room") if the alert's meter is unknown.
 */
function assetFor(alert, meter, building) {
  if (meter) {
    const place = [building?.name, meter.zone].filter(Boolean).join(" – ");
    return place ? `${place} (${meter.meter_code})` : meter.meter_code;
  }
  const title = alert?.title || "";
  const colon = title.indexOf(":");
  return colon === -1 ? title : title.slice(colon + 1).trim();
}

/** "M-006 · Electricity · Building 2, Zone 1" for the chip under the title. */
function meterChip(alert, meter, building) {
  if (!meter) {
    return alert.meter_id || "Unknown sensor";
  }
  const place = [building?.name, meter.zone].filter(Boolean).join(", ");
  return [meter.meter_code, capitalize(meter.meter_type), place]
    .filter(Boolean)
    .join(" · ");
}

export default function AlertDetail({
  alert,
  meter,
  building,
  existingFault,
  busy,
  onDecide,
}) {
  const [decision, setDecision] = useState(null);
  const [notes, setNotes] = useState("");
  const [asset, setAsset] = useState(assetFor(alert, meter, building));
  const [faultType, setFaultType] = useState(
    FAULT_TYPE_FOR_METER[meter?.meter_type] || "",
  );

  // Nothing to show — every alert has been handled.
  if (!alert) {
    return (
      <div className="card detail-card">
        <div className="detail-header">
          <div className="detail-header-left">
            <h2>No alerts to review</h2>
          </div>
        </div>
        <div className="detail-description-box">
          Every alert has been resolved or handed to diagnostics.
        </div>
      </div>
    );
  }

  const severity = alert.severity || "low";

  // A new fault needs an asset and a type; the other choices need nothing.
  const needsFaultFields = decision === "fault" && !existingFault;
  let ready = decision !== null;
  if (needsFaultFields) {
    ready = asset.trim() !== "" && faultType !== "";
  }

  // Each card says where the alert ends up, because only one of the three
  // sends anything to another page.
  let faultText =
    "Something is broken. Sends it to Fault Detection & Diagnostics.";
  if (existingFault) {
    faultText = `Already on Fault Detection & Diagnostics as ${existingFault.fault_id}. Fixing that fault resolves this alert.`;
  }

  let options = [
    { value: "fault", title: "Real fault", text: faultText },
    {
      value: "monitor",
      title: "Monitor",
      text: "Not sure yet. Stays in the queue as Monitoring until you decide.",
    },
    {
      value: "false_alarm",
      title: "False alarm",
      text: "Nothing wrong on site. Closes the alert.",
    },
  ];
  // With a fault already open, the alert's fate is that fault's: fixing it
  // resolves the alert. Monitoring it or calling it a false alarm here
  // would contradict a fault still in diagnostics, so only offer to confirm.
  if (existingFault) {
    options = options.filter((option) => option.value === "fault");
  }

  // What pressing Confirm will do, in words, next to the button.
  let footerText = "Choose what this alert turned out to be.";
  if (decision === "fault" && existingFault) {
    footerText = `Moves the alert to the log. ${existingFault.fault_id} is already being diagnosed.`;
  } else if (decision === "fault") {
    footerText =
      "Creates a fault on Fault Detection & Diagnostics, assigned to you.";
  } else if (decision === "monitor") {
    footerText = "Saves your note. The alert stays in the queue.";
  } else if (decision === "false_alarm") {
    footerText = "Resolves the alert. Nothing is sent anywhere.";
  }

  function handleConfirm() {
    onDecide({
      decision: decision,
      notes: notes.trim(),
      asset: asset.trim(),
      faultType: faultType,
    });
  }

  return (
    <div className="card detail-card">
      <div>
        <div className="detail-header">
          <div className="detail-header-left">
            <h2>Alert {alert.alert_id} Details</h2>
            <span className={"badge " + severity}>{capitalize(severity)}</span>
          </div>
        </div>

        <div className="detail-meta">
          <span className="zone-badge">
            <PinIcon />
            <span>{meterChip(alert, meter, building)}</span>
          </span>
        </div>

        <div className="detail-description-box">{alert.title || "—"}</div>

        <div className="section-label">What did you find?</div>
        <div className="decision-options" role="radiogroup">
          {options.map((option) => {
            let optionClass = "option decision-option";
            if (option.value === decision) {
              optionClass += " active";
            }
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={option.value === decision}
                className={optionClass}
                onClick={() => setDecision(option.value)}
              >
                <h3>{option.title}</h3>
                <p>{option.text}</p>
              </button>
            );
          })}
        </div>

        {needsFaultFields && (
          <div className="wo-form-row">
            <div className="field">
              <label htmlFor="faultAsset">Asset</label>
              <input
                id="faultAsset"
                type="text"
                placeholder="e.g. Chiller Unit C-12"
                value={asset}
                onChange={(event) => setAsset(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="faultType">Fault type</label>
              <select
                id="faultType"
                value={faultType}
                onChange={(event) => setFaultType(event.target.value)}
              >
                <option value="">— Select —</option>
                {FAULT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="alertNotes">Notes</label>
          <textarea
            id="alertNotes"
            placeholder="What you saw or did on site…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>

      <div className="footer-action">
        <small>{footerText}</small>
        <button
          type="button"
          className="btn btn-dark"
          disabled={busy || !ready}
          onClick={handleConfirm}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
