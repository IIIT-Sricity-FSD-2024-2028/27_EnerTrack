/**
 * reportingPage.js
 * Handles session logic, report generation pipeline, and custom date range.
 */
import SustDB from './data/mockData.js';
import SessionModule from './modules/session.js';
import { showToast } from './utils/utils.js';
import { injectIcons } from './utils/icons.js';

function REPORT_PIPELINE_KEY() {
    try {
        const u = JSON.parse(localStorage.getItem('currentUser') || '{}');
        return 'et_sust_report_pipeline_' + (u.email || 'default');
    } catch (_) { return 'et_sust_report_pipeline_default'; }
}

document.addEventListener("DOMContentLoaded", () => {
    SessionModule.initSession();
    injectIcons();
    initFormInteractions();
    wireGeneration();
    restoreReportPipelineState();
});

/* ── Form Interactions ─────────────────────────────── */

function initFormInteractions() {
    const reportTypePills = document.getElementById('reportTypePills');
    const groups = {
        year: document.getElementById('groupYear'),
        quarter: document.getElementById('groupQuarter'),
        month: document.getElementById('groupMonth'),
        customFrom: document.getElementById('groupCustomFrom'),
        customTo: document.getElementById('groupCustomTo')
    };

    function updateFormGroups(type) {
        Object.values(groups).forEach(g => {
            if (g) g.style.display = 'none';
        });

        if (type === 'yearly') {
            if (groups.year) groups.year.style.display = 'block';
        } else if (type === 'quarterly') {
            if (groups.year) groups.year.style.display = 'block';
            if (groups.quarter) groups.quarter.style.display = 'block';
        } else if (type === 'monthly') {
            if (groups.year) groups.year.style.display = 'block';
            if (groups.month) groups.month.style.display = 'block';
        } else if (type === 'custom') {
            if (groups.customFrom) groups.customFrom.style.display = 'block';
            if (groups.customTo) groups.customTo.style.display = 'block';
        }
    }

    if (reportTypePills) {
        reportTypePills.querySelectorAll('.type-pill').forEach((pill) => {
            pill.addEventListener('click', () => {
                reportTypePills.querySelectorAll('.type-pill').forEach((btn) => btn.classList.remove('active'));
                pill.classList.add('active');
                updateFormGroups(pill.dataset.reportType);
            });
        });
    }

    // Initialize groups (Yearly is default active)
    updateFormGroups('yearly');

    // Custom dropdown selections (Year/Quarter/Month selects)
    document.querySelectorAll('[data-select]').forEach((selectWrap) => {
        const trigger = selectWrap.querySelector('.select-trigger');
        const valueEl = trigger.querySelector('.select-value');
        const options = selectWrap.querySelectorAll('.select-option');

        if (!trigger) return;

        trigger.addEventListener('click', (event) => {
            event.stopPropagation();
            document.querySelectorAll('[data-select].open').forEach((openSelect) => {
                if (openSelect !== selectWrap) {
                    openSelect.classList.remove('open');
                    openSelect.querySelector('.select-trigger').setAttribute('aria-expanded', 'false');
                }
            });
            selectWrap.classList.toggle('open');
            trigger.setAttribute('aria-expanded', selectWrap.classList.contains('open') ? 'true' : 'false');
        });

        options.forEach((option) => {
            option.addEventListener('click', () => {
                options.forEach((btn) => btn.classList.remove('selected'));
                option.classList.add('selected');
                valueEl.textContent = option.dataset.value;
                selectWrap.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            });
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('[data-select].open').forEach((openSelect) => {
            openSelect.classList.remove('open');
            openSelect.querySelector('.select-trigger').setAttribute('aria-expanded', 'false');
        });
    });
}

/* ── Pipeline Persistence ──────────────────────────── */

function saveReportPipelineState(state) {
    localStorage.setItem(REPORT_PIPELINE_KEY(), state);
}

function restoreReportPipelineState() {
    const state = localStorage.getItem(REPORT_PIPELINE_KEY());
    if (state === 'completed') {
        const steps = document.querySelectorAll(".pipeline-step");
        const circles = document.querySelectorAll(".pipeline-circle");
        const fillLine = document.querySelector(".pipeline-line-fill");

        steps.forEach(s => s.classList.add("active"));
        circles.forEach(c => c.classList.add("active"));
        if (fillLine) fillLine.style.width = "100%";
    }
}

/* ── Report Generation ─────────────────────────────── */

function wireGeneration() {
    const btn = document.querySelector(".btn-block-dark");
    if (!btn) return;

    btn.addEventListener("click", () => {
        if (!validateReportForm()) return;
        // Capture Parameters
        const type = document.querySelector(".type-pill.active")?.dataset.reportType || "Monthly";
        const year = document.getElementById("yearSelect")?.querySelector(".select-value").textContent || "2026";
        const quarter = document.getElementById("quarterSelect")?.querySelector(".select-value").textContent || "Q3";
        const month = document.getElementById("monthSelect")?.querySelector(".select-value").textContent || "September";

        let reportTitle = `${type.charAt(0).toUpperCase() + type.slice(1)} Sustainability Report`;
        let reportPeriod = "";

        if (type === "yearly") reportPeriod = year;
        else if (type === "quarterly") reportPeriod = `${quarter} ${year}`;
        else if (type === "monthly") reportPeriod = `${month} ${year}`;
        else {
            // Custom range from the two date inputs
            const fromVal = document.getElementById("customDateFrom")?.value || "";
            const toVal = document.getElementById("customDateTo")?.value || "";
            if (fromVal && toVal) {
                const fmt = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                reportPeriod = `${fmt(fromVal)} – ${fmt(toVal)}`;
            } else {
                reportPeriod = "Custom";
            }
        }
        // if (!validateReportForm()) return;

        // Change button state
        btn.textContent = "Generating pipeline...";
        btn.disabled = true;
        btn.style.opacity = "0.7";

        const steps = document.querySelectorAll(".pipeline-step");
        const circles = document.querySelectorAll(".pipeline-circle");
        const fillLine = document.querySelector(".pipeline-line-fill");

        // Reset pipeline completely
        steps.forEach(s => s.classList.remove("active"));
        circles.forEach(c => c.classList.remove("active"));
        if (fillLine) fillLine.style.width = "0%";

        // Sequential animation: step 0 first, then 1, 2, 3, 4...
        let currentStep = 0;

        const interval = setInterval(() => {
            if (currentStep < steps.length) {
                steps[currentStep].classList.add("active");
                circles[currentStep].classList.add("active");
                if (fillLine) {
                    fillLine.style.width = ((currentStep / (steps.length - 1)) * 100) + "%";
                }
                currentStep++;
            } else {
                clearInterval(interval);

                if (fillLine) fillLine.style.width = "100%";

                btn.textContent = "Report Generated!";
                btn.style.background = "#10b981";

                // Persist completed state
                saveReportPipelineState('completed');

                // Add to Global Highlights
                SustDB.addHighlight("Report Generated", `Period: ${reportPeriod}. ${reportTitle}`, "green");

                showToast("Report compiled successfully.", "success", 2000);

                setTimeout(() => {
                    showReportModal(reportTitle, reportPeriod);

                    // Reset button
                    btn.textContent = "Generate Report";
                    btn.disabled = false;
                    btn.style.opacity = "1";
                    btn.style.background = "";
                }, 1000);
            }
        }, 600);
    });
}

function showReportModal(title, period) {
    import('./utils/utils.js').then(utils => {
        utils.openModal({
            title: "Report",
            bodyHTML: `
                <div class="report-preview-container">
                    <div class="report-header">
                        <h2>Sustainability Report</h2>
                        <p>Period: ${period}</p>
                    </div>
                    
                    <div class="report-body-grid">
                        <div class="report-stat-card">
                            <h4>Energy Reduction</h4>
                            <div class="val">-4.2%</div>
                        </div>
                        <div class="report-stat-card">
                            <h4>Waste Diverted</h4>
                            <div class="val">68%</div>
                        </div>
                        <div class="report-stat-card">
                            <h4>Carbon Offset</h4>
                            <div class="val">124 tCO₂e</div>
                        </div>
                        <div class="report-stat-card">
                            <h4>Water Saved</h4>
                            <div class="val">1.2 ML</div>
                        </div>
                    </div>
                    
                </div>
            `,
            confirmLabel: "Close and Archive Report",
            cancelLabel: "",
            onConfirm: () => {
                // Save report to sustainability report archives
                try {
                    const raw = localStorage.getItem('enertrack_universal_v1');
                    const fullData = raw ? JSON.parse(raw) : {};
                    if (fullData.sust) {
                        if (!Array.isArray(fullData.sust.reportArchives)) {
                            fullData.sust.reportArchives = [];
                        }
                        fullData.sust.reportArchives.unshift({
                            id: 'RPT-' + Date.now().toString(36).toUpperCase(),
                            title: title || 'Sustainability Report',
                            period: period,
                            energyReduction: '-4.2%',
                            wasteDiverted: '68%',
                            carbonOffset: '124 tCO₂e',
                            waterSaved: '1.2 ML',
                            archivedAt: new Date().toISOString()
                        });
                        localStorage.setItem('enertrack_universal_v1', JSON.stringify(fullData));
                    }
                } catch (e) { console.error('Failed to archive report:', e); }

                resetReportingPipeline();
                showToast("Report archived successfully.", "success");
            }
        });
    });
}

function resetReportingPipeline() {
    saveReportPipelineState('initial');

    // Reset visual pipeline explicitly
    const steps = document.querySelectorAll(".pipeline-step");
    const circles = document.querySelectorAll(".pipeline-circle");
    const fillLine = document.querySelector(".pipeline-line-fill");
    const btn = document.querySelector(".btn-block-dark");

    steps.forEach(s => s.classList.remove("active"));
    circles.forEach(c => c.classList.remove("active"));
    if (fillLine) fillLine.style.width = "0%";

    if (btn) {
        btn.textContent = "Generate Report";
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.background = "";
    }
}


function validateReportForm() {
    const type = document.querySelector(".type-pill.active")?.dataset.reportType;
    if (type === "custom") {
        const fromVal = document.getElementById("customDateFrom")?.value;
        const toVal = document.getElementById("customDateTo")?.value;

        if (!fromVal || !toVal) {
            showToast("Please select both a From  and To date", "error");
            return false;
        }
        if (new Date(fromVal) >= new Date(toVal)) {
            showToast("From  date must be before the To date", "error");
            return false;
        }
    }

    return true;
}
