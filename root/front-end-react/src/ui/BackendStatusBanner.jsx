/**
 * BackendStatusBanner — tells the person when the backend cannot be reached.
 *
 * Without it, a page whose data fails to load just shows empty tables and
 * zeros, which looks like "you have no data" rather than "the server is down".
 * This sits above every page (mounted once in main.jsx), appears as soon as any
 * request fails to connect, keeps checking every few seconds, and offers a
 * Reload once the server answers again.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { pingBackend } from "../api/client";
import {
  dismissRecovered,
  getSnapshot,
  subscribe,
} from "../api/backendStatus";
import "./BackendStatusBanner.css";

const RECHECK_MS = 5000;

export default function BackendStatusBanner() {
  const { offline, recovered } = useSyncExternalStore(subscribe, getSnapshot);
  const [checking, setChecking] = useState(false);

  // While offline, keep asking quietly so the banner clears by itself.
  useEffect(() => {
    if (!offline) return undefined;
    const timer = setInterval(pingBackend, RECHECK_MS);
    return () => clearInterval(timer);
  }, [offline]);

  async function handleRetry() {
    setChecking(true);
    await pingBackend();
    setChecking(false);
  }

  if (!offline && !recovered) return null;

  if (offline) {
    return (
      <div className="backend-banner backend-banner--offline" role="alert">
        <div>
          <strong>The backend isn't connected.</strong>
          <span>
            Data can't load or save until the server is running again. Any
            empty tables or zeros on this page are not your real data.
          </span>
        </div>
        <button type="button" onClick={handleRetry} disabled={checking}>
          {checking ? "Checking…" : "Try again"}
        </button>
      </div>
    );
  }

  return (
    <div className="backend-banner backend-banner--back" role="status">
      <div>
        <strong>The backend is connected again.</strong>
        <span>Reload to load your data.</span>
      </div>
      <div className="backend-banner__actions">
        {/* A full reload is the point here: every page loads its data on open,
            so this is the simplest way to refill all of them. history.go(0)
            reloads the page, and the project forbids window.location. */}
        <button type="button" onClick={() => window.history.go(0)}>
          Reload
        </button>
        <button type="button" onClick={dismissRecovered}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
