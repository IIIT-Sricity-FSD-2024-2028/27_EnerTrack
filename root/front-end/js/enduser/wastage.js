import universalDB from '../shared/universalDB.js';
import { generateSensorData, getMetricUnit, getMetricCategory, getBaselineRange } from '../shared/sensorSimulator.js';
import { renderBellIcon, notifyOnStateChange } from '../shared/notifications.js';

document.addEventListener('DOMContentLoaded', () => {
    // ── Auth Check ──────────────────────────────────────────
    const stored = localStorage.getItem('currentUser');
    if (!stored) {
        window.location.href = '../sign_in/sign_in.html';
        return;
    }
    const user = JSON.parse(stored);

    // One-time backfill: older dismissed reports were not auto-archived.
    // Normalize them so they disappear from active logs and show in archives.
    (function backfillDismissedArchives() {
        const raw = localStorage.getItem('enertrack_universal_v1');
        if (!raw) return;
        const data = JSON.parse(raw);
        const reports = data?.workflow?.wastageReports || [];
        let changed = false;
        reports.forEach((r) => {
            if (r.status === 'Dismissed' && !r.archived) {
                r.archived = true;
                r.archivedAt = r.dismissedAt || new Date().toISOString();
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem('enertrack_universal_v1', JSON.stringify(data));
        }
    })();

    document.getElementById('sidebarUserName').textContent = user.name;
    document.getElementById('sidebarUserRole').textContent = user.role;
    document.getElementById('welcomeHeading').textContent = `Welcome, ${user.name}`;

    // Render notification bell
    renderBellIcon('notif-container', user.email);

    // ── Pre-fill Email ───────────────────────────────────────
    document.getElementById('userEmail').value = user.email;

    // ── Cross-tab sync: re-render when SO/Finance acts ──────
    window.addEventListener('storage', (e) => {
        if (e.key === 'enertrack_universal_v1') {
            renderTickets();
            renderAuditTimeline();
        }
    });

    // ── Form State Persistence ───────────────────────────────
    const formStateKey = 'wastageFormState';
    
    function saveFormState() {
        const state = {
            wastageType: document.getElementById('wastageType').value,
            priority: document.getElementById('issuePriority').value
        };
        document.querySelectorAll('#wastageReportForm input:not([type="hidden"]), #wastageReportForm textarea').forEach(el => {
            if (el.id !== 'userEmail') state[el.id] = el.value;
        });
        sessionStorage.setItem(formStateKey, JSON.stringify(state));
    }

    // ── Priority Selector ────────────────────────────────────
    const priorityInput = document.getElementById('issuePriority');
    document.querySelectorAll('.priority-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.priority-btn').forEach(b => {
                b.classList.remove('selected-low', 'selected-medium', 'selected-high');
            });
            const p = btn.dataset.priority;
            btn.classList.add(`selected-${p.toLowerCase()}`);
            priorityInput.value = p;
            saveFormState();
        });
    });

    // ── Dynamic Form UI Logic ────────────────────────────────
    const wastageTypeDropdown = document.getElementById('wastageType');
    const dynamicFieldsContainer = document.getElementById('dynamicFields');

    function updateDynamicFields(selectedValue) {
        dynamicFieldsContainer.className = '';
        if (selectedValue) {
            dynamicFieldsContainer.classList.add(`show-${selectedValue}`);
        }
        document.querySelectorAll('#dynamicFields input, #dynamicFields textarea').forEach(el => el.required = false);
        if (selectedValue) {
            const activeFields = document.querySelectorAll(`#dynamicFields .field-${selectedValue} input, #dynamicFields .field-${selectedValue} textarea`);
            activeFields.forEach(el => el.required = true);
        }
    }

    wastageTypeDropdown.addEventListener('change', (e) => {
        updateDynamicFields(e.target.value);
        saveFormState();
    });

    // ── Global Change Listener for Saving State ──────────────
    document.getElementById('wastageReportForm').addEventListener('input', (e) => {
        if(e.target.id !== 'userEmail') {
            saveFormState();
            e.target.classList.remove('error-highlight');
        }
    });

    // ── Load Persisted State ─────────────────────────────────
    function loadPersistedState() {
        const savedStateStr = sessionStorage.getItem(formStateKey);
        if (savedStateStr) {
            const state = JSON.parse(savedStateStr);
            if (state.wastageType) {
                wastageTypeDropdown.value = state.wastageType;
                updateDynamicFields(state.wastageType);
            }
            if (state.priority) {
                priorityInput.value = state.priority;
                document.querySelectorAll('.priority-btn').forEach(b => {
                    b.classList.remove('selected-low', 'selected-medium', 'selected-high');
                    if (b.dataset.priority === state.priority) {
                        b.classList.add(`selected-${state.priority.toLowerCase()}`);
                    }
                });
            }
            Object.keys(state).forEach(id => {
                const el = document.getElementById(id);
                if (el && id !== 'wastageType' && id !== 'priority') {
                    el.value = state[id];
                }
            });
        }
    }
    
    loadPersistedState();

    // ── Form Submit ──────────────────────────────────────────
    document.getElementById('wastageReportForm').addEventListener('submit', (e) => {
        e.preventDefault();

        // Strict Validation
        let isValid = true;
        const formElements = document.querySelectorAll('#wastageReportForm input, #wastageReportForm textarea, #wastageReportForm select');
        formElements.forEach(el => {
            if (el.required && !el.value.trim() && el.offsetParent !== null) {
                el.classList.add('error-highlight');
                isValid = false;
            } else {
                el.classList.remove('error-highlight');
            }
        });

        if (!isValid) return;

        const issueType = wastageTypeDropdown.value;
        const priority = priorityInput.value || 'Low';

        if (!issueType) return;

        const specificData = {};
        if (issueType === 'Energy') {
            specificData.building = document.getElementById('energyBuilding').value.trim();
            specificData.area = document.getElementById('energyArea').value.trim();
            specificData.observation = document.getElementById('energyObservation').value.trim();
            const reported = Number(document.getElementById('energyEstimatedValue').value);
            if (Number.isFinite(reported) && reported > 0) {
                specificData.reportedValue = reported;
                specificData.reportedUnit = 'kWh';
            }
        } else if (issueType === 'Water') {
            specificData.location = document.getElementById('waterLocation').value.trim();
            specificData.nature = document.getElementById('waterNature').value.trim();
            const reported = Number(document.getElementById('waterEstimatedValue').value);
            if (Number.isFinite(reported) && reported > 0) {
                specificData.reportedValue = reported;
                specificData.reportedUnit = 'L';
            }
        } else if (issueType === 'Emissions') {
            specificData.source = document.getElementById('emissionsSource').value.trim();
            specificData.location = document.getElementById('emissionsLocation').value.trim();
            specificData.observation = document.getElementById('emissionsObservation').value.trim();
            const reported = Number(document.getElementById('emissionsEstimatedValue').value);
            if (Number.isFinite(reported) && reported > 0) {
                specificData.reportedValue = reported;
                specificData.reportedUnit = 'kg CO2e';
            }
        } else if (issueType === 'Food') {
            specificData.cafeteria = document.getElementById('foodCafeteria').value.trim();
            specificData.typeOfWastage = document.getElementById('foodType').value.trim();
            specificData.estimatedAmount = document.getElementById('foodAmount').value.trim();
            const reported = Number(specificData.estimatedAmount);
            if (Number.isFinite(reported) && reported > 0) {
                specificData.reportedValue = reported;
                specificData.reportedUnit = 'kg';
            }
        }

        // Enforce baseline guardrail: estimate must be >= 50% of baseline minimum.
        const baseline = getBaselineRange(issueType);
        const reportedValue = Number(specificData.reportedValue);
        if (!baseline || !Number.isFinite(reportedValue) || reportedValue <= 0) {
            window.alert('Please enter an estimated wastage value before submitting.');
            return;
        }
        const minimumAccepted = baseline.min * 0.5;
        if (reportedValue < minimumAccepted) {
            window.alert(`This form cannot be accepted. Entered estimate (${reportedValue} ${baseline.unit}) is below 50% of baseline (${minimumAccepted} ${baseline.unit}).`);
            return;
        }

        // ── System Actor (Steps 4-5): Enrich with sensor data ──
        const systemData = generateSensorData(issueType, specificData);
        const metricUnit = getMetricUnit(issueType);
        const metricCategory = getMetricCategory(issueType);

        // ── Duplicate Detection Helper ──
        function _getLocation(type, data) {
            if (type === 'Energy') return (data.building || '').toLowerCase();
            if (type === 'Water') return (data.location || '').toLowerCase();
            if (type === 'Emissions') return (data.location || '').toLowerCase();
            if (type === 'Food') return (data.cafeteria || '').toLowerCase();
            return '';
        }

        function _submitReport(report) {
            if (!universalDB.data.workflow.wastageReports) {
                universalDB.data.workflow.wastageReports = [];
            }
            universalDB.data.workflow.wastageReports.push(report);
            universalDB.save();

            // Reset
            document.getElementById('wastageReportForm').reset();
            document.getElementById('userEmail').value = user.email;
            updateDynamicFields('');
            sessionStorage.removeItem(formStateKey);

            document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('selected-low', 'selected-medium', 'selected-high'));
            document.querySelector('[data-priority="Low"]').classList.add('selected-low');
            priorityInput.value = 'Low';

            showToast();
            renderTickets();
            renderAuditTimeline();
            notifyOnStateChange(report, 'submitted', user.name);
            renderBellIcon('notif-container', user.email);
        }

        const report = {
            id: 'WR-' + Date.now().toString(36).toUpperCase(),
            source: 'User-Reported',
            reporterName: user.name,
            reporterEmail: user.email,
            type: issueType,
            specificData: specificData,
            priority: priority,
            metricUnit: metricUnit,
            metricCategory: metricCategory,
            systemData: systemData,
            status: 'Reported',
            timestamp: new Date().toISOString()
        };

        // ── Duplicate Detection ──
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const newLoc = _getLocation(issueType, specificData);
        const existingReports = getFreshReports();
        const duplicate = existingReports.find(r =>
            r.type === issueType &&
            r.reporterEmail === user.email &&
            !r.archived &&
            r.status !== 'Dismissed' &&
            new Date(r.timestamp).getTime() > sevenDaysAgo &&
            _getLocation(r.type, r.specificData || {}) === newLoc &&
            newLoc !== ''
        );

        if (duplicate) {
            // Show inline confirmation modal
            const daysAgo = Math.floor((Date.now() - new Date(duplicate.timestamp).getTime()) / (24 * 60 * 60 * 1000));
            const overlay = document.createElement('div');
            overlay.id = 'dup-modal-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:9999;';
            overlay.innerHTML = `
                <div style="background:#fff;border-radius:12px;padding:28px 32px;width:480px;max-width:94vw;box-shadow:0 20px 48px rgba(0,0,0,0.18);">
                    <h3 style="font-size:17px;font-weight:700;margin-bottom:12px;color:#111827;">Possible Duplicate Report</h3>
                    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px;margin-bottom:16px;">
                        <p style="font-size:13px;color:#92400e;margin:0;">A similar <strong>${issueType} wastage</strong> report (<strong>#${duplicate.id}</strong>) was filed <strong>${daysAgo === 0 ? 'today' : daysAgo + ' day' + (daysAgo > 1 ? 's' : '') + ' ago'}</strong> for the same location.</p>
                    </div>
                    <p style="font-size:14px;color:#374151;margin:0 0 20px 0;">Do you still want to submit this report?</p>
                    <div style="display:flex;justify-content:flex-end;gap:10px;">
                        <button id="dup-cancel" style="padding:8px 18px;border-radius:6px;font-size:14px;font-weight:600;border:1px solid #d1d5db;background:#fff;color:#374151;cursor:pointer;">Cancel</button>
                        <button id="dup-submit" style="padding:8px 18px;border-radius:6px;font-size:14px;font-weight:600;border:none;background:#111827;color:#fff;cursor:pointer;">Submit Anyway</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (ev) => { if (ev.target === overlay) overlay.remove(); });
            document.getElementById('dup-cancel').onclick = () => overlay.remove();
            document.getElementById('dup-submit').onclick = () => { overlay.remove(); _submitReport(report); };
        } else {
            _submitReport(report);
        }
    });

    const STATUS_MAP = {
        'Reported':              { label: 'Reported',              cssClass: 'status-reported',       step: 2, hint: 'Your report was submitted and sensor data attached. Awaiting officer review.' },
        'Validated':             { label: 'Validated',             cssClass: 'status-validated',      step: 3, hint: 'The Sustainability Officer has confirmed this as a genuine issue.' },
        'Forwarded to Finance':  { label: 'Under Finance Review',  cssClass: 'status-finance',        step: 4, hint: 'Forwarded to the Finance Analyst for cost-impact assessment.' },
        'Cost Impact Added':     { label: 'Under Finance Review',  cssClass: 'status-finance',        step: 4, hint: 'Finance is finalizing cost-impact figures for this report.' },
        'Returned to SO':        { label: 'Cost Assessed',         cssClass: 'status-cost-assessed',  step: 4, hint: 'Finance has added cost data. The officer is preparing the final decision.' },
        'Finalized':             { label: 'Resolved',              cssClass: 'status-finalized',      step: 5, hint: 'The report has been fully resolved and archived.' },
        'Target Set':            { label: 'Target Set',            cssClass: 'status-target-set',     step: 5, hint: 'A new sustainability target was set based on your report.' },
        'Delivered':             { label: 'Report Delivered',       cssClass: 'status-finalized',      step: 6, hint: 'Detailed findings report has been delivered. Check your wastage logs for the full breakdown.' },
        'Dismissed':             { label: 'Dismissed',             cssClass: 'status-dismissed',      step: 3, hint: 'The officer dismissed this report as not actionable.' }
    };

    const TIMELINE_STEPS = [
        { num: 1, label: 'Observation Logging',  desc: 'You observe and document exactly where waste is happening.' },
        { num: 2, label: 'System Cross-Check',   desc: 'We correlate your report with real-time IoT campus sensor data.' },
        { num: 3, label: 'Officer Audit',        desc: 'Our Sustainability Officer validates and compiles the footprint report.' },
        { num: 4, label: 'Finance Review',       desc: 'Analysts assign ROI impacts to justify process change.' },
        { num: 5, label: 'Target Adjusted',      desc: 'Policy and process changes are finalized to prevent future waste.' },
        { num: 6, label: 'Report Delivered',      desc: 'Detailed findings report sent back to you. Check My Wastage Logs.' }
    ];

    // ── Track selected report for per-log timeline filtering ──
    let selectedReportId = null;

    // Helper: always read fresh from localStorage to avoid stale cache
    function getFreshReports() {
        const raw = localStorage.getItem('enertrack_universal_v1');
        if (!raw) return [];
        const data = JSON.parse(raw);
        return data?.workflow?.wastageReports || [];
    }

    // ── Render Audit Timeline ─────────────────────────────────
    function renderAuditTimeline(reportId) {
        const container = document.getElementById('auditTimeline');
        if (!container) return;

        const allReports = getFreshReports();
        const myReports = allReports
            .filter(wr => wr.reporterEmail === user.email && !wr.archived)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // If nothing is selected, reset timeline to step 1 (default guidance state)
        const lookupId = reportId || selectedReportId;
        if (!lookupId) {
            const staticHTML = TIMELINE_STEPS.map(step => `
              <li>
                <div class="tl-dot ${step.num === 1 ? 'active' : 'pending'}">${step.num}</div>
                <div>
                  <p class="tl-label">${step.label}</p>
                  <p class="tl-desc">${step.desc}</p>
                </div>
              </li>`).join('');
            container.innerHTML = staticHTML;
            return;
        }

        // If a specific reportId is provided (card clicked), use that report only
        let targetReport = null;
        if (lookupId) {
            targetReport = allReports.find(r => r.id === lookupId) || null;
        }
        if (!targetReport) {
            targetReport = myReports[0] || null;
        }

        if (!targetReport) {
            container.innerHTML = TIMELINE_STEPS.map(step => `
              <li>
                <div class="tl-dot pending">${step.num}</div>
                <div>
                  <p class="tl-label">${step.label}</p>
                  <p class="tl-desc">${step.desc}</p>
                </div>
              </li>`).join('');
            return;
        }

        let activeStep = 0;
        let isDismissed = false;
        let activeHint = '';

        const cfg = STATUS_MAP[targetReport.status];
        if (cfg) {
            activeStep = cfg.step;
            activeHint = cfg.hint;
        } else {
            activeStep = 2;
            activeHint = 'Your report is being processed.';
        }
        isDismissed = targetReport.status === 'Dismissed';

        // isFullyDone: only when the workflow is at step 6 (Delivered) are ALL steps green
        const isFullyDone = activeStep >= 6;

        // Only show filter label when user explicitly clicked a card
        const filterLabel = (lookupId)
            ? `<div style="font-size:12px;color:#6b7280;margin-bottom:8px;font-weight:500;">Showing audit trail for <strong style="color:#111827;">#${targetReport.id}</strong></div>`
            : '';

        const stepsHTML = TIMELINE_STEPS.map(step => {
            let dotClass = 'pending';
            let extraHTML = '';

            if (isDismissed) {
                if (step.num < 3) {
                    dotClass = 'done';
                } else if (step.num === 3) {
                    dotClass = 'dismissed';
                    extraHTML = `<p class="tl-active-desc" style="color:#6b7280;">This report was dismissed by the officer.</p>`;
                } else {
                    dotClass = 'pending';
                }
            } else if (isFullyDone) {
                // All steps green when delivered
                dotClass = 'done';
            } else {
                if (step.num < activeStep) {
                    dotClass = 'done';
                } else if (step.num === activeStep) {
                    dotClass = 'active';
                    extraHTML = `<p class="tl-active-desc">${activeHint}</p>`;
                } else {
                    dotClass = 'pending';
                }
            }

            // Step 1 is always done if a report exists
            if (step.num === 1 && activeStep >= 2) {
                dotClass = 'done';
            }

            return `
              <li>
                <div class="tl-dot ${dotClass}">${step.num}</div>
                <div>
                  <p class="tl-label">${step.label}</p>
                  <p class="tl-desc">${step.desc}</p>
                  ${extraHTML}
                </div>
              </li>`;
        }).join('');

        container.innerHTML = filterLabel + stepsHTML;
    }

    // ── Render Tickets ───────────────────────────────────────
    function renderTickets() {
        const container = document.getElementById('userWastageContainer');
        const countBadge = document.getElementById('myReportsCount');

        const myReports = getFreshReports()
            .filter(wr => wr.reporterEmail === user.email && !wr.archived)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        countBadge.textContent = myReports.length;

        if (myReports.length === 0) {
            container.innerHTML = `
              <div class="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                <p>You haven't logged any wastage reports yet.</p>
              </div>`;
            return;
        }

        container.innerHTML = myReports.map(t => {
            const cfg = STATUS_MAP[t.status] || { label: t.status, cssClass: 'status-reported', step: 2, hint: 'Processing your report.' };
            const statusClass = cfg.cssClass;
            const statusLabel = cfg.label;
            const statusHint = cfg.hint;

            let summaryText = '';
            let locationText = '';
            if (t.type === 'Energy') { summaryText = t.specificData.observation; locationText = t.specificData.building; }
            else if (t.type === 'Water') { summaryText = t.specificData.nature; locationText = t.specificData.location; }
            else if (t.type === 'Emissions') { summaryText = t.specificData.observation; locationText = t.specificData.location; }
            else if (t.type === 'Food') { summaryText = t.specificData.typeOfWastage + ' (' + t.specificData.estimatedAmount + 'kg)'; locationText = t.specificData.cafeteria; }

            const pClass = `p-${t.priority || 'Low'}`;
            const typeTag = `<span style="background:#059669;color:white;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:8px;">${t.type} Wastage</span>`;

            // Build expanded sections for finalized / delivered reports
            let expandedHTML = '';
            const isResolved = t.status === 'Finalized' || t.status === 'Target Set' || t.status === 'Delivered';
            if (isResolved) {
                const formatCurr = (v) => '₹' + Number(v).toLocaleString('en-IN');
                const sd = t.systemData || {};
                const ci = t.costImpact;
                const mt = t.metricTarget;

                // Build professional narrative
                let narrativeParts = [];
                narrativeParts.push(`This ${t.type.toLowerCase()} wastage report was reviewed and validated by the Sustainability Officer, confirming it as a substantiated concern requiring remediation.`);

                if (ci) {
                    narrativeParts.push(`Following financial due diligence, the Finance Analyst determined that the estimated economic impact of this issue amounts to <strong style="color:#dc2626;">${formatCurr(ci.estimatedLoss)}</strong> in projected losses if left unresolved. The recommended remediation cost stands at <strong>${formatCurr(ci.remediationCost)}</strong>, with an anticipated annual saving of <strong style="color:#059669;">${formatCurr(ci.projectedSavings)}</strong> upon implementation.`);
                    const roiVal = ci.roi != null ? ci.roi : (ci.remediationCost > 0 ? (((ci.projectedSavings - ci.remediationCost) / ci.remediationCost) * 100) : null);
                    const paybackVal = ci.paybackPeriod != null ? ci.paybackPeriod : (ci.projectedSavings > 0 ? (ci.remediationCost / ci.projectedSavings) : null);
                    if (roiVal !== null && paybackVal !== null) {
                        narrativeParts.push(`The projected return on investment is <strong style="color:#059669;">${roiVal.toFixed(1)}%</strong> with an estimated payback period of <strong style="color:#1e40af;">${paybackVal.toFixed(1)} years</strong>.`);
                    }
                }

                if (mt) {
                    narrativeParts.push(`In response, the Sustainability Officer has established a revised ${t.type.toLowerCase()} reduction target of <strong style="color:#1e40af;">${mt.value} ${mt.unit}</strong>, effective until <strong>${new Date(mt.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>.`);
                }

                if (t.status === 'Delivered') {
                    narrativeParts.push('This report has been formally closed. All findings, financial assessments, and corrective actions have been documented and delivered for your records.');
                }

                let narrativeHTML = '';
                if (narrativeParts.length > 0) {
                    narrativeHTML = `
                    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin-top:12px;">
                      <h5 style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#065f46;margin:0 0 8px 0;">Decision Summary</h5>
                      <div style="font-size:12px;color:#374151;line-height:1.7;">
                        ${narrativeParts.map(p => '<p style="margin:0 0 6px 0;">' + p + '</p>').join('')}
                      </div>
                    </div>`;
                }

                let costHTML = '';
                if (ci) {
                    costHTML = `
                    <div class="exp-box">
                      <h5>Financial Impact Assessment</h5>
                      <div style="display:flex;gap:12px;flex-wrap:wrap;">
                        <div><div class="exp-sub">Est. Loss</div><div class="exp-val" style="color:#dc2626;">${formatCurr(ci.estimatedLoss)}</div></div>
                        <div><div class="exp-sub">Remediation</div><div class="exp-val">${formatCurr(ci.remediationCost)}</div></div>
                        <div><div class="exp-sub">Savings</div><div class="exp-val" style="color:#059669;">${formatCurr(ci.projectedSavings)}</div></div>
                      </div>
                    </div>`;
                }

                let targetHTML = '';
                if (mt) {
                    targetHTML = `
                    <div class="exp-box">
                      <h5>Sustainability Target</h5>
                      <div class="exp-val" style="color:#1e40af;">${mt.value} <small style="font-size:11px;font-weight:400;">${mt.unit}</small></div>
                      <div class="exp-sub">Deadline: ${new Date(mt.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </div>`;
                }

                let sensorHTML = '';
                if (sd.sensorId) {
                    sensorHTML = `
                    <div class="exp-box">
                      <h5>${t.type === 'Food' ? 'Wastage Assessment' : t.type === 'Water' ? 'Flow Monitoring' : t.type === 'Emissions' ? 'Emissions Monitoring' : 'Energy Meter Reading'} (${sd.sensorId})</h5>
                      <div style="display:flex;gap:12px;">
                        <div><div class="exp-sub">Current</div><div class="exp-val">${sd.readingValue || '\u2014'} <small style="font-size:11px;">${sd.readingUnit || ''}</small></div></div>
                        <div><div class="exp-sub">Baseline</div><div class="exp-val" style="color:#6b7280;">${sd.baselineValue || '\u2014'} <small style="font-size:11px;">${sd.readingUnit || ''}</small></div></div>
                      </div>
                    </div>`;
                }

                let dataGridHTML = '';
                if (costHTML || targetHTML || sensorHTML) {
                    dataGridHTML = `<div class="ticket-expanded-section">${costHTML}${targetHTML}${sensorHTML}</div>`;
                }

        // Before/After Comparison Bars for resolved reports.
        // Show baseline vs current always; include target row when available.
        let comparisonHTML = '';
        if (sd.baselineValue && sd.readingValue) {
            const targetVal = mt ? (parseFloat(mt.value) || 0) : 0;
            const maxVal = Math.max(sd.readingValue, sd.baselineValue, targetVal) * 1.1;
            const baselineW = (sd.baselineValue / maxVal * 100).toFixed(1);
            const currentW = (sd.readingValue / maxVal * 100).toFixed(1);
            const targetW = ((targetVal) / maxVal * 100).toFixed(1);
            const unit = sd.readingUnit || '';
            const targetRowHTML = mt ? `
                        <div style="display:flex;align-items:center;gap:8px;"><span style="font-size:11px;color:#6b7280;width:60px;">Target</span><div style="flex:1;background:#bbf7d0;border-radius:4px;height:18px;overflow:hidden;"><div style="width:${targetW}%;background:#059669;height:100%;border-radius:4px;"></div></div><span style="font-size:12px;font-weight:600;color:#059669;min-width:60px;text-align:right;">${mt.value} ${unit}</span></div>
            ` : '';
            comparisonHTML = `
                    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-top:12px;">
                      <h5 style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#374151;margin:0 0 10px 0;">Before / After Comparison</h5>
                      <div style="display:flex;flex-direction:column;gap:8px;">
                        <div style="display:flex;align-items:center;gap:8px;"><span style="font-size:11px;color:#6b7280;width:60px;">Baseline</span><div style="flex:1;background:#e5e7eb;border-radius:4px;height:18px;overflow:hidden;"><div style="width:${baselineW}%;background:#9ca3af;height:100%;border-radius:4px;"></div></div><span style="font-size:12px;font-weight:600;color:#6b7280;min-width:60px;text-align:right;">${sd.baselineValue} ${unit}</span></div>
                        <div style="display:flex;align-items:center;gap:8px;"><span style="font-size:11px;color:#6b7280;width:60px;">Current</span><div style="flex:1;background:#fecaca;border-radius:4px;height:18px;overflow:hidden;"><div style="width:${currentW}%;background:#dc2626;height:100%;border-radius:4px;"></div></div><span style="font-size:12px;font-weight:600;color:#dc2626;min-width:60px;text-align:right;">${sd.readingValue} ${unit}</span></div>
                        ${targetRowHTML}
                      </div>
                    </div>`;
        }

                expandedHTML = dataGridHTML + narrativeHTML + comparisonHTML;
            }

            // Display box for dismissed reports
            if (t.status === 'Dismissed') {
                expandedHTML = `
                <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:14px;margin-top:12px;">
                  <h5 style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#475569;margin:0 0 8px 0;">Dismissal Notice</h5>
                  <div style="font-size:13px;color:#374151;line-height:1.6;">
                    <p style="margin:0 0 4px 0;"><strong>Reason:</strong> ${t.dismissReason || 'Not specified'}</p>
                    <p style="margin:0 0 4px 0;">${t.dismissComment || ''}</p>
                    <p style="margin:0;font-size:11px;color:#9ca3af;">Dismissed on ${t.dismissedAt ? new Date(t.dismissedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</p>
                  </div>
                </div>`;
            }

            // Archive button for resolved reports
            let archiveBtnHTML = '';
            if (isResolved) {
                archiveBtnHTML = `<button onclick="event.stopPropagation(); window._archiveReport('${t.id}');" style="margin-top:10px;padding:6px 14px;border-radius:6px;border:1px solid #d1d5db;background:#f9fafb;color:#374151;font-size:12px;font-weight:600;cursor:pointer;transition:background .2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='#f9fafb'">Archive Report</button>`;
            }

            // Comment Thread
            const comments = t.comments || [];
            const commentListHTML = comments.map(c => {
                const roleBadge = c.role === 'Sustainability Officer' ? 'SO' : c.role === 'Finance Analyst' ? 'FA' : 'You';
                const roleBg = c.role === 'Sustainability Officer' ? '#059669' : c.role === 'Finance Analyst' ? '#6366f1' : '#6b7280';
                return `<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6;">
                    <div style="flex-shrink:0;width:28px;height:28px;border-radius:50%;background:${roleBg};color:white;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">${roleBadge}</div>
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:12px;font-weight:600;color:#111827;">${c.author}</span><span style="font-size:10px;color:#9ca3af;">${new Date(c.timestamp).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span></div>
                        <p style="font-size:12px;color:#374151;margin:2px 0 0 0;line-height:1.5;">${c.text}</p>
                    </div>
                </div>`;
            }).join('');

            const commentThreadHTML = `
            <div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:10px;" onclick="event.stopPropagation();">
                <div style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;" onclick="const el=this.nextElementSibling;el.style.display=el.style.display==='none'?'block':'none';this.querySelector('.cmt-toggle').textContent=el.style.display==='none'?'Show':'Hide';">
                    <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.4px;color:#6b7280;font-weight:600;">Comments (${comments.length})</span>
                    <span class="cmt-toggle" style="font-size:11px;color:#059669;font-weight:600;">Show</span>
                </div>
                <div style="display:none;">
                    ${commentListHTML || '<p style="font-size:12px;color:#9ca3af;margin:8px 0;">No comments yet.</p>'}
                    <div style="display:flex;gap:8px;margin-top:8px;">
                        <input type="text" id="cmt-${t.id}" placeholder="Add a comment..." style="flex:1;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;color:#1f2937;">
                        <button onclick="event.stopPropagation(); window._addComment('${t.id}', 'Campus Visitor');" style="padding:6px 12px;border-radius:6px;border:none;background:#111827;color:white;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;">Send</button>
                    </div>
                </div>
            </div>`;
            const isSelected = selectedReportId === t.id;
            const selectedBorder = isSelected ? 'border-color:#059669;box-shadow:0 0 0 2px rgba(5,150,105,0.15);' : '';

            return `
              <div class="ticket-card" style="cursor:pointer;${selectedBorder}" onclick="window._selectReport('${t.id}')">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;width:100%;gap:16px;">
                  <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:4px;">
                      <strong style="font-size:14px;color:var(--dark);">#${t.id}</strong>
                      ${typeTag}
                    </div>
                    <p style="font-size:13px;color:#374151;margin:0 0 6px 0;line-height:1.5;">${summaryText}</p>
                    <div class="ticket-location">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      ${locationText}
                    </div>
                    <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
                      <span class="ticket-priority ${pClass}">${t.priority || 'Low'} Priority</span>
                      <span class="ticket-meta">${new Date(t.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                  <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;margin-left:auto;max-width:200px;">
                    <span class="ticket-status ${statusClass}">${statusLabel}</span>
                    <div class="ticket-status-hint" style="text-align:right;">${statusHint}</div>
                  </div>
                </div>
                ${expandedHTML}
                ${archiveBtnHTML}
                ${commentThreadHTML}
              </div>`;
        }).join('');
    }
    // ── Add Comment Handler ────────────────────────────────
    window._addComment = function (reportId, role) {
        const input = document.getElementById(`cmt-${reportId}`);
        if (!input) return;
        const text = input.value.trim();
        if (!text) return;

        const raw = localStorage.getItem('enertrack_universal_v1');
        if (!raw) return;
        const data = JSON.parse(raw);
        const report = (data.workflow.wastageReports || []).find(r => r.id === reportId);
        if (!report) return;

        if (!report.comments) report.comments = [];
        report.comments.push({
            author: user.name,
            role: role,
            text: text,
            timestamp: new Date().toISOString()
        });
        localStorage.setItem('enertrack_universal_v1', JSON.stringify(data));
        renderTickets();
    };

    // ── Select Report (click card → prefill form + filter timeline) ──
    window._selectReport = function (reportId) {
        const reports = getFreshReports();
        const report = reports.find(r => r.id === reportId);
        if (!report) return;

        selectedReportId = reportId;

        // Prefill form fields in read-only view mode
        const form = document.getElementById('wastageReportForm');
        const header = document.querySelector('.report-card-header h2');
        const headerDesc = document.querySelector('.report-card-header p');
        const submitBtn = document.querySelector('.btn-submit');

        // Set type
        document.getElementById('wastageType').value = report.type;
        updateDynamicFields(report.type);

        // Set priority
        priorityInput.value = report.priority || 'Low';
        document.querySelectorAll('.priority-btn').forEach(b => {
            b.classList.remove('selected-low', 'selected-medium', 'selected-high');
            if (b.dataset.priority === (report.priority || 'Low')) {
                b.classList.add(`selected-${(report.priority || 'Low').toLowerCase()}`);
            }
        });

        // Fill specific fields based on type
        const sp = report.specificData || {};
        if (report.type === 'Energy') {
            const bld = document.getElementById('energyBuilding'); if (bld) bld.value = sp.building || '';
            const area = document.getElementById('energyArea'); if (area) area.value = sp.area || '';
            const obs = document.getElementById('energyObservation'); if (obs) obs.value = sp.observation || '';
            const est = document.getElementById('energyEstimatedValue'); if (est) est.value = sp.reportedValue || '';
        } else if (report.type === 'Water') {
            const loc = document.getElementById('waterLocation'); if (loc) loc.value = sp.location || '';
            const nat = document.getElementById('waterNature'); if (nat) nat.value = sp.nature || '';
            const est = document.getElementById('waterEstimatedValue'); if (est) est.value = sp.reportedValue || '';
        } else if (report.type === 'Emissions') {
            const src = document.getElementById('emissionsSource'); if (src) src.value = sp.source || '';
            const loc = document.getElementById('emissionsLocation'); if (loc) loc.value = sp.location || '';
            const obs = document.getElementById('emissionsObservation'); if (obs) obs.value = sp.observation || '';
            const est = document.getElementById('emissionsEstimatedValue'); if (est) est.value = sp.reportedValue || '';
        } else if (report.type === 'Food') {
            const caf = document.getElementById('foodCafeteria'); if (caf) caf.value = sp.cafeteria || '';
            const typ = document.getElementById('foodType'); if (typ) typ.value = sp.typeOfWastage || '';
            const amt = document.getElementById('foodAmount'); if (amt) amt.value = sp.estimatedAmount || '';
        }

        // Switch to view mode
        form.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(el => {
            el.setAttribute('disabled', 'true');
        });

        if (header) header.textContent = `Viewing Report #${reportId}`;
        if (headerDesc) headerDesc.textContent = `Status: ${STATUS_MAP[report.status]?.label || report.status}`;
        if (submitBtn) submitBtn.style.display = 'none';

        // Show "New Report" link outside the form (placed after the form card)
        let newBtn = document.getElementById('newReportBtn');
        if (!newBtn) {
            const reportCard = document.querySelector('.report-card');
            newBtn = document.createElement('div');
            newBtn.id = 'newReportBtn';
            newBtn.style.cssText = 'margin-top:12px;text-align:center;padding:10px 0;cursor:pointer;color:#059669;font-weight:600;font-size:14px;transition:opacity .2s;';
            newBtn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Create New Report</span>`;
            newBtn.onmouseover = () => newBtn.style.opacity = '0.7';
            newBtn.onmouseout = () => newBtn.style.opacity = '1';
            newBtn.onclick = () => window._clearSelection();
            reportCard.parentNode.insertBefore(newBtn, reportCard.nextSibling);
        }
        newBtn.style.display = 'block';

        // Scroll to form
        document.querySelector('.report-card').scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Filter timeline to this specific report
        renderAuditTimeline(reportId);

        // Re-render tickets to highlight selected
        renderTickets();
    };

    // ── Clear Selection (back to new report mode) ────────────
    window._clearSelection = function () {
        selectedReportId = null;

        const form = document.getElementById('wastageReportForm');
        const header = document.querySelector('.report-card-header h2');
        const headerDesc = document.querySelector('.report-card-header p');
        const submitBtn = document.querySelector('.btn-submit');

        // Re-enable form
        form.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(el => {
            el.removeAttribute('disabled');
        });

        // Reset form
        form.reset();
        document.getElementById('userEmail').value = user.email;
        updateDynamicFields('');
        document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('selected-low', 'selected-medium', 'selected-high'));
        document.querySelector('[data-priority="Low"]').classList.add('selected-low');
        priorityInput.value = 'Low';

        if (header) header.textContent = 'New Wastage Report';
        if (headerDesc) headerDesc.textContent = 'Our Sustainability Officers will directly analyze and resolve this issue.';
        if (submitBtn) submitBtn.style.display = 'flex';

        const newBtn = document.getElementById('newReportBtn');
        if (newBtn) newBtn.style.display = 'none';

        renderAuditTimeline();
        renderTickets();
    };

    // ── Archive Report ───────────────────────────────────────
    window._archiveReport = function (reportId) {
        // Always read fresh from localStorage to avoid stale cache
        const raw = localStorage.getItem('enertrack_universal_v1');
        if (!raw) return;
        const universalData = JSON.parse(raw);
        const reports = universalData?.workflow?.wastageReports || [];
        const report = reports.find(r => r.id === reportId);
        if (!report) return;

        report.archived = true;
        report.archivedAt = new Date().toISOString();

        localStorage.setItem('enertrack_universal_v1', JSON.stringify(universalData));


        // If this was the selected report, clear selection
        if (selectedReportId === reportId) {
            selectedReportId = null;
            const form = document.getElementById('wastageReportForm');
            const header = document.querySelector('.report-card-header h2');
            const headerDesc = document.querySelector('.report-card-header p');
            const submitBtn = document.querySelector('.btn-submit');

            form.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(el => {
                el.removeAttribute('disabled');
            });
            form.reset();
            document.getElementById('userEmail').value = user.email;
            updateDynamicFields('');
            document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('selected-low', 'selected-medium', 'selected-high'));
            document.querySelector('[data-priority="Low"]').classList.add('selected-low');
            priorityInput.value = 'Low';

            if (header) header.textContent = 'New Wastage Report';
            if (headerDesc) headerDesc.textContent = 'Our Sustainability Officers will directly analyze and resolve this issue.';
            if (submitBtn) submitBtn.style.display = 'flex';
            const newBtn = document.getElementById('newReportBtn');
            if (newBtn) newBtn.style.display = 'none';
        }

        renderTickets();
        renderAuditTimeline();
        showToast();
    };

    // ── Toast ────────────────────────────────────────────────
    function showToast() {
        const toast = document.getElementById('euToast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3500);
    }

    renderTickets();
    renderAuditTimeline();
});
