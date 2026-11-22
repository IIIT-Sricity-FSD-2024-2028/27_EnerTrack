/**
 * NotificationBell — the signed-in person's own messages from the backend,
 * with an unread count. It sits in the top bar of every dashboard page.
 *
 * It owns its list: it loads once, then every 30 seconds, and opening the
 * dropdown marks everything as read on the server (so the count is the same
 * on every device). Sustainability and Finance still have a second,
 * browser-only list for the wastage hand-offs; that is separate.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/client";

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  // Which messages were new when the dropdown opened, to highlight them.
  const [fresh, setFresh] = useState([]);
  const box = useRef(null);

  const load = useCallback(
    () =>
      api
        .get("/notifications")
        .then((list) => setItems(Array.isArray(list) ? [...list].reverse() : []))
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [load]);

  // Click anywhere else, or press Escape, to close.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = items.filter((n) => !n.is_read).length;

  async function toggle() {
    if (open) return setOpen(false);
    setFresh(items.filter((n) => !n.is_read).map((n) => n.notification_id));
    setOpen(true);
    if (unread > 0) {
      try {
        await api.patch("/notifications/read-all", {});
        setItems((list) => list.map((n) => ({ ...n, is_read: true })));
      } catch {
        // Leave the count as it is; it will be tried again next time.
      }
    }
  }

  return (
    <div className="bell" ref={box}>
      <button
        type="button"
        className="bell-btn"
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="bell-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="bell-menu" role="region" aria-label="Notifications">
          <div className="bell-head">Notifications</div>
          {items.length === 0 ? (
            <p className="bell-empty">Nothing yet. Updates about your jobs and reports show up here.</p>
          ) : (
            <ul>
              {items.slice(0, 15).map((n) => (
                <li key={n.notification_id} className={fresh.includes(n.notification_id) ? "bell-item new" : "bell-item"}>
                  {n.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
