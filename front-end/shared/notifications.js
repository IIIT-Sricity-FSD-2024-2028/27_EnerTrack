/**
 * notifications.js
 * Shared notification utility for EnerTrack sustainability workflow.
 * Stores per-user notifications in localStorage and provides bell icon rendering.
 */

const NOTIF_KEY_PREFIX = 'enertrack_notifications_';

function _getKey(email) {
    return NOTIF_KEY_PREFIX + (email || 'unknown');
}

/**
 * Push a notification for a specific user.
 * @param {string} targetEmail - The email of the user to notify
 * @param {object} notification - { reportId, message }
 */
export function pushNotification(targetEmail, notification) {
    if (!targetEmail || !notification || !notification.message) return;
    const key = _getKey(targetEmail);
    const raw = localStorage.getItem(key);
    const notifs = raw ? JSON.parse(raw) : [];
    notifs.unshift({
        id: 'N-' + Date.now().toString(36),
        reportId: notification.reportId || '',
        message: notification.message,
        timestamp: new Date().toISOString(),
        read: false
    });
    // Keep max 50 notifications
    if (notifs.length > 50) notifs.length = 50;
    localStorage.setItem(key, JSON.stringify(notifs));
}

/**
 * Get all notifications for the current user.
 * @param {string} email
 * @returns {Array}
 */
export function getNotifications(email) {
    const key = _getKey(email);
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
}

/**
 * Get unread count for the current user.
 * @param {string} email
 * @returns {number}
 */
export function getUnreadCount(email) {
    return getNotifications(email).filter(n => !n.read).length;
}

/**
 * Mark all notifications as read.
 * @param {string} email
 */
export function markAllRead(email) {
    const key = _getKey(email);
    const notifs = getNotifications(email);
    notifs.forEach(n => n.read = true);
    localStorage.setItem(key, JSON.stringify(notifs));
}

/**
 * Render a bell icon with badge into a target element.
 * @param {string} containerId - ID of the container element
 * @param {string} email - current user email
 */
export function renderBellIcon(containerId, email) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const count = getUnreadCount(email);
    const badgeHTML = count > 0 ? `<span style="position:absolute;top:-4px;right:-4px;background:#dc2626;color:white;font-size:9px;font-weight:700;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 4px;">${count > 9 ? '9+' : count}</span>` : '';

    container.innerHTML = `
        <div id="notif-bell" style="position:relative;cursor:pointer;" title="Notifications">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            ${badgeHTML}
        </div>`;

    // Toggle dropdown on click
    document.getElementById('notif-bell').addEventListener('click', (e) => {
        e.stopPropagation();
        let dropdown = document.getElementById('notif-dropdown');
        if (dropdown) { dropdown.remove(); return; }

        const notifs = getNotifications(email);
        markAllRead(email);
        // Update badge
        const badge = container.querySelector('span');
        if (badge) badge.remove();

        const listHTML = notifs.length === 0
            ? '<p style="text-align:center;color:#9ca3af;font-size:13px;padding:16px;">No notifications yet.</p>'
            : notifs.slice(0, 15).map(n => `
                <div style="padding:10px 14px;border-bottom:1px solid #f3f4f6;${!n.read ? 'background:#f0fdf4;' : ''}">
                    <p style="font-size:12px;color:#374151;margin:0 0 4px 0;line-height:1.5;">${n.message}</p>
                    <span style="font-size:10px;color:#9ca3af;">${new Date(n.timestamp).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                </div>`).join('');

        dropdown = document.createElement('div');
        dropdown.id = 'notif-dropdown';
        dropdown.style.cssText = 'position:absolute;top:32px;right:0;width:320px;max-height:360px;overflow-y:auto;background:white;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:9999;';
        dropdown.innerHTML = `<div style="padding:12px 14px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.4px;">Notifications</div>${listHTML}`;
        container.querySelector('#notif-bell').appendChild(dropdown);

        // Close on outside click
        const closeHandler = () => { const el = document.getElementById('notif-dropdown'); if (el) el.remove(); document.removeEventListener('click', closeHandler); };
        setTimeout(() => document.addEventListener('click', closeHandler), 50);
    });
}

/**
 * Notify specific roles about a report state change.
 * @param {object} report - the wastage report object
 * @param {string} action - what happened
 * @param {string} actorName - who did it
 */
export function notifyOnStateChange(report, action, actorName) {
    const reportLabel = `Report #${report.id}`;

    const users = _readUsers();
    const soEmails = users.filter(u => _normalizeRole(u.role) === 'sustainability_officer').map(u => u.email);
    const faEmails = users.filter(u => _normalizeRole(u.role) === 'finance_analyst').map(u => u.email);
    const reporterEmail = report.reporterEmail;

    switch (action) {
        case 'submitted':
            soEmails.forEach(e => pushNotification(e, { reportId: report.id, message: `${actorName} submitted a new ${report.type} wastage report (${reportLabel}).` }));
            break;
        case 'validated':
            pushNotification(reporterEmail, { reportId: report.id, message: `Your ${reportLabel} has been validated by the Sustainability Officer.` });
            break;
        case 'dismissed':
            pushNotification(reporterEmail, { reportId: report.id, message: `Your ${reportLabel} was dismissed: ${report.dismissReason || 'See details'}. It has been moved to My Archives.` });
            soEmails.forEach(e => pushNotification(e, { reportId: report.id, message: `${actorName} dismissed ${reportLabel}. Reason: ${report.dismissReason || 'Not specified'}.` }));
            faEmails.forEach(e => pushNotification(e, { reportId: report.id, message: `${reportLabel} was dismissed by Sustainability Officer (${report.dismissReason || 'No reason'}).` }));
            break;
        case 'forwarded':
            faEmails.forEach(e => pushNotification(e, { reportId: report.id, message: `${reportLabel} has been forwarded to you for cost impact assessment.` }));
            pushNotification(reporterEmail, { reportId: report.id, message: `Your ${reportLabel} has been forwarded to Finance for cost assessment.` });
            break;
        case 'cost_added':
            soEmails.forEach(e => pushNotification(e, { reportId: report.id, message: `Finance has returned ${reportLabel} with cost impact figures.` }));
            pushNotification(reporterEmail, { reportId: report.id, message: `Financial assessment completed for your ${reportLabel}.` });
            break;
        case 'returned_to_so':
            soEmails.forEach(e => pushNotification(e, { reportId: report.id, message: `${reportLabel} has been returned by Finance with cost figures.` }));
            break;
        case 'target_set':
            pushNotification(reporterEmail, { reportId: report.id, message: `A new sustainability target has been set for your ${reportLabel}.` });
            break;
        case 'delivered':
            pushNotification(reporterEmail, { reportId: report.id, message: `Final report delivered for ${reportLabel}. Check your wastage logs for the full breakdown.` });
            break;
    }
}

function _normalizeRole(role) {
    const r = (role || '').toString().trim().toLowerCase();
    if (r === 'sustainability officer') return 'sustainability_officer';
    if (r === 'finance analyst' || r === 'financial analyst') return 'finance_analyst';
    return r;
}

function _readUsers() {
    const sources = ['enertrack_users', 'registeredUsers'];
    const all = [];
    sources.forEach((key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) all.push(...arr);
        } catch (e) {
            // ignore malformed storage payload
        }
    });
    // Fallback defaults from bundled mock login data, used when no user list is persisted yet.
    all.push(
        { role: 'Sustainability Officer', email: 'viksa@gmail.com' },
        { role: 'Financial Analyst', email: 'husaam@gmail.com' }
    );
    const seen = new Set();
    return all.filter(u => {
        if (!u || !u.email) return false;
        const k = String(u.email).trim().toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}
