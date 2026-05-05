import universalDB from "../shared/universalDB.js";

document.addEventListener("DOMContentLoaded", () => {
  // ── Auth Check ──────────────────────────────────────────
  const stored = localStorage.getItem("currentUser");
  if (!stored) {
    window.location.href = "../sign_in/sign_in.html";
    return;
  }
  const user = JSON.parse(stored);

  document.getElementById("sidebarUserName").textContent = user.name;
  document.getElementById("sidebarUserRole").textContent = user.role;
  document.getElementById("welcomeHeading").textContent =
    `Welcome, ${user.name}`;

  // ── Pre-fill Email ───────────────────────────────────────
  document.getElementById("userEmail").value = user.email;

  // ── Form State Persistence ───────────────────────────────
  const formStateKey = "dashboardFormState";

  function saveFormState() {
    const state = {
      priority: document.getElementById("issuePriority").value,
    };
    document
      .querySelectorAll(
        '#issueReportForm input:not([type="hidden"]), #issueReportForm textarea, #issueReportForm select',
      )
      .forEach((el) => {
        if (el.id !== "userEmail") state[el.id] = el.value;
      });
    sessionStorage.setItem(formStateKey, JSON.stringify(state));
  }

  // ── Priority Selector ────────────────────────────────────
  const priorityInput = document.getElementById("issuePriority");
  document.querySelectorAll(".priority-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".priority-btn").forEach((b) => {
        b.classList.remove("selected-low", "selected-medium", "selected-high");
      });
      const p = btn.dataset.priority;
      btn.classList.add(`selected-${p.toLowerCase()}`);
      priorityInput.value = p;
      saveFormState();
    });
  });

  // ── Global Change Listener for Saving State ──────────────
  document.getElementById("issueReportForm").addEventListener("input", (e) => {
    if (e.target.id !== "userEmail") {
      saveFormState();
      e.target.classList.remove("error-highlight");
    }
  });

  // ── Load Persisted State ─────────────────────────────────
  function loadPersistedState() {
    const savedStateStr = sessionStorage.getItem(formStateKey);
    if (savedStateStr) {
      const state = JSON.parse(savedStateStr);
      if (state.priority) {
        priorityInput.value = state.priority;
        document.querySelectorAll(".priority-btn").forEach((b) => {
          b.classList.remove(
            "selected-low",
            "selected-medium",
            "selected-high",
          );
          if (b.dataset.priority === state.priority) {
            b.classList.add(`selected-${state.priority.toLowerCase()}`);
          }
        });
      }
      Object.keys(state).forEach((id) => {
        const el = document.getElementById(id);
        if (el && id !== "priority") {
          el.value = state[id];
        }
      });
    }
  }

  loadPersistedState();

  // ── Form Submit ──────────────────────────────────────────
  document
    .getElementById("issueReportForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      // Strict Validation
      let isValid = true;
      const formElements = document.querySelectorAll(
        "#issueReportForm input, #issueReportForm textarea, #issueReportForm select",
      );
      formElements.forEach((el) => {
        if (el.required && !el.value.trim() && el.offsetParent !== null) {
          el.classList.add("error-highlight");
          isValid = false;
        } else {
          el.classList.remove("error-highlight");
        }
      });

      if (!isValid) return;

      const location = document.getElementById("issueLocation").value.trim();
      const description = document
        .getElementById("issueDescription")
        .value.trim();
      const issueType = document.getElementById("issueType").value;
      const priority = priorityInput.value || "Medium";

      // POST to backend
      try {
        if (window.api) {
          const payload = {
            reporter_id: user.user_id || "550e8400-0006-4000-8000-000000000006",
            category: "General",
            issue_type: issueType || "General",
            description: `[${issueType || "General"}] ${description} — Location: ${location}`,
            priority: priority.toLowerCase(),
            status: "open",
          };
          const woData = await window.api.post("/service-requests", payload);
          if (woData && !woData.error) {
            console.log(
              "[EndUser] Service request created in backend:",
              woData.service_request_id,
            );
            // Clear form
            document.getElementById("issueReportForm").reset();
            document.getElementById("userEmail").value = user.email;
            sessionStorage.removeItem(formStateKey);
            document
              .querySelectorAll(".priority-btn")
              .forEach((b) =>
                b.classList.remove(
                  "selected-low",
                  "selected-medium",
                  "selected-high",
                ),
              );
            document
              .querySelector('[data-priority="Medium"]')
              .classList.add("selected-medium");
            priorityInput.value = "Medium";
            showToast();
            await renderTickets();
            return; // Skip local DB if backend succeeded
          } else {
            console.warn("[EndUser] Backend returned error:", woData);
          }
        }
      } catch (err) {
        console.warn(
          "[EndUser] Could not reach backend, saving locally only:",
          err.message,
        );
      }

      // Also save locally for rendering (legacy flow preserved)
      const ticket = {
        id: "SR-" + Date.now().toString(36).toUpperCase(),
        source: "User-Reported",
        reporterName: user.name,
        reporterEmail: user.email,
        location,
        description,
        issueType: issueType || "General Maintenance",
        priority,
        status: "Reported",
        category: null,
        assignedTo: null,
        costProposal: null,
        timestamp: new Date().toISOString(),
      };

      universalDB.data.workflow.serviceRequests.push(ticket);
      universalDB.save();

      document.getElementById("issueReportForm").reset();
      document.getElementById("userEmail").value = user.email;

      sessionStorage.removeItem(formStateKey);

      // Reset priority selection back to Medium
      document
        .querySelectorAll(".priority-btn")
        .forEach((b) =>
          b.classList.remove(
            "selected-low",
            "selected-medium",
            "selected-high",
          ),
        );
      document
        .querySelector('[data-priority="Medium"]')
        .classList.add("selected-medium");
      priorityInput.value = "Medium";

      showToast();
      renderTickets();
    });

  // ── Render Tickets ───────────────────────────────────────
  async function renderTickets() {
    const container = document.getElementById("userTicketsContainer");
    const countBadge = document.getElementById("myReportsCount");

    function deriveStatusMeta(statusValue) {
      var status = String(statusValue || "open").toLowerCase();
      if (status === "closed" || status === "resolved" || status === "completed") {
        return { cssClass: "status-closed", label: "Completed" };
      }
      if (status === "in_progress" || status === "inprogress" || status === "approval" || status === "review" || status === "new") {
        return { cssClass: "status-progress", label: "In Progress" };
      }
      if (status === "pending" || status === "pending_category") {
        return { cssClass: "status-forwarded", label: "Under Review" };
      }
      if (status === "dispatched") {
        return { cssClass: "status-dispatched", label: "Dispatched" };
      }
      return { cssClass: "status-reported", label: "Reported" };
    }

    let myTickets = [];
    try {
      if (window.api) {
        var results = await Promise.all([
          window.api.get("/service-requests"),
          window.api.get("/work-orders"),
        ]);
        var srs = results[0];
        var wos = Array.isArray(results[1]) ? results[1] : [];

        if (Array.isArray(srs)) {
          myTickets = srs
            .filter((sr) => sr.reporter_id === user.user_id)
            .map((sr, i) => {
              var relatedWOs = wos.filter(
                (wo) => wo.source_request_id === sr.service_request_id,
              );
              var hasClosedWO = relatedWOs.some((wo) => wo.status === "closed");
              var hasActiveWO = relatedWOs.some((wo) =>
                ["new", "approval", "inprogress", "review"].includes(wo.status),
              );
              var effectiveStatus = sr.status || "open";
              if (hasClosedWO) effectiveStatus = "closed";
              else if (hasActiveWO && effectiveStatus === "open")
                effectiveStatus = "in_progress";

              let offset = sr.service_request_id
                ? (sr.service_request_id.charCodeAt(5) || 0) * 3600000
                : i * 86400000;
              const fallbackDate = new Date(
                1777521600000 - offset,
              ).toISOString(); // May 2026

              return {
                id: sr.service_request_id,
                description: sr.description,
                location: "Campus", // Simplified mapping
                priority: sr.priority
                  ? sr.priority.charAt(0).toUpperCase() + sr.priority.slice(1)
                  : "Medium",
                status: effectiveStatus,
                timestamp: sr.created_at || fallbackDate,
                issueType: "",
              };
            })
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }
      }
    } catch (err) {
      console.warn(
        "[EndUser] Backend fetch failed, using local data",
        err.message,
      );
    }

    // Fallback to local
    if (myTickets.length === 0) {
      myTickets = universalDB.data.workflow.serviceRequests
        .filter((sr) => sr.reporterEmail === user.email)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    countBadge.textContent = myTickets.length;

    if (myTickets.length === 0) {
      container.innerHTML = `
              <div class="empty-state">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                <p>You haven't submitted any reports yet.</p>
              </div>`;
      return;
    }

    container.innerHTML = myTickets
      .map((t) => {
        var statusMeta = deriveStatusMeta(t.status);
        let statusClass = statusMeta.cssClass;
        let statusLabel = statusMeta.label;

        const pClass = `p-${t.priority || "Medium"}`;
        const typeTag = t.issueType
          ? `<span style="background:#f3f4f6;color:#374151;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:8px;">${t.issueType}</span>`
          : "";

        return `
              <div class="ticket-card">
                <div style="flex:1;min-width:0;">
                  <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:4px;">
                    <strong style="font-size:14px;color:var(--dark);">#${t.id}</strong>
                    ${typeTag}
                  </div>
                  <p style="font-size:13px;color:#374151;margin:0 0 6px 0;line-height:1.5;">${t.description}</p>
                  <div class="ticket-location">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${t.location}
                  </div>
                  <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
                    <span class="ticket-priority ${pClass}">${t.priority || "Medium"} Priority</span>
                    <span class="ticket-meta">${new Date(t.timestamp).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                </div>
                <div class="ticket-status ${statusClass}">${statusLabel}</div>
              </div>`;
      })
      .join("");
  }

  // ── Toast ────────────────────────────────────────────────
  function showToast() {
    const toast = document.getElementById("euToast");
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3500);
  }

  renderTickets();
});
