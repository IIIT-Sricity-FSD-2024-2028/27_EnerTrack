import universalDB from '../../shared/universalDB.js';
import { generateSensorData, getMetricUnit, getMetricCategory } from '../../shared/sensorSimulator.js';

document.addEventListener('DOMContentLoaded', () => {
    // ── Auth Check ──────────────────────────────────────────
    const stored = localStorage.getItem('currentUser');
    if (!stored) {
        window.location.href = '../sign_in/sign_in.html';
        return;
    }
    const user = JSON.parse(stored);

    document.getElementById('sidebarUserName').textContent = user.name;
    document.getElementById('sidebarUserRole').textContent = user.role;
    document.getElementById('welcomeHeading').textContent = `Welcome, ${user.name}`;

    // ── Pre-fill Email ───────────────────────────────────────
    document.getElementById('userEmail').value = user.email;

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
        } else if (issueType === 'Water') {
            specificData.location = document.getElementById('waterLocation').value.trim();
            specificData.nature = document.getElementById('waterNature').value.trim();
        } else if (issueType === 'Emissions') {
            specificData.source = document.getElementById('emissionsSource').value.trim();
            specificData.location = document.getElementById('emissionsLocation').value.trim();
            specificData.observation = document.getElementById('emissionsObservation').value.trim();
        } else if (issueType === 'Food') {
            specificData.cafeteria = document.getElementById('foodCafeteria').value.trim();
            specificData.typeOfWastage = document.getElementById('foodType').value.trim();
            specificData.estimatedAmount = document.getElementById('foodAmount').value.trim();
        }

        // ── System Actor (Steps 4-5): Enrich with sensor data ──
        const systemData = generateSensorData(issueType, specificData);
        const metricUnit = getMetricUnit(issueType);
        const metricCategory = getMetricCategory(issueType);

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

        if (!universalDB.data.workflow.wastageReports) {
            universalDB.data.workflow.wastageReports = [];
        }

        universalDB.data.workflow.wastageReports.push(report);
        universalDB.save();

        // Reset
        document.getElementById('wastageReportForm').reset();
        document.getElementById('userEmail').value = user.email; // restore email to readonly after reset
        updateDynamicFields('');
        sessionStorage.removeItem(formStateKey);
        
        document.querySelectorAll('.priority-btn').forEach(b => b.classList.remove('selected-low', 'selected-medium', 'selected-high'));
        document.querySelector('[data-priority="Low"]').classList.add('selected-low');
        priorityInput.value = 'Low';

        showToast();
        renderTickets();
    });

    // ── Render Tickets ───────────────────────────────────────
    function renderTickets() {
        const container = document.getElementById('userWastageContainer');
        const countBadge = document.getElementById('myReportsCount');

        const myReports = (universalDB.data.workflow.wastageReports || [])
            .filter(wr => wr.reporterEmail === user.email)
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
            let statusClass = 'status-reported';
            let statusLabel = t.status;

            let summaryText = "";
            let locationText = "";
            if (t.type === 'Energy') { summaryText = t.specificData.observation; locationText = t.specificData.building; }
            else if (t.type === 'Water') { summaryText = t.specificData.nature; locationText = t.specificData.location; }
            else if (t.type === 'Emissions') { summaryText = t.specificData.observation; locationText = t.specificData.location; }
            else if (t.type === 'Food') { summaryText = t.specificData.typeOfWastage + " (" + t.specificData.estimatedAmount + "kg)"; locationText = t.specificData.cafeteria; }

            const pClass = `p-${t.priority || 'Low'}`;
            const typeTag = `<span style="background:#059669;color:white;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:8px;">${t.type} Wastage</span>`;

            return `
              <div class="ticket-card">
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
                <div class="ticket-status ${statusClass}">${statusLabel}</div>
              </div>`;
        }).join('');
    }

    // ── Toast ────────────────────────────────────────────────
    function showToast() {
        const toast = document.getElementById('euToast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3500);
    }

    renderTickets();
});
