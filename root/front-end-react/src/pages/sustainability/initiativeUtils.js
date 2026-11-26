/**
 * initiativeUtils — non-component helpers shared by the initiative pages:
 * useTeams() (technician teams from the server's catalogue, one list so a
 * renamed team can't drift), rupees() and day() formatting.
 */
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchServiceCatalogue,
  selectServiceCatalogue,
} from "../../store/slices/serviceRequestsSlice";

/** Used only if the catalogue cannot be loaded; the server's list wins. */
const FALLBACK_TEAMS = [
  { id: "electrician", label: "Electrician", work: "Electrical" },
  { id: "plumber", label: "Plumber", work: "Plumbing" },
  { id: "general", label: "General Maintenance", work: "General maintenance" },
  { id: "hvac", label: "HVAC", work: "HVAC" },
];

/** The technician teams { id, label, work } and a label lookup. */
export function useTeams() {
  const dispatch = useDispatch();
  const catalogue = useSelector(selectServiceCatalogue);
  const teams =
    Array.isArray(catalogue?.teams) && catalogue.teams.length ? catalogue.teams : FALLBACK_TEAMS;
  // Loaded once per session (the store caches it); a failure keeps the fallback.
  useEffect(() => {
    dispatch(fetchServiceCatalogue());
  }, [dispatch]);
  const label = (id) => teams.find((t) => t.id === id)?.label || id || "";
  return { teams, label };
}

export const rupees = (n) => (typeof n === "number" ? "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—");

/** "12 Mar 2027" from "2027-03-12" or an ISO time. */
export const day = (d) =>
  d ? new Date(String(d).length <= 10 ? `${d}T00:00:00` : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
