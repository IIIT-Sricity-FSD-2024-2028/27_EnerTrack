/**
 * reportingPage.js
 * Handles session logic, report generation pipeline, and custom date range.
 * Reports are archived to the NestJS backend via /api/sustainability-reports.
 */
import SustDB from "./data/mockData.js";
import SessionModule from "./modules/session.js";
import { showToast } from "./utils/utils.js";
import { injectIcons } from "./utils/icons.js";

const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");

function REPORT_PIPELINE_KEY() {
  try {
    const u = JSON.parse(localStorage.getItem("currentUser") || "{}");
    return "et_sust_report_pipeline_" + (u.email || "default");
  } catch (_) {
    return "et_sust_report_pipeline_default";
  }
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
  const reportTypePills = document.getElementById("reportTypePills");
  const groups = {
    year: document.getElementById("groupYear"),
    quarter: document.getElementById("groupQuarter"),
    month: document.getElementById("groupMonth"),
    customFrom: document.getElementById("groupCustomFrom"),
    customTo: document.getElementById("groupCustomTo"),
  };

  function updateFormGroups(type) {
    Object.values(groups).forEach((g) => {
      if (g) g.style.display = "none";
    });

    if (type === "yearly") {
      if (groups.year) groups.year.style.display = "block";
    } else if (type === "quarterly") {
      if (groups.year) groups.year.style.display = "block";
      if (groups.quarter) groups.quarter.style.display = "block";
    } else if (type === "monthly") {
      if (groups.year) groups.year.style.display = "block";
      if (groups.month) groups.month.style.display = "block";
    } else if (type === "custom") {
      if (groups.customFrom) groups.customFrom.style.display = "block";
      if (groups.customTo) groups.customTo.style.display = "block";
    }
  }

  if (reportTypePills) {
    reportTypePills.querySelectorAll(".type-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        reportTypePills
          .querySelectorAll(".type-pill")
          .forEach((btn) => btn.classList.remove("active"));
        pill.classList.add("active");
        updateFormGroups(pill.dataset.reportType);
      });
    });
  }

  // Initialize groups (Yearly is default active)
  updateFormGroups("yearly");

  // Custom dropdown selections (Year/Quarter/Month selects)
  document.querySelectorAll("[data-select]").forEach((selectWrap) => {
    const trigger = selectWrap.querySelector(".select-trigger");
    const valueEl = trigger.querySelector(".select-value");
    const options = selectWrap.querySelectorAll(".select-option");

    if (!trigger) return;

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      document.querySelectorAll("[data-select].open").forEach((openSelect) => {
        if (openSelect !== selectWrap) {
          openSelect.classList.remove("open");
          openSelect
            .querySelector(".select-trigger")
            .setAttribute("aria-expanded", "false");
        }
      });
      selectWrap.classList.toggle("open");
      trigger.setAttribute(
        "aria-expanded",
        selectWrap.classList.contains("open") ? "true" : "false",
      );
    });

    options.forEach((option) => {
      option.addEventListener("click", () => {
        options.forEach((btn) => btn.classList.remove("selected"));
        option.classList.add("selected");
        valueEl.textContent = option.dataset.value;
        selectWrap.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
      });
    });
  });

  document.addEventListener("click", () => {
    document.querySelectorAll("[data-select].open").forEach((openSelect) => {
      openSelect.classList.remove("open");
      openSelect
        .querySelector(".select-trigger")
        .setAttribute("aria-expanded", "false");
    });
  });
}

/* ── Pipeline Persistence ──────────────────────────── */

function saveReportPipelineState(state) {
  localStorage.setItem(REPORT_PIPELINE_KEY(), state);
}

function restoreReportPipelineState() {
  const state = localStorage.getItem(REPORT_PIPELINE_KEY());
  if (state === "completed") {
    const steps = document.querySelectorAll(".pipeline-step");
    const circles = document.querySelectorAll(".pipeline-circle");
    const fillLine = document.querySelector(".pipeline-line-fill");

    steps.forEach((s) => s.classList.add("active"));
    circles.forEach((c) => c.classList.add("active"));
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
    const type =
      document.querySelector(".type-pill.active")?.dataset.reportType ||
      "Monthly";
    const year =
      document.getElementById("yearSelect")?.querySelector(".select-value")
        .textContent || "2026";
    const quarter =
      document.getElementById("quarterSelect")?.querySelector(".select-value")
        .textContent || "Q3";
    const month =
      document.getElementById("monthSelect")?.querySelector(".select-value")
        .textContent || "September";

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
        const fmt = (d) =>
          new Date(d).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
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
    steps.forEach((s) => s.classList.remove("active"));
    circles.forEach((c) => c.classList.remove("active"));
    if (fillLine) fillLine.style.width = "0%";

    // Sequential animation: step 0 first, then 1, 2, 3, 4...
    let currentStep = 0;

    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        steps[currentStep].classList.add("active");
        circles[currentStep].classList.add("active");
        if (fillLine) {
          fillLine.style.width = (currentStep / (steps.length - 1)) * 100 + "%";
        }
        currentStep++;
      } else {
        clearInterval(interval);

        if (fillLine) fillLine.style.width = "100%";

        btn.textContent = "Report Generated!";
        btn.style.background = "#10b981";

        // Persist completed state
        saveReportPipelineState("completed");

        // Add to Global Highlights
        SustDB.addHighlight(
          "Report Generated",
          `Period: ${reportPeriod}. ${reportTitle}`,
          "green",
        );

        showToast("Report compiled successfully.", "success", 2000);

        // Create a simple deterministic hash from the report period string
        let hash = 0;
        for (let i = 0; i < reportPeriod.length; i++) {
          hash = reportPeriod.charCodeAt(i) + ((hash << 5) - hash);
        }
        // Use hash to add deterministic variation
        const var1 = (Math.abs(hash) % 15) + 1; // 1 to 15
        const var2 = (Math.abs(hash >> 2) % 20) + 1; // 1 to 20
        
        let multiplier = 1;
        if (type === "yearly") multiplier = 12;
        else if (type === "quarterly") multiplier = 3;
        else if (type === "monthly") multiplier = 1;
        else multiplier = 2;

        const baseEnergyReduction = SustDB.metrics?.reductionProgress ? parseInt(String(SustDB.metrics.reductionProgress).replace(/,/g, '')) : 4;
        const baseWasteDiverted = SustDB.metrics?.wasteDiverted ? parseInt(String(SustDB.metrics.wasteDiverted).replace(/,/g, '')) : 68;
        const baseCarbonOffset = SustDB.metrics?.emissions ? parseInt(String(SustDB.metrics.emissions).replace(/,/g, '')) * 0.15 : 124;
        const baseWaterSaved = SustDB.metrics?.waterUsage ? parseFloat(String(SustDB.metrics.waterUsage).replace(/,/g, '')) * 0.1 : 1.2;

        const generatedMetrics = {
          energyReduction: `-${Math.max(1, baseEnergyReduction - 2 + (var1 % 5))}%`,
          wasteDiverted: `${Math.min(100, Math.max(50, baseWasteDiverted - 5 + (var2 % 10)))}%`,
          carbonOffset: `${Math.round(baseCarbonOffset * multiplier * (1 + (var1 / 100)))} tCO₂e`,
          waterSaved: `${(baseWaterSaved * multiplier * (1 + (var2 / 100))).toFixed(1)} ML`
        };

        setTimeout(() => {
          showReportModal(reportTitle, reportPeriod, generatedMetrics);

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

function showReportModal(title, period, metrics) {
  import("./utils/utils.js").then((utils) => {
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
                            <div class="val">${metrics.energyReduction}</div>
                        </div>
                        <div class="report-stat-card">
                            <h4>Waste Diverted</h4>
                            <div class="val">${metrics.wasteDiverted}</div>
                        </div>
                        <div class="report-stat-card">
                            <h4>Carbon Offset</h4>
                            <div class="val">${metrics.carbonOffset}</div>
                        </div>
                        <div class="report-stat-card">
                            <h4>Water Saved</h4>
                            <div class="val">${metrics.waterSaved}</div>
                        </div>
                    </div>
                </div>
            `,
      confirmLabel: "Close and Archive Report",
      cancelLabel: "",
      onConfirm: async () => {
        await archiveReport(title, period, metrics);
        resetReportingPipeline();
      },
    });
  });
}

async function archiveReport(title, period, metrics) {
  const payload = {
    generated_by_id:
      currentUser.user_id || "uuuu0000-0005-4000-8000-000000000000",
    title: title || "Sustainability Report",
    period: period,
    metrics: {
      energyReduction: metrics.energyReduction,
      wasteDiverted: metrics.wasteDiverted,
      carbonOffset: metrics.carbonOffset,
      waterSaved: metrics.waterSaved,
    },
    generated_at: new Date().toISOString(),
  };

  try {
    if (window.api) {
      const res = await window.api.post("/sustainability-reports", payload);
      if (res && res.report_id) {
        console.log(
          "[SO Reporting] Report archived to backend:",
          res.report_id,
        );
        showToast("Report archived to backend successfully.", "success");
        return;
      } else {
        console.warn("[SO Reporting] Backend error:", res);
      }
    }
  } catch (err) {
    console.warn(
      "[SO Reporting] Backend unavailable, saving locally:",
      err.message,
    );
  }

  // Fallback: save to localStorage
  try {
    const raw = localStorage.getItem("enertrack_universal_v1");
    const fullData = raw ? JSON.parse(raw) : {};
    if (fullData.sust) {
      if (!Array.isArray(fullData.sust.reportArchives))
        fullData.sust.reportArchives = [];
      fullData.sust.reportArchives.unshift({
        id: "RPT-" + Date.now().toString(36).toUpperCase(),
        title: title || "Sustainability Report",
        period: period,
        ...metrics,
        archivedAt: new Date().toISOString(),
      });
      localStorage.setItem("enertrack_universal_v1", JSON.stringify(fullData));
    }
  } catch (e) {
    console.error("Failed to archive report locally:", e);
  }

  showToast("Report archived successfully.", "success");
}

function resetReportingPipeline() {
  saveReportPipelineState("initial");

  // Reset visual pipeline explicitly
  const steps = document.querySelectorAll(".pipeline-step");
  const circles = document.querySelectorAll(".pipeline-circle");
  const fillLine = document.querySelector(".pipeline-line-fill");
  const btn = document.querySelector(".btn-block-dark");

  steps.forEach((s) => s.classList.remove("active"));
  circles.forEach((c) => c.classList.remove("active"));
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
