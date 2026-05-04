/**
 * mockData.js (Finance Analyst Adapter)
 * Redirects finance data access to the Universal DB.
 */
import universalDB from '../../shared/universalDB.js';

const FinanceDB = {
  get session() { return universalDB.data.session; },
  get departments() { return universalDB.data.finance.departments; },
  get buildings() { return universalDB.data.finance.buildings; },
  get energyCosts() { return universalDB.data.finance.energyCosts; },
  get financialReports() { return universalDB.data.finance.financialReports; },
  get invoices() { return universalDB.data.finance.invoices; },
  get activityLog() { return universalDB.data.finance.activityLog; },
  get rolePermissions() { return universalDB.data.finance.rolePermissions; },
  get serviceRequests() { return universalDB.data.workflow.serviceRequests; },
  get workOrders() { return universalDB.data.tech.workOrders; },
  get alerts() { return universalDB.data.tech.alerts; },
  
  save: function() {
    universalDB.save();
  }
};

export function persistData() {
  universalDB.save();
}

export function initDB() {
  // Initialization is handled by universalDB constructor
}

export default FinanceDB;
