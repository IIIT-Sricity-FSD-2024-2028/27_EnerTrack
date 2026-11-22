/**
 * Priority and job size for an issue report: fixed hand-written rules.
 *
 * Pure functions only. The same answers always give the same result, and
 * nothing here reads the clock, the database or the request.
 *
 * ONE visible level:  low < medium < high < immediate (shown as "Critical").
 * Job size (S/M/L) is a hidden second number that only the dispatcher and
 * the deadline table read. It is never shown, set, or edited by anyone.
 */
import {
  AreaId,
  ISSUE_TYPES,
  OTHER_HOW_BAD,
  OTHER_ITEM_ID,
  SIZE_POINTS,
  Seriousness,
  Size,
  Tag,
  Team,
  findFollowUp,
  findIssueType,
  findItem,
  findProblem,
} from "./issue-catalogue";

export type Level = "low" | "medium" | "high" | "immediate";
export const LEVELS: Level[] = ["low", "medium", "high", "immediate"];

export const levelRank = (l: Level) => LEVELS.indexOf(l);
export const maxLevel = (a: Level, b: Level): Level => (levelRank(a) >= levelRank(b) ? a : b);

/** One step up, but never past "high": only danger reaches "immediate". */
const raiseOnce = (l: Level): Level => (levelRank(l) >= levelRank("high") ? l : LEVELS[levelRank(l) + 1]);

export class InvalidReportError extends Error {}

/** Everything the student told us, after the server has checked the lists. */
export interface ReportFacts {
  floor: string;
  area: AreaId;
  /** Catalogue item id, or "other". */
  itemId: string;
  /** Required when itemId is "other": which issue type the student was in. */
  issueTypeId?: string;
  problemId?: string;
  /** One / Some / All here. */
  howMany?: "one" | "some" | "all";
  /** Follow-up id -> answer value. */
  answers?: Record<string, string>;
  /** "Is anyone in danger right now?" */
  inDanger?: boolean;
  happenedBefore?: boolean;
  since?: "hour" | "hours" | "day";
  /** "Other" only: how bad is it. */
  howBad?: string;
}

/** The problem as filed, after any "filed as" move. */
export interface ResolvedReport {
  issueTypeId: string;
  itemId: string;
  problemId: string | null;
  team: Team;
  secondTeam: Team | null;
  seriousness: Seriousness;
  tags: Tag[];
  size: Size;
  hazard: boolean;
  minReach: 1 | 2 | 3;
  danger: boolean;
  forceHigh: boolean;
  isOther: boolean;
  /** Set when a follow-up moved the report to another item. */
  filedAs: { from: string; to: string } | null;
}

export function resolveReport(f: ReportFacts): ResolvedReport {
  // "Other (type)": the team comes from the issue type; "How bad?" is asked instead.
  if (f.itemId === OTHER_ITEM_ID) {
    const type = f.issueTypeId ? findIssueType(f.issueTypeId) : undefined;
    if (!type) throw new InvalidReportError("Pick an issue type for an 'Other' report.");
    const how = OTHER_HOW_BAD.find((h) => h.value === f.howBad);
    if (!how) throw new InvalidReportError("Tell us how bad it is.");
    const team = type.items[0].team;
    return {
      issueTypeId: type.id,
      itemId: OTHER_ITEM_ID,
      problemId: null,
      team,
      secondTeam: null,
      seriousness: how.seriousness,
      tags: how.danger ? ["DANGER"] : [],
      size: "M",
      hazard: false,
      minReach: 1,
      danger: !!how.danger || !!f.inDanger,
      forceHigh: false,
      isOther: true,
      filedAs: null,
    };
  }

  const found = findItem(f.itemId);
  if (!found) throw new InvalidReportError(`Unknown item '${f.itemId}'.`);
  const problem = f.problemId ? findProblem(found.item, f.problemId) : undefined;
  if (!problem) throw new InvalidReportError(`Unknown problem '${f.problemId}' for '${f.itemId}'.`);

  let { item } = found;
  let prob = problem;
  let issueTypeId = found.type.id;
  let danger = !!f.inDanger;
  let forceHigh = false;
  let secondTeam: Team | null = null;
  let filedAs: ResolvedReport["filedAs"] = null;

  for (const fu of findFollowUp(f.itemId, problem.id, f.howMany)) {
    const answer = f.answers?.[fu.id];
    if (answer === undefined) continue;
    const outcome = fu.outcomes[answer];
    if (!outcome) continue;
    if (outcome.danger) danger = true;
    if (outcome.high) forceHigh = true;
    if (outcome.secondTeam) secondTeam = outcome.secondTeam;
    if (outcome.refile && !filedAs) {
      const target = findItem(outcome.refile.item);
      const targetProb = target && findProblem(target.item, outcome.refile.problem);
      if (target && targetProb) {
        filedAs = { from: `${found.item.id}:${problem.id}`, to: `${target.item.id}:${targetProb.id}` };
        item = target.item;
        prob = targetProb;
        issueTypeId = target.type.id;
      }
    }
  }

  const tags = prob.tags ?? [];
  if (tags.includes("DANGER")) danger = true;

  return {
    issueTypeId,
    itemId: item.id,
    problemId: prob.id,
    team: item.team,
    secondTeam: secondTeam && secondTeam !== item.team ? secondTeam : null,
    seriousness: prob.seriousness,
    tags,
    size: prob.size ?? item.size,
    hazard: !!item.hazard,
    minReach: item.minReach ?? 1,
    danger,
    forceHigh,
    isOther: false,
    filedAs,
  };
}

/** How many people the place can physically affect: 1 room, 2 shared place or floor, 3 whole building. */
export function reachTier(floor: string, area: AreaId, minReach: 1 | 2 | 3 = 1): 1 | 2 | 3 {
  let tier: 1 | 2 | 3;
  if (floor === "whole_building" || area === "whole_building") tier = 3;
  else if (area === "inside_room") tier = 1;
  else tier = 2;
  return Math.max(tier, minReach) as 1 | 2 | 3;
}

/** Reach x seriousness. Rows are the tier; columns A, B, C. */
const BASE: Record<1 | 2 | 3, Record<Seriousness, Level>> = {
  3: { A: "high", B: "high", C: "medium" },
  2: { A: "medium", B: "medium", C: "low" },
  1: { A: "low", B: "low", C: "low" },
};

const SERIOUSNESS_LABEL: Record<Seriousness, string> = {
  A: "can't use it",
  B: "works badly",
  C: "small problem",
};
const TIER_LABEL = { 1: "one room", 2: "shared place", 3: "whole building" } as const;

/** A +1 is only a vote: a big enough group raises one level, once. Tier 1 never rises. */
export const CROWD_THRESHOLD: Record<1 | 2 | 3, number | null> = { 1: null, 2: 15, 3: 50 };

export interface PriorityResult {
  /** Level from the rules alone, before the crowd raise. */
  ruleLevel: Level;
  /** Level after the crowd raise. This is what the system believes. */
  level: Level;
  tier: 1 | 2 | 3;
  size: Size;
  points: number;
  /** Plain-English reasons, stored with the ticket and shown to the coordinator. */
  reasons: string[];
}

export interface PriorityContext {
  /** Distinct reporters plus +1s plus merged students. */
  people?: number;
}

export function computePriority(
  f: ReportFacts,
  r: ResolvedReport,
  ctx: PriorityContext = {},
): PriorityResult {
  const tier = reachTier(f.floor, f.area, r.minReach);

  // Size: from the problem, plus one when it covers more than one spot or the last fix was a patch.
  let sizeIdx = ["S", "M", "L"].indexOf(r.size);
  if (f.howMany === "all" || isWideArea(f)) sizeIdx += 1;
  if (f.happenedBefore) sizeIdx += 1;
  const size = (["S", "M", "L"] as Size[])[Math.min(sizeIdx, 2)];
  const points = SIZE_POINTS[size];

  // 1. Any danger: straight to the top, stop.
  if (r.danger) {
    return {
      ruleLevel: "immediate",
      level: "immediate",
      tier,
      size,
      points,
      reasons: ["Danger reported: assigned at once"],
    };
  }

  // 2. Base from reach x seriousness.
  let level: Level = BASE[tier][r.seriousness];
  const reasons = [`${capitalise(TIER_LABEL[tier])} · ${SERIOUSNESS_LABEL[r.seriousness]}`];

  // 3. One raise at most, never above "high".
  const why: string[] = [];
  if (r.tags.includes("HEALTH")) why.push("health");
  if (r.tags.includes("WASTE")) why.push("waste");
  if (r.hazard) why.push("specialist or hazardous work");
  if (f.since === "day") why.push("more than a day");
  if (f.happenedBefore) why.push("happened before");
  if (why.length) {
    const raised = raiseOnce(level);
    if (raised !== level) {
      level = raised;
      reasons.push(`Raised: ${why.join(", ")}`);
    }
  }

  // A follow-up can lift the result to at least "high" (e.g. overflow spreading).
  if (r.forceHigh && levelRank(level) < levelRank("high")) {
    level = "high";
    reasons.push("Raised: spreading outside its spot");
  }

  const ruleLevel = level;

  // 4. Crowd raise: once, and only for shared places or the whole building.
  const threshold = CROWD_THRESHOLD[tier];
  if (threshold && (ctx.people ?? 0) >= threshold && levelRank(level) < levelRank("high")) {
    level = raiseOnce(level);
    reasons.push(`Raised: ${ctx.people} people affected`);
  }

  return { ruleLevel, level, tier, size, points, reasons };
}

/** Whole floor / whole building / shared-spot reports already count as "more than one spot". */
function isWideArea(f: ReportFacts): boolean {
  return f.area === "whole_floor" || f.area === "whole_building" || f.floor === "whole_building";
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Every item the catalogue knows, for tests that walk the whole table. */
export function allProblems() {
  const out: { itemId: string; problemId: string }[] = [];
  for (const t of ISSUE_TYPES)
    for (const i of t.items) for (const pr of i.problems) out.push({ itemId: i.id, problemId: pr.id });
  return out;
}
