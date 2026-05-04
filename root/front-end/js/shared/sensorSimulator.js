/**
 * sensorSimulator.js
 * Simulates IoT sensor readings for wastage reports.
 * Generates fabricated but realistic data based on wastage type.
 *
 * When migrating to a real backend, replace this module's
 * generateSensorData() with an API call. The rest of the system
 * reads report.systemData regardless of origin.
 */

const SENSOR_PREFIXES = {
  Energy: "SNS-E",
  Water: "SNS-W",
  Emissions: "SNS-M",
  Food: "SNS-F",
};

const METRIC_UNITS = {
  Energy: "kWh",
  Water: "L",
  Emissions: "kg CO2e",
  Food: "kg",
};

const METRIC_CATEGORIES = {
  Energy: "energy",
  Water: "water",
  Emissions: "emissions",
  Food: "food",
};

// Baseline ranges per type (typical report-level wastage bands for an ~1800-person campus)
const BASELINES = {
  Energy: { min: 60, max: 140, unit: "kWh" },
  Water: { min: 400, max: 1200, unit: "L" },
  Emissions: { min: 18, max: 45, unit: "kg CO2e" },
  Food: { min: 20, max: 40, unit: "kg" },
};

/**
 * Generate a simulated sensor data object for a given wastage type.
 * @param {string} wastageType - 'Energy' | 'Water' | 'Emissions' | 'Food'
 * @param {object} specificData - The user-provided observation details
 * @returns {object} systemData object to attach to the report
 */
export function generateSensorData(wastageType, specificData) {
  const baseline = BASELINES[wastageType];
  if (!baseline) return null;

  // Derive a somewhat deterministic sensor ID from the location
  const locationHash = hashString(JSON.stringify(specificData));
  const sensorId = `${SENSOR_PREFIXES[wastageType]}-${(locationHash % 99).toString().padStart(2, "0")}`;

  // Generate reading from user-provided value when available; otherwise simulate
  const reportedValue = Number(specificData?.reportedValue);
  const hasReportedValue = Number.isFinite(reportedValue) && reportedValue > 0;

  const baselineValue = hasReportedValue
    ? +((baseline.min + baseline.max) / 2).toFixed(2)
    : +(baseline.min + Math.random() * (baseline.max - baseline.min)).toFixed(
        2,
      );

  const spikeMultiplier = 1.3 + Math.random() * 0.9; // 30%-120% above baseline
  const readingValue = hasReportedValue
    ? +reportedValue.toFixed(2)
    : +(baselineValue * spikeMultiplier).toFixed(2);

  // Anomaly confidence based on how far above baseline
  const deviation = (readingValue - baselineValue) / baselineValue;
  const confidence = Math.min(0.98, +(0.5 + deviation * 0.8).toFixed(2));

  return {
    sensorId,
    readingValue,
    readingUnit:
      (specificData && specificData.reportedUnit) || METRIC_UNITS[wastageType],
    readingTimestamp: new Date().toISOString(),
    baselineValue,
    deviation: +(deviation * 100).toFixed(1), // percentage above baseline
    anomalyDetected: deviation > 0.25,
    confidence,
    source: hasReportedValue ? "user-reported" : "simulated",
  };
}

/**
 * Get the metric unit for a wastage type.
 */
export function getMetricUnit(wastageType) {
  return METRIC_UNITS[wastageType] || "units";
}

/**
 * Get the metric category for a wastage type.
 */
export function getMetricCategory(wastageType) {
  return METRIC_CATEGORIES[wastageType] || "unknown";
}

/**
 * Get baseline range for a wastage type.
 */
export function getBaselineRange(wastageType) {
  const baseline = BASELINES[wastageType];
  if (!baseline) return null;
  return { min: baseline.min, max: baseline.max, unit: baseline.unit };
}

// Simple string hash for deterministic sensor IDs
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
