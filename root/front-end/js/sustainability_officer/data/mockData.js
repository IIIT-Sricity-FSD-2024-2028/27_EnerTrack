/**
 * mockData.js (Sustainability Officer Adapter)
 * Redirects sust data access to the Universal DB.
 */
import universalDB from '../../shared/universalDB.js';

class SustDB {
  get metrics() { return universalDB.data.sust.metrics; }
  get initiatives() { return universalDB.data.sust.initiatives; }
  get monitoring() { return universalDB.data.sust.monitoring; }
  get highlights() { return universalDB.data.sust.highlights; }
  get alertsList() { return universalDB.data.sust.alertsList; }
  get wastageReports() {
    // Read fresh from localStorage every time to catch cross-page writes
    try {
      const raw = localStorage.getItem('enertrack_universal_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        const reports = parsed?.workflow?.wastageReports;
        if (Array.isArray(reports)) {
          // Sync in-memory copy too
          universalDB.data.workflow.wastageReports = reports;
          return reports;
        }
      }
    } catch (e) { /* fallback below */ }
    return universalDB.data.workflow.wastageReports || [];
  }

  set metrics(val) { universalDB.data.sust.metrics = val; universalDB.save(); }
  set initiatives(val) { universalDB.data.sust.initiatives = val; universalDB.save(); }
  set monitoring(val) { universalDB.data.sust.monitoring = val; universalDB.save(); }
  set highlights(val) { universalDB.data.sust.highlights = val; universalDB.save(); }
  set alertsList(val) { universalDB.data.sust.alertsList = val; universalDB.save(); }

  updateWastageReport(reportId, changes) {
    // Re-read fresh from localStorage before mutating
    const freshReports = this.wastageReports;
    const idx = freshReports.findIndex(r => r.id === reportId);
    if (idx !== -1) {
      universalDB.data.workflow.wastageReports[idx] = { ...freshReports[idx], ...changes };
      this.save();
    }
  }

  save() {
    universalDB.save();
  }

  addAlertMessage(alertId, senderRole, senderName, text) {
    const alert = this.alertsList.find(a => a.id === alertId);
    if (alert) {
      if (!alert.messages) alert.messages = [];
      alert.messages.push({
        id: "m" + Date.now().toString(36),
        senderRole,
        senderName,
        text,
        time: new Date().toISOString()
      });
      this.save();
    }
  }

  addHighlight(title, desc, color = "blue") {
    if (!this.highlights) { universalDB.data.sust.highlights = []; }
    const syncId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    this.highlights.unshift({ id: syncId, title, desc, color, time: Date.now() });
    if (this.highlights.length > 50) this.highlights.pop(); // Keep bounded
    this.save();
  }

  removeHighlight(id) {
    if (this.highlights) {
      universalDB.data.sust.highlights = this.highlights.filter(h => h.id !== id);
      this.save();
    }
  }

  removeHighlightIndex(index) {
    if (this.highlights && index >= 0 && index < this.highlights.length) {
      this.highlights.splice(index, 1);
      this.save();
    }
  }

  addInitiative(init) {
    this.initiatives.push(init);
    this.save();
  }

  updateInitiative(id, changes) {
    const idx = this.initiatives.findIndex(i => i.id === id);
    if (idx !== -1) {
      this.initiatives[idx] = { ...this.initiatives[idx], ...changes };
      this.save();
    }
  }

  deleteInitiative(id) {
    universalDB.data.sust.initiatives = this.initiatives.filter(i => i.id !== id);
    this.save();
  }

  reset() {
    // universalDB.reset() resets everything. For modular reset, not fully replicating.
    universalDB.reset();
  }
}

const db = new SustDB();
export default db;
