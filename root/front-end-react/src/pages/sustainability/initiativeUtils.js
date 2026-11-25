/**
 * initiativeUtils — non-component helpers shared by the initiative pages:
 * useTeams() (technician teams from the server's catalogue, one list so a
 * renamed team can't drift), rupees() and day() formatting.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";

/** Used only if the catalogue cannot be loaded; the server's list wins. */
const FALLBACK_TEAMS = [
  { id: "electrician", label: "Electrician", work: "Electrical" },
  { id: "plumber", label: "Plumber", work: "Plumbing" },
  { id: "general", label: "General Maintenance", work: "General maintenance" },
  { id: "hvac", label: "HVAC", work: "HVAC" },
];

let cached = null;

/** The technician teams { id, label, work } and a label lookup. */
export function useTeams() {
  const [teams, setTeams] = useState(cached || FALLBACK_TEAMS);
  useEffect(() => {
    if (cached) return;
    let active = true;
    api
      .get("/service-requests/catalogue")
      .then((cat) => {
        if (active && Array.isArray(cat?.teams) && cat.teams.length) {
          cached = cat.teams;
          setTeams(cat.teams);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const label = (id) => teams.find((t) => t.id === id)?.label || id || "";
  return { teams, label };
}

export const rupees = (n) => (typeof n === "number" ? "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—");

/** "12 Mar 2027" from "2027-03-12" or an ISO time. */
export const day = (d) =>
  d ? new Date(String(d).length <= 10 ? `${d}T00:00:00` : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
