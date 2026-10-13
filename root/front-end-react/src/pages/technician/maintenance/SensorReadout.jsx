/**
 * SensorReadout — "3. Review Supporting Data": the real meter reading that
 * set off this fault's alert, drawn as a dial.
 *
 * A fault does not hold the reading itself, so this follows the links:
 *
 *   fault.alert_id
 *     -> alert.triggering_reading_id
 *       -> reading (value, unit, timestamp, meter_id)
 *         -> meter (meter_code, meter_type)
 *
 * If any link is missing it says so instead of drawing an empty dial.
 *
 * Ported from renderFaultReadout() in js/technician/maintenancePage.js.
 */

/**
 * The number to show in the dial: whole numbers as-is, anything else
 * rounded to one decimal, so it fits.
 */
function displayValue(value) {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(1);
}

/**
 * A smaller font for long numbers so they do not spill out of the dial.
 */
function valueSizeClass(text) {
  if (text.length > 4) {
    return "readout-value--sm";
  }
  if (text.length > 3) {
    return "readout-value--md";
  }
  return "";
}

export default function SensorReadout({
  fault,
  allFaults,
  alerts,
  readings,
  meters,
}) {
  // Follow the chain fault -> alert -> reading.
  const alert = alerts.find((a) => a.alert_id === fault.alert_id);
  let reading;
  if (alert && alert.triggering_reading_id) {
    reading = readings.find(
      (r) => r.reading_id === alert.triggering_reading_id,
    );
  }

  let content;
  if (!reading) {
    content = (
      <div className="empty-state">
        No sensor reading is linked to this fault's alert yet.
      </div>
    );
  } else {
    // reading -> meter, for a readable label instead of a UUID.
    const meter = meters.find((m) => m.meter_id === reading.meter_id);
    let meterLabel = reading.meter_id;
    if (meter) {
      meterLabel = meter.meter_code + " (" + meter.meter_type + ")";
    }

    let readingTime = "—";
    if (reading.timestamp) {
      readingTime = new Date(reading.timestamp).toLocaleString();
    }

    // Other faults on the same asset — a hint that this is a repeat problem.
    const priorCount = allFaults.filter(
      (f) => f.asset_name === fault.asset_name && f.fault_id !== fault.fault_id,
    ).length;
    let priorLabel = priorCount + " prior faults recorded for this asset.";
    if (priorCount === 1) {
      priorLabel = "1 prior fault recorded for this asset.";
    }

    const valueText = displayValue(reading.value);

    content = (
      <div>
        <div className="readout">
          <div className="readout-dial">
            <span className={"readout-value " + valueSizeClass(valueText)}>
              {valueText}
            </span>
            <span className="readout-unit">{reading.unit || ""}</span>
          </div>
          <div className="readout-meta">
            <div className="readout-meta-row">
              <span>Meter</span>
              <span>{meterLabel}</span>
            </div>
            <div className="readout-meta-row">
              <span>Reading at</span>
              <span>{readingTime}</span>
            </div>
          </div>
        </div>
        <div className="readout-note">{priorLabel}</div>
      </div>
    );
  }

  return (
    <div className="card detail-card">
      <h3 className="section-title">3. Review Supporting Data</h3>
      <p className="section-desc">
        The real sensor reading that triggered this fault's alert.
      </p>
      {content}
    </div>
  );
}
