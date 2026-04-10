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
    Energy: 'SNS-E',
    Water: 'SNS-W',
    Emissions: 'SNS-M',
    Food: 'SNS-F'
};

const METRIC_UNITS = {
    Energy: 'MWh',
    Water: 'ML',
    Emissions: 'tCO₂e',
    Food: 'kg'
};

const METRIC_CATEGORIES = {
    Energy: 'energy',
    Water: 'water',
    Emissions: 'emissions',
    Food: 'food'
};

// Baseline ranges per type (realistic campus values)
const BASELINES = {
    Energy: { min: 8, max: 22, unit: 'MWh' },
    Water: { min: 0.5, max: 4.2, unit: 'ML' },
    Emissions: { min: 40, max: 180, unit: 'tCO₂e' },
    Food: { min: 10, max: 80, unit: 'kg' }
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
    const sensorId = `${SENSOR_PREFIXES[wastageType]}-${(locationHash % 99).toString().padStart(2, '0')}`;

    // Generate reading: baseline + anomaly spike
    const baselineValue = +(baseline.min + Math.random() * (baseline.max - baseline.min)).toFixed(2);
    const spikeMultiplier = 1.3 + Math.random() * 0.9; // 30%-120% above baseline
    const readingValue = +(baselineValue * spikeMultiplier).toFixed(2);

    // Anomaly confidence based on how far above baseline
    const deviation = (readingValue - baselineValue) / baselineValue;
    const confidence = Math.min(0.98, +(0.5 + deviation * 0.8).toFixed(2));

    return {
        sensorId,
        readingValue,
        readingUnit: METRIC_UNITS[wastageType],
        readingTimestamp: new Date().toISOString(),
        baselineValue,
        deviation: +(deviation * 100).toFixed(1), // percentage above baseline
        anomalyDetected: deviation > 0.25,
        confidence
    };
}

/**
 * Get the metric unit for a wastage type.
 */
export function getMetricUnit(wastageType) {
    return METRIC_UNITS[wastageType] || 'units';
}

/**
 * Get the metric category for a wastage type.
 */
export function getMetricCategory(wastageType) {
    return METRIC_CATEGORIES[wastageType] || 'unknown';
}

// Simple string hash for deterministic sensor IDs
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash);
}
