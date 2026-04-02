/**
 * mockData.js
 * In-memory state synchronized with sessionStorage for the Sustainability Officer dashboard.
 */

const STORAGE_KEY = "et_sust_db_v1";

const defaultData = {
  metrics: {
    energyConsumed: "4.9", // GWh
    waterUsage: "18.6", // ML
    emissions: "1,284", // tCO₂e
    reportingSites: "9 / 10",
    alertsResolved: 14,
    reductionProgress: 76,
    nextReviewDays: 6,
  },
  initiatives: [
    {
      id: "init_1",
      title: "HVAC After-Hours Automation",
      status: "proposed",
      feasible: true,
      target: "7.5%",
      cost: "$56,500",
      timeline: "5 weeks",
      description: "Automate HVAC for night shifts."
    },
    {
      id: "init_2",
      title: "Solar Carport Phase 1",
      status: "proposed",
      feasible: false,
      target: "14%",
      cost: "$198,000",
      timeline: "16 weeks",
      description: "Cover parking lot A with solar panels."
    },
    {
      id: "init_3",
      title: "LED Lighting Retrofit",
      status: "in-progress",
      feasible: true,
      target: "12%",
      cost: "$64,000",
      timeline: "8 weeks",
      description: "Replace fluorescent lights in two buildings."
    },
    {
      id: "init_4",
      title: "Chiller Optimization Tuning",
      status: "in-progress",
      feasible: true,
      target: "6.1%",
      cost: "$19,400",
      timeline: "6 weeks",
      description: "Optimize base load cooling."
    },
    {
      id: "init_5",
      title: "Boiler Insulation Upgrade",
      status: "approved",
      feasible: true,
      target: "5%",
      cost: "$31,200",
      timeline: "3 weeks",
      description: "Enhance insulation for primary heating."
    },
    {
      id: "init_6",
      title: "Compressed Air Leak Program",
      status: "approved",
      feasible: true,
      target: "4.4%",
      cost: "$9,700",
      timeline: "4 weeks",
      description: "Identify and seal factory leaks."
    },
    {
      id: "init_7",
      title: "Server Room Cooling Reset",
      status: "completed",
      feasible: true,
      outcomes: ["16 MWh saved", "41 tCO₂e reduced", "$14,400 saved"],
      description: "Raise server temps dynamically."
    },
    {
      id: "init_8",
      title: "Kitchen Equipment Shutdown Policy",
      status: "completed",
      feasible: true,
      outcomes: ["28 MWh saved", "82 tCO₂e reduced", "$6,700 saved"],
      description: "Ensure idle ovens are disabled."
    }
  ],
  monitoring: {
    lastSync: "Today, 10:42 AM",
    energyTrend: [60, 75, 68, 65],
    waterTrend: [48, 52, 45, 48],
    emissionsTrend: [55, 60, 50, 52],
    history: {
        "30 Days": { 
            e:[60, 75, 68, 65], w:[48, 52, 45, 48], m:[55, 60, 50, 52],
            labels: ["Week 1", "Week 2", "Week 3", "Week 4"]
        },
        "Quarter": { 
            e:[280, 310, 295], w:[12, 14, 11], m:[84, 92, 78],
            labels: ["Month 1", "Month 2", "Month 3"]
        },
        "Year": { 
            e:[1200, 1150, 1300, 1250], w:[45, 42, 48, 44], m:[320, 310, 340, 330],
            labels: ["Q1", "Q2", "Q3", "Q4"]
        }
    }
  }
};

// Singleton wrapper to manage sync
class SustDB {
  constructor() {
    this.data = this._loadData();
  }

  _loadData() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Deep merge or at least ensure new top-level keys like 'monitoring' exist
        return { ...JSON.parse(JSON.stringify(defaultData)), ...parsed };
      }
    } catch (e) {
      console.error("Failed to load DB", e);
    }
    return JSON.parse(JSON.stringify(defaultData));
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  // Helpers
  get metrics() { return this.data.metrics; }
  get initiatives() { return this.data.initiatives; }
  get monitoring() { return this.data.monitoring; }
  
  addInitiative(init) {
    this.data.initiatives.push(init);
    this.save();
  }
  
  updateInitiative(id, changes) {
    const idx = this.data.initiatives.findIndex(i => i.id === id);
    if (idx !== -1) {
      this.data.initiatives[idx] = { ...this.data.initiatives[idx], ...changes };
      this.save();
    }
  }

  deleteInitiative(id) {
    this.data.initiatives = this.data.initiatives.filter(i => i.id !== id);
    this.save();
  }

  reset() {
    this.data = JSON.parse(JSON.stringify(defaultData));
    this.save();
  }
}

const db = new SustDB();
export default db;
