/**
 * Deadline rules, as pure functions.
 *
 * One "finished by" deadline per job, counted from when the job is first sent
 * to a technician, in plain 24-hour days. The length comes from the visible
 * priority and the hidden job size (S quick, M medium, L heavy). Critical uses
 * the High row; what makes it faster is that it is assigned at once, plus a
 * separate "make safe within 2 hours" milestone.
 */
import type { Size } from "../issue-catalogue/issue-catalogue";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export const DEADLINE_DAYS: Record<string, Record<Size, number>> = {
  immediate: { S: 1, M: 2, L: 3 },
  high: { S: 1, M: 2, L: 3 },
  medium: { S: 2, M: 3, L: 5 },
  low: { S: 3, M: 5, L: 7 },
};

export const SAFE_HOURS = 2;
export const PARTS_DEFAULT_DAYS = 2;
/** Waiting for parts longer than this needs the coordinator's OK. */
export const PARTS_MAX_DAYS = 5;
export const WARN_AT = [0.5, 0.9] as const;

export function deadlineDays(priority: string, size: Size): number {
  return (DEADLINE_DAYS[priority] ?? DEADLINE_DAYS.low)[size] ?? 5;
}

/** Start plus the matrix length, pushed out by time spent waiting for parts. */
export function deadlineFrom(start: Date, priority: string, size: Size, pausedMs = 0): Date {
  return new Date(start.getTime() + deadlineDays(priority, size) * DAY_MS + pausedMs);
}

export const safeBy = (start: Date): Date => new Date(start.getTime() + SAFE_HOURS * HOUR_MS);

/** How much of the allowed time is used: 0 at the start, 1 at the deadline. */
export function usedFraction(startedAt: string, deadlineAt: string, now: Date): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(deadlineAt).getTime();
  if (end <= start) return 1;
  return Math.max(0, (now.getTime() - start) / (end - start));
}

export const hoursLeft = (deadlineAt: string, now: Date): number =>
  Math.round(((new Date(deadlineAt).getTime() - now.getTime()) / HOUR_MS) * 10) / 10;
