/**
 * NotificationBell — bell icon with an unread badge and a dropdown list.
 * React version of renderBellIcon() from legacy/notifications.js. The
 * notifications themselves are still stored in localStorage by that module.
 */
import { useEffect, useState } from "react";
import { getNotifications, markAllRead } from "../../../legacy/notifications";
import { formatDateTime } from "../financeUtils";

export default function NotificationBell({ email }) {
  const [notifications, setNotifications] = useState(() => getNotifications(email));
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  // Another tab (e.g. the Sustainability Officer forwarding a report) writes
  // to localStorage → the "storage" event tells us to re-read the list.
  useEffect(() => {
    function handleStorage(event) {
      if (event.key && event.key.startsWith("enertrack_notifications_")) {
        setNotifications(getNotifications(email));
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [email]);

  // While the dropdown is open, any click elsewhere on the page closes it.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  function toggle(event) {
    event.stopPropagation();
    if (!open) {
      markAllRead(email);
      // Clear the red badge but remember which ones were new, to highlight them.
      setNotifications((list) => list.map((n) => ({ ...n, wasUnread: !n.read, read: true })));
    }
    setOpen(!open);
  }

  return (
    <div className="fa-bell" title="Notifications" onClick={toggle}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unread > 0 && <span className="fa-bell-badge">{unread > 9 ? "9+" : unread}</span>}

      {open && (
        <div className="fa-bell-dropdown" onClick={(e) => e.stopPropagation()}>
          <div className="fa-bell-head">Notifications</div>
          {notifications.length === 0 ? (
            <p className="fa-bell-empty">No notifications yet.</p>
          ) : (
            notifications.slice(0, 15).map((n) => (
              <div key={n.id} className={n.wasUnread ? "fa-bell-item unread" : "fa-bell-item"}>
                <p>{n.message}</p>
                <span>{formatDateTime(n.timestamp, false)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
