/**
 * Who gets a job. Pure functions only: no database, no clock, no randomness,
 * so every rule can be unit tested and the same inputs always pick the same
 * person.
 *
 * The rules (from the approved plan):
 *   1. Eligible = right team, switched on as available, not marked unavailable
 *      today, and current load + this job stays within MAX_LOAD points.
 *   2. Rank the eligible by: free-now before busy, then fairness (work given
 *      recently, fading by half every week, plus double the work still open),
 *      then, for big jobs only, who has had fewer big jobs lately, then the
 *      person already working in the same building, then user id.
 *   3. A Critical job with nobody eligible goes to the lowest-load team member
 *      even above MAX_LOAD (still not someone marked unavailable).
 */
import { TEAMS } from "../issue-catalogue/issue-catalogue";
import type { Size, Team } from "../issue-catalogue/issue-catalogue";

export const MAX_LOAD = 6;
export const FADE_HALF_LIFE_DAYS = 7;
const DAY_MS = 86_400_000;

/** Technician job points actually carried out, newest wins in the ranking. */
export interface PastJob {
  points: number;
  size: Size;
  /** ISO time the job was given to this person. */
  assignedAt: string;
}

export interface Candidate {
  userId: string;
  team: Team | null;
  /** The person's own "Available today" switch. */
  available: boolean;
  /** YYYY-MM-DD the person was marked unavailable for (declined sick / missed). */
  unavailableOn?: string | null;
  /** Points of jobs still open on them. */
  openPoints: number;
  /** Buildings of the jobs still open on them. */
  openBuildings: string[];
  past: PastJob[];
}

export interface Job {
  team: Team;
  points: number;
  size: Size;
  priority: string;
  buildingId?: string;
}

export interface RankOptions {
  now: Date;
  /** People who already declined or missed this job. */
  exclude?: string[];
}

export interface Ranked {
  userId: string;
  /** Lower is better; shown to the coordinator so a pick can be explained. */
  score: { bucket: number; fairness: number; heavy: number };
  overLoad: boolean;
}

/**
 * The calendar day at the campus, not in UTC: "off today" must end at local
 * midnight. Set CAMPUS_TIME_ZONE (default Asia/Kolkata) to change it.
 */
const dayFormat = (() => {
  const zone = process.env.CAMPUS_TIME_ZONE || "Asia/Kolkata";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
  }
})();
export const todayKey = (now: Date) => dayFormat.format(now);

/** Past work counts less the longer ago it was: half after a week. */
export function fadedPoints(past: PastJob[], now: Date, onlySize?: Size): number {
  let total = 0;
  for (const p of past) {
    if (onlySize && p.size !== onlySize) continue;
    const ageDays = Math.max(0, (now.getTime() - new Date(p.assignedAt).getTime()) / DAY_MS);
    total += p.points * Math.pow(0.5, ageDays / FADE_HALF_LIFE_DAYS);
  }
  return total;
}

function isOffToday(c: Candidate, now: Date): boolean {
  return !c.available || c.unavailableOn === todayKey(now);
}

/** Everyone who may be given the job under the normal rules, best first. */
export function rankCandidates(job: Job, candidates: Candidate[], opts: RankOptions): Ranked[] {
  const exclude = new Set(opts.exclude ?? []);
  const eligible = candidates.filter(
    (c) =>
      c.team === job.team &&
      !exclude.has(c.userId) &&
      !isOffToday(c, opts.now) &&
      c.openPoints + job.points <= MAX_LOAD,
  );
  return order(job, eligible, opts, false);
}

/**
 * Critical fallback: nobody passed the normal rules, so take the least-loaded
 * person on the team who is on shift (not switched off, not marked off
 * today), ignoring the load cap. Off-shift people are never woken; if that
 * leaves nobody, the coordinator is alerted instead.
 */
export function criticalFallback(job: Job, candidates: Candidate[], opts: RankOptions): Ranked | null {
  const exclude = new Set(opts.exclude ?? []);
  const pool = candidates.filter(
    (c) => c.team === job.team && !exclude.has(c.userId) && !isOffToday(c, opts.now),
  );
  // Least loaded first, then the usual order, so the choice is still stable.
  const ranked = order(job, pool, opts, true);
  return ranked[0] ?? null;
}

function order(job: Job, pool: Candidate[], opts: RankOptions, byLoadFirst: boolean): Ranked[] {
  const rows = pool.map((c) => {
    const free = c.openPoints === 0 ? 0 : 1;
    const fairness = fadedPoints(c.past, opts.now) + 2 * c.openPoints;
    const heavy = job.size === "L" ? fadedPoints(c.past, opts.now, "L") : 0;
    const sameBuilding = job.buildingId && c.openBuildings.includes(job.buildingId) ? 0 : 1;
    return {
      c,
      sameBuilding,
      ranked: {
        userId: c.userId,
        score: { bucket: free, fairness, heavy },
        overLoad: c.openPoints + job.points > MAX_LOAD,
      } as Ranked,
    };
  });
  rows.sort((a, b) => {
    if (byLoadFirst && a.c.openPoints !== b.c.openPoints) return a.c.openPoints - b.c.openPoints;
    return (
      a.ranked.score.bucket - b.ranked.score.bucket ||
      a.ranked.score.fairness - b.ranked.score.fairness ||
      a.ranked.score.heavy - b.ranked.score.heavy ||
      a.sameBuilding - b.sameBuilding ||
      a.c.userId.localeCompare(b.c.userId)
    );
  });
  return rows.map((r) => r.ranked);
}

/** Minutes the person has to acknowledge before the job moves on. */
export function ackWindowMinutes(priority: string): number {
  if (priority === "immediate") return 10;
  if (priority === "high") return 15;
  return 60;
}

const LEVELS = ["low", "medium", "high", "immediate"];

/**
 * Queue ordering level: a waiting Low counts as Medium after a day, and a
 * waiting Medium as High after two, so nothing waits forever behind newer work.
 */
export function agedPriority(priority: string, createdAt: string, now: Date): string {
  const days = (now.getTime() - new Date(createdAt).getTime()) / DAY_MS;
  let rank = LEVELS.indexOf(priority);
  if (rank < 0) rank = 0;
  if (rank === 0 && days >= 1) rank = 1;
  if (rank <= 1 && days >= 2) rank = Math.max(rank, 2);
  return LEVELS[rank];
}

export const levelOrder = (p: string) => LEVELS.indexOf(p);

/** A person's team, from the team set on their account. No team means no automatic jobs. */
export function teamOfUser(u: { team?: string | null }): Team | null {
  return (TEAMS as string[]).includes(u.team ?? "") ? (u.team as Team) : null;
}

/**
 * Which team a monitoring fault goes to, from its type ("Electrical",
 * "Plumbing", "HVAC"...). A type the rules do not recognise returns null, and
 * the coordinator chooses the team.
 */
export function faultTeam(faultType: string | null | undefined): Team | null {
  const t = (faultType ?? "").toLowerCase();
  if (/hvac|cooling|chiller|air|ventilat|ac/.test(t)) return "hvac";
  if (/plumb|water|pipe|leak|pump|drain/.test(t)) return "plumber";
  if (/electr|power|voltage|wiring|circuit|transformer|meter|solar|lighting|electronic/.test(t)) return "electrician";
  return null;
}

/** Which team carries out an audit recommendation, from its category. Unknown means the coordinator chooses. */
export function findingTeam(category: string | null | undefined): Team | null {
  const t = (category ?? "").toLowerCase();
  if (/hvac|cool|chill|air|ventilat|heat/.test(t)) return "hvac";
  if (/plumb|water|pipe|geyser/.test(t)) return "plumber";
  if (/light|electr|solar|power|motor|control|meter|lamp|led/.test(t)) return "electrician";
  return null;
}
