/**
 * NotificationBell — the signed-in user's notifications, from the server.
 *
 * Reads GET /notifications/mine, so a notification sent from someone else's
 * browser (a report forwarded to Finance, a report validated for its
 * reporter) shows up here on any device. It re-checks every minute, when the
 * window regains focus, and when opened.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import api from "../api/client";
import "./NotificationBell.css";

const POLL_MS = 60_000;

function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const panelId = useId();
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/notifications/mine");
      setItems(Array.isArray(res) ? res : []);
      setError(null);
    } catch (err) {
      setError(err.message || "Notifications could not be loaded.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    window.addEventListener("focus", load);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  // Close on Escape or a click outside.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onClick = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const unread = items.filter((n) => !n.is_read).length;

  const toggle = () => {
    setOpen((v) => !v);
    if (!open) load();
  };

  const markAllRead = async () => {
    const before = items;
    setItems((list) => list.map((n) => ({ ...n, is_read: true })));
    try {
      await api.patch("/notifications/mine/read");
    } catch (err) {
      setItems(before);
      setError(err.message || "Could not mark notifications as read.");
    }
  };

  return (
    <div className="nbell" ref={wrapRef}>
      <button
        type="button"
        className="nbell__button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        onClick={toggle}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && <span className="nbell__count">{unread > 9 ? "9+" : unread}</span>}
      </button>

      {open && (
        <div className="nbell__panel" id={panelId} role="dialog" aria-label="Notifications">
          <div className="nbell__head">
            <h2>Notifications</h2>
            {unread > 0 && (
              <button type="button" className="nbell__link" onClick={markAllRead}>
                Mark all as read
              </button>
            )}
          </div>

          {error && <p className="nbell__error" role="alert">{error}</p>}

          {!error && loaded && items.length === 0 && <p className="nbell__empty">No notifications yet.</p>}

          {items.length > 0 && (
            <ul className="nbell__list">
              {items.slice(0, 30).map((n) => (
                <li key={n.notification_id} className={n.is_read ? "" : "is-unread"}>
                  {/* Non-breaking hyphen so "WR-3N2A8Z" never splits over two lines. */}
                  <p>{String(n.message).replace(/\bWR-(\w+)/g, "WR\u2011$1")}</p>
                  {n.created_at && <time dateTime={n.created_at}>{timeAgo(n.created_at)}</time>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
