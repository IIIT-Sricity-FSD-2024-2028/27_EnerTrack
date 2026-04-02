/**
 * monitoringPage.js
 * Handles interactivity and dynamic data for the Environmental Impact Monitoring page.
 */
import SustDB from './data/mockData.js';
import SessionModule from './modules/session.js';
import { injectIcons } from './utils/icons.js';
import { showToast, openModal } from './utils/utils.js';

function getUserKey(base) {
    try {
        const u = JSON.parse(localStorage.getItem('currentUser') || '{}');
        return base + '_' + (u.email || 'default');
    } catch(_) { return base + '_default'; }
}
function PIPELINE_KEY() { return getUserKey('et_sust_pipeline_state'); }
function SYNC_BTN_KEY() { return getUserKey('et_sust_sync_btns'); }

document.addEventListener("DOMContentLoaded", () => {
    console.log("EnerTrack Monitoring System: Initializing logic...");
    try {
        SessionModule.initSession();
        injectIcons();
        initMonitoring();
        restorePipelineState();
        restoreSyncButtons();
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

    // Wire Metrics Refresh Buttons (Sync → Updated)
    document.querySelectorAll('.btn-refresh').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const metric = btn.dataset.metric || "data";
            btn.innerHTML = `<span style="display:inline-flex;width:12px;height:12px;margin-right:4px;" data-icon="sync"></span> Syncing...`;
            injectIcons();
            
            setTimeout(() => {
                setButtonUpdated(btn);
                saveSyncButtonState();
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

/* ── Sync Button Helpers ───────────────────────────── */

function setButtonUpdated(btn) {
    btn.innerHTML = `<span style="display:inline-flex;width:12px;height:12px;margin-right:4px;" data-icon="compile"></span> Updated`;
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'default';
    injectIcons();
}

function setButtonSync(btn) {
    btn.innerHTML = `<span style="display:inline-flex;width:12px;height:12px;margin-right:4px;" data-icon="sync"></span> Sync`;
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.style.cursor = 'pointer';
    injectIcons();
}

function saveSyncButtonState() {
    const states = {};
    document.querySelectorAll('.btn-refresh').forEach(btn => {
        states[btn.dataset.metric] = btn.disabled ? 'updated' : 'sync';
    });
    localStorage.setItem(SYNC_BTN_KEY(), JSON.stringify(states));
}

function restoreSyncButtons() {
    const stored = localStorage.getItem(SYNC_BTN_KEY());
    if (!stored) return;
    try {
        const states = JSON.parse(stored);
        document.querySelectorAll('.btn-refresh').forEach(btn => {
            const metric = btn.dataset.metric;
            if (states[metric] === 'updated') {
                setButtonUpdated(btn);
            }
        });
    } catch (_) {}
}

/* ── Pipeline Persistence ──────────────────────────── */

function savePipelineState(state) {
    localStorage.setItem(PIPELINE_KEY(), state);
}

function restorePipelineState() {
    const state = localStorage.getItem(PIPELINE_KEY());
    if (state === 'completed') {
        const fill = document.getElementById('pipelineFill');
        const steps = document.querySelectorAll('#monitoringPipeline .step');
        const syncStatus = document.getElementById('syncStatus');

        if (fill) fill.style.width = '100%';
        steps.forEach(s => s.querySelector('.step-icon').classList.add('active'));
        if (syncStatus) syncStatus.textContent = 'Active';

        // Also set all sync buttons to Updated
        document.querySelectorAll('.btn-refresh').forEach(btn => setButtonUpdated(btn));
        saveSyncButtonState();
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

    // Reset sync buttons back to "Sync"
    document.querySelectorAll('.btn-refresh').forEach(b => setButtonSync(b));

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

        // Persist pipeline completed state
        savePipelineState('completed');
        
        // Add to Global Highlights
        SustDB.addHighlight("Data Synced", "Monitoring pipeline completed automatically", "blue");

        // Set all sync buttons to Updated + disabled
        document.querySelectorAll('.btn-refresh').forEach(b => setButtonUpdated(b));
        saveSyncButtonState();

        showToast("Monitoring cycle completed. Dashboard updated with live feeds.", "success");
        
        // Randomize metrics slightly to show "change"
        updateLiveMetrics();
        
        // Ensure pipeline animations smoothly cycle back to initial state after 3 sec
        setTimeout(() => {
            savePipelineState('initial');
            const fill = document.getElementById('pipelineFill');
            const steps = document.querySelectorAll('#monitoringPipeline .step');
            const syncStatus = document.getElementById('syncStatus');
            const btn = document.getElementById('btnForceRun');
            
            if(fill) fill.style.width = "0%";
            steps.forEach(s => {
                const icon = s.querySelector('.step-icon');
                if (icon) icon.classList.remove('active');
            });
            if(syncStatus) syncStatus.textContent = "Standby";
            const cycleBar = document.querySelector(".data-cycle-bar");
            if(cycleBar) cycleBar.style.background = "#f4f6f8";
            
            if(btn) {
                btn.innerHTML = `<span style="display:inline-flex;width:14px;height:14px;margin-right:6px;" data-icon="sync"></span> Run Sync Cycle`;
                import('./utils/icons.js').then(icu => icu.injectIcons());
            }
            
            // Also reset sync buttons to "Sync"
            document.querySelectorAll('.btn-refresh').forEach(b => setButtonSync(b));
            saveSyncButtonState();
        }, 4000);
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
