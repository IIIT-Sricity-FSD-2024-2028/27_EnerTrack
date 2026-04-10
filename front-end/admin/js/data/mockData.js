/**
 * mockData.js (Admin Adapter)
 * Redirects admin data access to the Universal DB.
 */
import universalDB from '../../../shared/universalDB.js';

const EnerTrackDB = {
  get session() { return universalDB.data.session; },
  get alerts() { return universalDB.data.admin.alerts; },
  get backupJobs() { return universalDB.data.admin.backupJobs; },
  get systemUpdates() { return universalDB.data.admin.systemUpdates; },
  get systemHealth() { return universalDB.data.admin.systemHealth; },
  get performanceStats() { return universalDB.data.admin.performanceStats; },
  get errorScans() { return universalDB.data.admin.errorScans; },
  get maintenanceWindow() { return universalDB.data.admin.maintenanceWindow; },
  get serviceRequests() { return universalDB.data.workflow.serviceRequests; },
  
  save: function() {
    universalDB.save();
  }
};

export default EnerTrackDB;
