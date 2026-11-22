/**
 * One ticket per real problem.
 *
 * Match key = building + broken thing (after any "filed as" move) + floor +
 * area + part. How the student described it does not matter: the symptom and
 * answers only affect priority and size.
 *
 * Phase 1 covers exact matches and "covered by a whole-floor or
 * whole-building ticket". Merging narrower tickets into a later, wider one is
 * deliberately not here yet. "Other" never auto-matches; it always goes to the
 * coordinator.
 */
import { OTHER_ITEM_ID, Team } from "./issue-catalogue";

export interface TicketLocation {
  building_id: string;
  item_id: string;
  floor: string;
  area: string;
  /** Room number, dropdown choice or machine number; "" when there is none. */
  part: string;
  team: Team;
  /** ISO timestamp the ticket was filed. Only cleaning uses it (one ticket per area per day). */
  created_at?: string;
}

export type DuplicateKind = "exact" | "covered" | "none";

export interface DuplicateResult<T> {
  kind: DuplicateKind;
  ticket?: T;
}

/** Lower-case, no punctuation, single spaces. Numbers are kept. */
export function cleanPart(raw: string | undefined | null): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const dayOf = (iso?: string) => (iso ? iso.slice(0, 10) : "");

export function matchKey(t: TicketLocation, today?: string): string {
  const day = t.team === "cleaning" ? (today ?? dayOf(t.created_at)) : "";
  return [t.building_id, t.item_id, t.floor, t.area, cleanPart(t.part), day].join("|");
}

export function classifyDuplicate<T extends TicketLocation>(
  candidate: TicketLocation,
  open: T[],
  now: string = new Date().toISOString(),
): DuplicateResult<T> {
  if (candidate.item_id === OTHER_ITEM_ID) return { kind: "none" };

  const today = dayOf(now);
  const key = matchKey(candidate, today);
  const exact = open.find((t) => t.item_id !== OTHER_ITEM_ID && matchKey(t) === key);
  if (exact) return { kind: "exact", ticket: exact };

  // Cleaning is one ticket per area per day, and never "covered" by a wider one.
  if (candidate.team === "cleaning") return { kind: "none" };

  const covering = open.find(
    (t) =>
      t.item_id === candidate.item_id &&
      t.building_id === candidate.building_id &&
      (t.floor === "whole_building" ||
        (t.floor === candidate.floor && t.area === "whole_floor")) &&
      !(t.floor === candidate.floor && t.area === candidate.area && cleanPart(t.part) === cleanPart(candidate.part)),
  );
  if (covering) return { kind: "covered", ticket: covering };

  return { kind: "none" };
}
