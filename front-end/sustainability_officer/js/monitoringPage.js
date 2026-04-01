/**
 * monitoringPage.js
 * Handles interactivity and dynamic data for the Environmental Impact Monitoring page.
 */
import SustDB from './data/mockData.js';
import SessionModule from './modules/session.js';
import { injectIcons } from './utils/icons.js';
import { showToast, openModal } from './utils/utils.js';

document.addEventListener("DOMContentLoaded", () => {
    console.log("EnerTrack Monitoring System: Initializing logic...");
    try {
        SessionModule.initSession();
        injectIcons();
        initMonitoring();
        console.log("EnerTrack Monitoring System: Logic loaded successfully.");
    } catch (err) {
        console.error("EnerTrack Monitoring System: Critical initialization error:", err);
    }
});

function initMonitoring() {
    const monitoringData = SustDB?.data?.monitoring;
    if (!monitoringData) {
        console.warn("Monitoring data missing from SustDB.");
    }

    // Set initial sync label
    const lastSyncLabel = document.getElementById('lastSyncLabel');
    if (lastSyncLabel && monitoringData) {
        lastSyncLabel.textContent = monitoringData.lastSync;
    }

    // Wire Metrics Refresh Buttons
    document.querySelectorAll('.btn-refresh').forEach(btn => {
        btn.addEventListener('click', () => {
            const metric = btn.dataset.metric || "data";
            btn.innerHTML = `<span style="display:inline-flex;width:12px;height:12px;margin-right:4px;" data-icon="sync"></span> Syncing...`;
            injectIcons();
            
            setTimeout(() => {
                btn.innerHTML = `<span style="display:inline-flex;width:12px;height:12px;margin-right:4px;" data-icon="compile"></span> Updated`;
                injectIcons();
                showToast(`${metric.charAt(0).toUpperCase() + metric.slice(1)} metric refreshed.`, "success");
            }, 1000);
        });
    });

    // Wire Trend Period Selector
    const periodSelector = document.getElementById('trendPeriodSelector');
    if (periodSelector) {
        periodSelector.querySelectorAll('.pill-item').forEach(pill => {
            pill.addEventListener('click', () => {
                periodSelector.querySelectorAll('.pill-item').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                if (pill.dataset.period) {
                   updateTrendsChart(pill.dataset.period);
                }
            });
        });
    }

    // Wire Run Sync Cycle
    const btnForceRun = document.getElementById('btnForceRun');
    if (btnForceRun) {
        btnForceRun.addEventListener('click', () => {
            runPipelineSequence();
        });
    }

    // Wire Manual Override
    const btnManualOverride = document.getElementById('btnManualOverride');
    if (btnManualOverride) {
        btnManualOverride.addEventListener('click', () => {
            showToast("Manual override engaged. System entering maintenance polling mode.", "warning");
        });
    }

}

/**
 * Updates the CSS bar heights based on mock history data
 */
function updateTrendsChart(period) {
    const history = SustDB.data.monitoring.history[period];
    if (!history) return;

    const chartGroups = document.querySelectorAll('#trendsChart .chart-group');
    
    chartGroups.forEach((group, index) => {
        if (index >= history.e.length) {
            group.style.display = 'none';
            return;
        }
        group.style.display = 'flex';
        
        const energyBar = group.querySelector('.bar.c1');
        const waterBar = group.querySelector('.bar.c2');
        const emissionsBar = group.querySelector('.bar.c3');

        const eVal = history.e[index];
        const wVal = history.w[index];
        const mVal = history.m[index];

        if (energyBar) energyBar.style.height = `${Math.min(eVal, 100)}px`;
        if (waterBar) waterBar.style.height = `${Math.min(wVal * 2, 100)}px`;
        if (emissionsBar) emissionsBar.style.height = `${Math.min(mVal, 100)}px`;
    });

    const labelContainer = document.querySelector('.chart-labels');
    if (labelContainer && history.labels) {
        labelContainer.innerHTML = history.labels.map(l => `<span>${l}</span>`).join('');
    }

    showToast(`Viewing trends for ${period}`, "info");
}

/**
 * Animates the data pipeline sequence
 */
function runPipelineSequence() {
    const fill = document.getElementById('pipelineFill');
    const steps = document.querySelectorAll('#monitoringPipeline .step');
    const syncStatus = document.getElementById('syncStatus');
    const btn = document.getElementById('btnForceRun');

    if (btn.disabled) return;

    // Reset UI
    btn.disabled = true;
    btn.textContent = "Syncing...";
    syncStatus.textContent = "Processing...";
    fill.style.width = "0%";
    steps.forEach(s => s.querySelector('.step-icon').classList.remove('active'));

    let currentStep = 0;
    const progressInterval = setInterval(() => {
        currentStep++;
        const percent = (currentStep / steps.length) * 100;
        fill.style.width = `${percent}%`;

        const stepEl = document.querySelector(`#monitoringPipeline .step[data-step="${currentStep}"]`);
        if (stepEl) {
            stepEl.querySelector('.step-icon').classList.add('active');
        }

        if (currentStep >= steps.length) {
            clearInterval(progressInterval);
            finishPipeline();
        }
    }, 800);

    function finishPipeline() {
        btn.disabled = false;
        btn.innerHTML = `<span style="display:inline-flex;width:14px;height:14px;margin-right:6px;" data-icon="sync"></span> Run Sync Cycle`;
        injectIcons();
        syncStatus.textContent = "Active";
        
        // Update last sync time
        const now = new Date();
        const timeStr = `Today, ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
        document.getElementById('lastSyncLabel').textContent = timeStr;

        showToast("Monitoring cycle completed. Dashboard updated with live feeds.", "success");
        
        // Randomize metrics slightly to show "change"
        updateLiveMetrics();
    }
}

let baseMetrics = { e: 812, w: 3.6, m: 214 };

function updateLiveMetrics() {
    const e = document.getElementById('metricEnergy');
    const w = document.getElementById('metricWater');
    const m = document.getElementById('metricEmissions');

    // Add +/- 2% max variation for realism
    const varE = baseMetrics.e * (0.98 + Math.random() * 0.04);
    const varW = baseMetrics.w * (0.98 + Math.random() * 0.04);
    const varM = baseMetrics.m * (0.98 + Math.random() * 0.04);

    if (e) e.textContent = Math.round(varE).toString();
    if (w) w.textContent = varW.toFixed(1);
    if (m) m.textContent = Math.round(varM).toString();

    // Small animation effect on metrics
    [e, w, m].forEach(el => {
        if (!el) return;
        el.style.transition = 'all 0.5s ease';
        el.style.color = '#00f96f';
        setTimeout(() => el.style.color = '', 1000);
    });
}
