/**
 * wastageHelpers.js — fixed data and small helpers for the Report Wastage
 * page (/campus/wastage). Plain JavaScript, no React: the components import
 * what they need from here, so each component stays short.
 *
 * Taken from js/enduser/wastage.js and html/enduser/enduser_wastage.html.
 */

// The four categories in the dropdown
export const WASTAGE_TYPES = [
  { value: "Energy", label: "Energy Wastage" },
  { value: "Water", label: "Water Wastage" },
  { value: "Emissions", label: "Emissions Issue" },
  { value: "Food", label: "Food Wastage" },
];

// The text fields each category asks for. `name` is the key the value is
// saved under in the report's specificData, exactly as the original did.
export const TYPE_FIELDS = {
  Energy: [
    { name: "building", label: "Building", placeholder: "e.g., Block B" },
    {
      name: "area",
      label: "Area / Room Category",
      placeholder: "e.g., 2nd Floor Corridor",
    },
    {
      name: "observation",
      label: "Observation",
      placeholder: "e.g., Lights left on all night continuously...",
      textarea: true,
    },
  ],
  Water: [
    {
      name: "location",
      label: "Location",
      placeholder: "e.g., Cafeteria Kitchen",
    },
    {
      name: "nature",
      label: "Nature of Wastage",
      placeholder: "e.g., Faucet leaking large amounts...",
      textarea: true,
    },
  ],
  Emissions: [
    {
      name: "source",
      label: "Source",
      placeholder: "e.g., Boiler, Backup Generator, Vehicle",
    },
    {
      name: "location",
      label: "Location",
      placeholder: "e.g., Central Heating Plant",
    },
    {
      name: "observation",
      label: "Observation",
      placeholder: "e.g., Thick black smoke observed...",
      textarea: true,
    },
  ],
  Food: [
    {
      name: "cafeteria",
      label: "Cafeteria / Dining Area",
      placeholder: "e.g., Main Student Dining Block",
    },
    {
      name: "typeOfWastage",
      label: "Type of Wastage",
      placeholder: "e.g., Leftover cooked meals, expired raw items",
    },
  ],
};

// The number field at the end of each category's fields
export const ESTIMATE_FIELDS = {
  Energy: { label: "Estimated Wastage Value (kWh)", placeholder: "e.g., 120" },
  Water: { label: "Estimated Wastage Value (L)", placeholder: "e.g., 650" },
  Emissions: {
    label: "Estimated Excess Emissions (kg CO2e)",
    placeholder: "e.g., 45",
  },
  Food: { label: "Estimated Amount (kg)", placeholder: "e.g., 20" },
};

// Each status: pill label + colour class, which timeline step it has
// reached, and the hint shown under the pill
export const STATUS_MAP = {
  Reported: {
    label: "Reported",
    cssClass: "status-reported",
    step: 2,
    hint: "Your report was submitted and sensor data attached. Awaiting officer review.",
  },
  Validated: {
    label: "Validated",
    cssClass: "status-validated",
    step: 3,
    hint: "The Sustainability Officer has confirmed this as a genuine issue.",
  },
  "Forwarded to Finance": {
    label: "Under Finance Review",
    cssClass: "status-finance",
    step: 4,
    hint: "Forwarded to the Finance Analyst for cost-impact assessment.",
  },
  "Cost Impact Added": {
    label: "Under Finance Review",
    cssClass: "status-finance",
    step: 4,
    hint: "Finance is finalizing cost-impact figures for this report.",
  },
  "Returned to SO": {
    label: "Cost Assessed",
    cssClass: "status-cost-assessed",
    step: 4,
    hint: "Finance has added cost data. The officer is preparing the final decision.",
  },
  Finalized: {
    label: "Resolved",
    cssClass: "status-finalized",
    step: 5,
    hint: "The report has been fully resolved and archived.",
  },
  "Target Set": {
    label: "Target Set",
    cssClass: "status-target-set",
    step: 5,
    hint: "A new sustainability target was set based on your report.",
  },
  Delivered: {
    label: "Report Delivered",
    cssClass: "status-finalized",
    step: 6,
    hint: "Detailed findings report has been delivered. Check your wastage logs for the full breakdown.",
  },
  Dismissed: {
    label: "Dismissed",
    cssClass: "status-dismissed",
    step: 3,
    hint: "The officer dismissed this report as not actionable.",
  },
};

// Status info for any status, with a safe default for unknown ones
export function getStatusInfo(status) {
  return (
    STATUS_MAP[status] || {
      label: status,
      cssClass: "status-reported",
      step: 2,
      hint: "Processing your report.",
    }
  );
}

// The six steps of the "Sustainability Audit Flow" timeline
export const TIMELINE_STEPS = [
  {
    num: 1,
    label: "Observation Logging",
    desc: "You observe and document exactly where waste is happening.",
  },
  {
    num: 2,
    label: "System Cross-Check",
    desc: "We correlate your report with real-time IoT campus sensor data.",
  },
  {
    num: 3,
    label: "Officer Audit",
    desc: "Our Sustainability Officer validates and compiles the footprint report.",
  },
  {
    num: 4,
    label: "Finance Review",
    desc: "Analysts assign ROI impacts to justify process change.",
  },
  {
    num: 5,
    label: "Target Adjusted",
    desc: "Policy and process changes are finalized to prevent future waste.",
  },
  {
    num: 6,
    label: "Report Delivered",
    desc: "Detailed findings report sent back to you. Check My Wastage Logs.",
  },
];

// Each category keeps its text in different fields; pick the right two
// for a card: the summary line and the location chip.
export function getSummaryAndLocation(report) {
  const data = report.specificData || {};

  if (report.type === "Energy") {
    return { summary: data.observation, location: data.building };
  }
  if (report.type === "Water") {
    return { summary: data.nature, location: data.location };
  }
  if (report.type === "Emissions") {
    return { summary: data.observation, location: data.location };
  }
  if (report.type === "Food") {
    return {
      summary: `${data.typeOfWastage || ""} (${data.estimatedAmount || "?"}kg)`,
      location: data.cafeteria,
    };
  }
  return { summary: "", location: "" };
}

// The location of a report in lower case. Used to spot a duplicate report
// (same category, same place) and saved on the backend report.
export function getLocationKey(type, data) {
  if (type === "Energy") return (data.building || "").toLowerCase();
  if (type === "Food") return (data.cafeteria || "").toLowerCase();
  return (data.location || "").toLowerCase(); // Water, Emissions
}

// 12000 -> "₹12,000"
export function formatCurrency(value) {
  return "₹" + Number(value).toLocaleString("en-IN");
}

// "2026-05-01T..." -> "1 May 2026"
export function formatDate(value) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
