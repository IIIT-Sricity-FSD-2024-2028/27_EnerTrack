/**
 * The question lists for the issue report form, as plain data.
 *
 * New problems or teams are added HERE; the rules in priority.ts and
 * dedupe.ts never name a specific problem, they only read these fields.
 *
 * Students only ever see labels and follow-up questions (see
 * publicCatalogue). Seriousness, tags, job size and team stay on the server.
 */

/** A: can't use it · B: works badly · C: small problem. */
export type Seriousness = "A" | "B" | "C";
/** DANGER goes straight to the top level; HEALTH and WASTE each raise it. */
export type Tag = "DANGER" | "HEALTH" | "WASTE";
/** Hidden job size. Drives load points and deadline length, nothing else. */
export type Size = "S" | "M" | "L";
/**
 * "general" is General Maintenance: cleaning, garbage, and day-to-day waste
 * such as lights or taps left on — jobs that need hands, not a trade.
 */
export type Team = "electrician" | "plumber" | "general" | "hvac";

/** Every team a technician can belong to. The user form and validation use this list. */
export const TEAMS: Team[] = ["electrician", "plumber", "general", "hvac"];

export const SIZE_POINTS: Record<Size, number> = { S: 1, M: 2, L: 4 };

/** The kinds of waste a report or a wastage case can be about. */
export type WasteKind = "Energy" | "Water" | "Food" | "Emissions";

export type AreaId =
  | "inside_room"
  | "corridor"
  | "stairs"
  | "restroom"
  | "common_area"
  | "laundry_room"
  | "outside"
  | "whole_floor"
  | "other"
  | "whole_building";

export interface ProblemDef {
  id: string;
  label: string;
  seriousness: Seriousness;
  tags?: Tag[];
  /** Overrides the item's size for this problem. */
  size?: Size;
}

export interface ItemDef {
  id: string;
  label: string;
  team: Team;
  size: Size;
  /** Specialist, structural or hazardous kit: raises priority one level. */
  hazard?: boolean;
  /** The item always affects at least this many people (1 room, 2 shared, 3 building). */
  minReach?: 1 | 2 | 3;
  /** If set, the item can only be reported in these areas. */
  areas?: AreaId[];
  /** Only offered on these floors (e.g. flooding). Omitted = any floor. */
  floors?: string[];
  /**
   * A one-off fix does not stop it (food thrown away, smoke): it is still a
   * normal job for the item's team (General Maintenance acknowledges it,
   * clears and weighs the food, gets an idling engine switched off), and the
   * Sustainability Officer is also told at once and sees it as a hotspot
   * straight away, since the real fix is usually a longer-term one.
   */
  alertsOfficer?: true;
  /** What kind of waste it is, when not obvious from the issue type. */
  wasteKind?: WasteKind;
  problems: ProblemDef[];
}

export interface IssueTypeDef {
  id: string;
  label: string;
  items: ItemDef[];
}

export interface FollowUpDef {
  id: string;
  /** Matches the item and problem the student picked. */
  when: { item: string; problem?: string | string[]; howMany?: string };
  question: string;
  options: { value: string; label: string }[];
  /** Outcome for each answer. Anything not listed changes nothing. */
  outcomes: Record<
    string,
    {
      /** Re-file as another item/problem ("filed as"). */
      refile?: { item: string; problem: string };
      danger?: true;
      /** Raises the result to at least HIGH. */
      high?: true;
      /** A second team is needed too (the coordinator adds it for now). */
      secondTeam?: Team;
    }
  >;
}

const p = (
  id: string,
  label: string,
  seriousness: Seriousness,
  tags?: Tag[],
  size?: Size,
): ProblemDef => ({ id, label, seriousness, ...(tags ? { tags } : {}), ...(size ? { size } : {}) });

/** Highest floor number accepted. A sanity limit against typos, not a building height. */
export const MAX_FLOOR = 200;

/**
 * Named places the student may type instead of a number. Numbered floors are
 * free input (1 to MAX_FLOOR) so any building height works.
 */
export const FLOORS: { id: string; label: string }[] = [
  { id: "basement", label: "Basement" },
  { id: "ground", label: "Ground" },
  { id: "roof", label: "Roof" },
  { id: "outside", label: "Outside the building" },
  { id: "whole_building", label: "Whole building" },
];

const FLOOR_WORDS: Record<string, string> = {
  basement: "basement",
  ground: "ground",
  g: "ground",
  roof: "roof",
  terrace: "roof",
  outside: "outside",
  "outside the building": "outside",
  "whole building": "whole_building",
  whole_building: "whole_building",
};

/** Turn what the student typed into a floor id, or null if it is not a floor. */
export function normaliseFloor(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, " ");
  if (!s) return null;
  if (/^\d{1,3}$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= MAX_FLOOR ? String(n) : null;
  }
  return FLOOR_WORDS[s] ?? null;
}

export const AREAS: { id: AreaId; label: string }[] = [
  { id: "inside_room", label: "Inside a room" },
  { id: "corridor", label: "Corridor" },
  { id: "stairs", label: "Stairs" },
  { id: "restroom", label: "Restroom" },
  { id: "common_area", label: "Common area" },
  { id: "laundry_room", label: "Laundry room" },
  { id: "whole_floor", label: "Whole floor" },
  { id: "other", label: "Other" },
];

/** The "which part" list for each area. Room and Other take typed text. */
export const PARTS: Partial<Record<AreaId, { id: string; label: string }[]>> = {
  corridor: [
    { id: "near_room", label: "Near a room" },
    { id: "near_stairs", label: "Near stairs" },
    { id: "near_restroom", label: "Near restroom" },
    { id: "near_lift", label: "Near lift" },
  ],
  stairs: [
    { id: "main", label: "Main stairs" },
    { id: "side", label: "Side or emergency stairs" },
  ],
  restroom: [
    { id: "near_stairs", label: "Near stairs" },
    { id: "near_lift", label: "Near lift" },
    { id: "end_of_corridor", label: "End of corridor" },
    { id: "only_one", label: "Only one on this floor" },
  ],
  common_area: [
    { id: "common_room", label: "Common room" },
    { id: "study_room", label: "Study room" },
    { id: "tv_room", label: "TV room" },
    { id: "pantry", label: "Pantry" },
  ],
  outside: [
    { id: "entrance", label: "Entrance" },
    { id: "pathway", label: "Pathway" },
    { id: "parking", label: "Parking" },
    { id: "garden", label: "Garden" },
  ],
};

const NOT_IN_ROOM: AreaId[] = [
  "corridor",
  "stairs",
  "restroom",
  "common_area",
  "laundry_room",
  "outside",
  "whole_floor",
  "other",
  "whole_building",
];

export const ISSUE_TYPES: IssueTypeDef[] = [
  {
    id: "electricity",
    label: "Electricity",
    items: [
      {
        id: "lights",
        label: "Lights",
        team: "electrician",
        size: "S",
        problems: [
          p("not_turning_on", "Not turning on", "A"),
          p("flickering", "Flickering", "B"),
          p("very_dim", "Very dim", "B"),
          p("stays_on", "Stays on, can't switch off", "C", ["WASTE"]),
          p("hanging", "Hanging or broken fitting", "B"),
        ],
      },
      {
        id: "fan",
        label: "Fan",
        team: "electrician",
        size: "M",
        problems: [
          p("not_running", "Not running", "A"),
          p("very_slow", "Very slow", "B"),
          p("regulator", "Regulator not working", "B", undefined, "S"),
          p("noisy", "Noisy", "C", undefined, "S"),
          p("wobbling", "Wobbling or shaking", "B"),
          p("stays_on", "Can't switch off", "C", ["WASTE"], "S"),
        ],
      },
      {
        id: "switch_plug",
        label: "Switch or plug point",
        team: "electrician",
        size: "S",
        hazard: true,
        problems: [
          p("not_working", "Not working", "A"),
          p("loose", "Loose or coming out", "B"),
          p("cover_broken", "Cover broken, wires showing", "A", ["DANGER"], "L"),
          p("sparks", "Sparks or burning smell", "A", ["DANGER"], "L"),
          p("shock", "Gave a shock", "A", ["DANGER"], "L"),
        ],
      },
      {
        id: "power_supply",
        label: "Power supply",
        team: "electrician",
        size: "M",
        hazard: true,
        problems: [
          p("no_power", "No power at all", "A"),
          p("keeps_tripping", "Keeps going off and on", "B", undefined, "L"),
          p("low_voltage", "Low voltage", "B", undefined, "L"),
        ],
      },
      {
        id: "ac_cooler",
        label: "AC or cooler",
        team: "hvac",
        size: "M",
        problems: [
          p("not_turning_on", "Not turning on", "A"),
          p("not_cooling", "Not cooling", "B"),
          p("leaking", "Leaking water", "B"),
          p("noisy_smell", "Noisy or bad smell", "C", undefined, "S"),
          p("burning", "Burning smell or smoke", "A", ["DANGER"], "L"),
          p("stays_on", "Can't switch off", "C", ["WASTE"], "S"),
        ],
      },
      {
        id: "geyser",
        label: "Geyser / water heater",
        team: "electrician",
        size: "M",
        minReach: 2,
        problems: [
          p("no_hot_water", "No hot water", "A"),
          p("lukewarm", "Only lukewarm", "B"),
          p("leaking", "Leaking", "B"),
          p("shock", "Shock from tap or geyser", "A", ["DANGER"], "L"),
          p("trips_power", "Trips the power", "B"),
        ],
      },
      {
        id: "lift",
        label: "Lift",
        team: "electrician",
        size: "L",
        minReach: 3,
        areas: ["whole_building"],
        problems: [
          p("not_working", "Not working", "A"),
          p("stuck_inside", "Stuck with someone inside", "A", ["DANGER"]),
          p("doors_faulty", "Doors faulty", "B"),
          p("jerks_noise", "Jerks or strange noise", "B"),
        ],
      },
      {
        id: "washing_machine",
        label: "Washing machine",
        // Its waste is water (a leak), though the item sits under electricity.
        wasteKind: "Water",
        team: "electrician",
        size: "M",
        areas: ["laundry_room"],
        problems: [
          p("not_turning_on", "Not turning on", "A"),
          p("stops_mid_wash", "Stops mid-wash / door locked", "A"),
          p("no_water_in", "No water coming in", "A"),
          p("not_draining", "Not draining", "B"),
          p("leaking", "Leaking on the floor", "B", ["WASTE"]),
          p("not_spinning", "Not spinning", "B"),
          p("loud_noise", "Loud noise or shaking", "C", undefined, "S"),
          p("shock_sparks", "Shock, sparks or burning smell", "A", ["DANGER"], "L"),
        ],
      },
      {
        id: "other_appliance",
        label: "Other appliance (fridge, microwave, iron box)",
        team: "electrician",
        size: "S",
        problems: [
          p("not_working", "Not working", "A"),
          p("works_badly", "Works badly", "B"),
          p("sparks_shock", "Sparks, smoke or shock", "A", ["DANGER"], "L"),
        ],
      },
    ],
  },
  {
    id: "water",
    label: "Water & Plumbing",
    items: [
      {
        id: "tap",
        label: "Tap",
        team: "plumber",
        size: "S",
        problems: [
          p("no_water", "No water", "A"),
          p("very_slow", "Very slow", "B"),
          p("dripping", "Dripping", "C", ["WASTE"]),
          p("running", "Running nonstop", "B", ["WASTE"]),
          p("broken_handle", "Broken handle", "B"),
          p("dirty_smelly", "Dirty or smelly water", "B"),
        ],
      },
      {
        id: "shower",
        label: "Shower",
        team: "plumber",
        size: "S",
        problems: [
          p("no_water", "No water", "A"),
          p("very_slow", "Very slow", "B"),
          p("no_hot_water", "No hot water", "A"),
          p("dripping", "Dripping", "C", ["WASTE"]),
          p("running", "Won't stop running", "B", ["WASTE"]),
          p("broken_fitting", "Broken fitting", "B"),
        ],
      },
      {
        id: "toilet",
        label: "Toilet or flush",
        team: "plumber",
        size: "M",
        problems: [
          p("flush_not_working", "Flush not working", "A"),
          p("flush_running", "Flush keeps running", "C", ["WASTE"], "S"),
          p("blocked", "Blocked", "A", ["HEALTH"]),
          p("overflowing", "Overflowing", "A", ["HEALTH"]),
          p("bad_smell", "Very bad smell", "C", ["HEALTH"]),
          p("broken_seat", "Broken seat or cistern", "B", undefined, "S"),
        ],
      },
      {
        id: "basin",
        label: "Wash basin or sink",
        team: "plumber",
        size: "S",
        problems: [
          p("not_draining", "Not draining", "B"),
          p("leaking", "Leaking underneath", "B", ["WASTE"]),
          p("cracked", "Cracked or broken", "B"),
        ],
      },
      {
        id: "drain",
        label: "Drain",
        team: "plumber",
        size: "M",
        problems: [
          p("blocked", "Blocked, water standing", "B", ["HEALTH"]),
          p("sewage_out", "Sewage coming out", "A", ["HEALTH"], "L"),
          p("open_drain", "Open drain or missing cover", "B", ["DANGER"], "S"),
          p("sewage_smell", "Sewage smell", "C", ["HEALTH"]),
        ],
      },
      {
        id: "pipe",
        label: "Pipe, wall or ceiling",
        team: "plumber",
        size: "M",
        hazard: true,
        problems: [
          p("leaking", "Pipe leaking", "B", ["WASTE"]),
          p("burst", "Burst / gushing", "A", ["WASTE"], "L"),
          p("ceiling_drip", "Dripping from the ceiling", "B"),
          p("damp_wall", "Damp wall", "C", undefined, "L"),
        ],
      },
      {
        id: "drinking_water",
        label: "Drinking water (water cooler, RO purifier, dispenser)",
        team: "plumber",
        size: "M",
        minReach: 2,
        areas: NOT_IN_ROOM,
        problems: [
          p("no_water", "No water", "A"),
          p("not_cold", "Not cold", "C", undefined, "S"),
          p("dirty", "Dirty, cloudy or smells", "A", ["HEALTH"]),
          p("tastes_bad", "Tastes bad", "B", ["HEALTH"]),
          p("leaking", "Leaking", "B"),
          p("filter_dirty", "Filter looks dirty", "B", ["HEALTH"], "S"),
          p("shock", "Gives a shock", "A", ["DANGER"], "L"),
        ],
      },
      {
        id: "water_supply",
        label: "Water supply",
        team: "plumber",
        size: "L",
        minReach: 2,
        areas: ["whole_floor", "whole_building", "other"],
        problems: [
          p("no_water", "No water at all", "A"),
          p("low_pressure", "Very low pressure everywhere", "B"),
          p("dirty_water", "Dirty water from all taps", "A", ["HEALTH"]),
        ],
      },
      {
        id: "water_tank",
        label: "Water tank",
        team: "plumber",
        size: "L",
        minReach: 3,
        areas: ["whole_building"],
        problems: [
          p("overflowing", "Overflowing", "B", ["WASTE"]),
          p("leaking", "Leaking", "B", ["WASTE"]),
          p("lid_open_dirty", "Lid open or tank dirty", "B", ["HEALTH"]),
        ],
      },
      {
        id: "flooding",
        label: "Rainwater or flooding",
        team: "plumber",
        size: "L",
        floors: ["basement", "ground", "outside", "roof"],
        problems: [
          p("water_logging", "Water logging outside", "B"),
          p("water_entering", "Water entering the building", "A"),
          p("roof_leaking", "Roof leaking in rain", "B"),
        ],
      },
    ],
  },
  {
    id: "cleaning",
    label: "Cleaning & Garbage",
    items: [
      {
        id: "room_cleaning",
        label: "Room cleaning",
        team: "general",
        size: "S",
        areas: ["inside_room"],
        problems: [
          p("not_cleaned", "Not cleaned", "C"),
          p("dustbin_not_emptied", "Dustbin not emptied", "C"),
        ],
      },
      {
        id: "floor_cleaning",
        label: "Floor, corridor or stairs",
        team: "general",
        size: "S",
        areas: ["corridor", "stairs", "common_area", "laundry_room", "outside", "whole_floor", "other"],
        problems: [
          p("dirty_floor", "Dirty floor", "C"),
          p("garbage_lying", "Garbage lying around", "C"),
          p("spill", "Spill (water or oil)", "B"),
        ],
      },
      {
        id: "restroom_cleaning",
        label: "Restroom cleaning",
        team: "general",
        size: "S",
        areas: ["restroom"],
        problems: [
          p("not_cleaned", "Not cleaned", "C", ["HEALTH"]),
          p("bad_smell", "Bad smell", "C", ["HEALTH"]),
          p("wash_area_dirty", "Wash area or water filter dirty", "C", ["HEALTH"]),
        ],
      },
      {
        id: "garbage_bins",
        label: "Garbage bins",
        team: "general",
        size: "S",
        problems: [
          p("overflowing", "Overflowing / not collected", "B", ["HEALTH"]),
          p("no_bins", "No bins or bags", "C"),
        ],
      },
      {
        // Someone can be sent to put it out and clear it: a cleaning job,
        // not a waste signal for the Sustainability Officer.
        id: "garbage_burning",
        label: "Garbage or leaves being burned",
        team: "general",
        size: "S",
        problems: [
          p("burning_now", "Burning right now", "B", ["HEALTH"]),
          p("burned_often", "Burned here often (not right now)", "C", ["HEALTH"]),
        ],
      },
      {
        id: "one_off_mess",
        label: "One-off mess",
        team: "general",
        size: "S",
        problems: [
          p("vomit", "Vomit", "B", ["HEALTH"]),
          p("broken_glass", "Broken glass", "A", ["DANGER"]),
          p("dead_animal", "Dead bird or animal", "B", ["HEALTH"], "M"),
        ],
      },
    ],
  },
  {
    id: "waste",
    // Named for what is being wasted, so it is not mistaken for garbage
    // (that is "Cleaning & Garbage", handled by General Maintenance alone).
    label: "Energy, water or food being wasted",
    items: [
      {
        id: "left_on",
        label: "Lights, fans or AC left on",
        team: "general",
        size: "S",
        wasteKind: "Energy",
        problems: [
          p("empty_room", "On in an empty room", "C", ["WASTE"]),
          p("after_hours", "On after hours or overnight", "C", ["WASTE"]),
          p("ac_doors_open", "AC on with doors or windows open", "C", ["WASTE"]),
        ],
      },
      {
        id: "water_left_on",
        label: "Tap, shower or hose left running",
        team: "general",
        size: "S",
        wasteKind: "Water",
        problems: [
          p("left_open", "Left running, nobody using it", "C", ["WASTE"]),
          p("hose_sprinkler", "Garden hose or sprinkler left on", "C", ["WASTE"]),
        ],
      },
      {
        id: "food_waste",
        label: "Food being thrown away",
        team: "general",
        size: "S",
        alertsOfficer: true,
        wasteKind: "Food",
        problems: [
          p("uneaten", "Lots of uneaten food thrown away", "C", ["WASTE"]),
          p("unserved", "Cooked food dumped without being served", "C", ["WASTE"]),
          p("spoiled", "Food spoiled in storage", "C", ["WASTE", "HEALTH"]),
        ],
      },
      {
        id: "smoke",
        label: "Smoke or exhaust",
        team: "general",
        size: "S",
        alertsOfficer: true,
        wasteKind: "Emissions",
        problems: [
          p("generator_smoke", "Generator giving off heavy smoke", "B", ["WASTE"]),
          p("idling", "Vehicles left idling", "C", ["WASTE"]),
        ],
      },
    ],
  },
];

/** The waste kind behind an item, from the item itself or its issue type. */
export function wasteKindOf(issueTypeId?: string | null, itemId?: string | null): WasteKind | null {
  const found = itemId ? findItem(itemId) : undefined;
  if (found?.item.wasteKind) return found.item.wasteKind;
  const type = found?.type.id ?? issueTypeId;
  return type === "electricity" ? "Energy" : type === "water" ? "Water" : null;
}

/** True when a report of this item is also sent straight to the Sustainability Officer. */
export function alertsOfficer(itemId?: string | null): boolean {
  return !!(itemId && findItem(itemId)?.item.alertsOfficer);
}

export const FOLLOW_UPS: FollowUpDef[] = [
  {
    id: "lights_fans_work",
    when: { item: "lights", problem: "not_turning_on", howMany: "all" },
    question: "Do the fans or plug points here work?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    outcomes: { no: { refile: { item: "power_supply", problem: "no_power" } } },
  },
  {
    id: "tap_other_taps",
    when: { item: "tap", problem: "no_water" },
    question: "Do other taps here have water?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    outcomes: { no: { refile: { item: "water_supply", problem: "no_water" } } },
  },
  {
    id: "washer_taps",
    when: { item: "washing_machine", problem: "no_water_in" },
    question: "Do the taps in the laundry room have water?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    outcomes: { no: { refile: { item: "water_supply", problem: "no_water" } } },
  },
  {
    id: "tap_for_drinking",
    when: { item: "tap", problem: "dirty_smelly" },
    question: "Is this tap for drinking?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    outcomes: { yes: { refile: { item: "drinking_water", problem: "dirty" } } },
  },
  {
    id: "shower_no_hot_water",
    when: { item: "shower", problem: "no_hot_water" },
    question: "Is it only the hot water that is missing?",
    options: [{ value: "yes", label: "Yes" }],
    outcomes: { yes: { refile: { item: "geyser", problem: "no_hot_water" } } },
  },
  {
    id: "fan_could_fall",
    when: { item: "fan", problem: "wobbling" },
    question: "Does it look like it could fall?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    outcomes: { yes: { danger: true } },
  },
  {
    id: "water_near_electrics",
    when: {
      item: "pipe",
      problem: ["burst"],
    },
    question: "Is the water near switches, plugs or lights?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    outcomes: { yes: { danger: true, secondTeam: "electrician" } },
  },
  {
    id: "ac_leak_near_electrics",
    when: { item: "ac_cooler", problem: "leaking" },
    question: "Is the water near switches, plugs or lights?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    outcomes: { yes: { danger: true } },
  },
  {
    id: "washer_leak_near_plug",
    when: { item: "washing_machine", problem: "leaking" },
    question: "Is the water near a plug?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    outcomes: { yes: { danger: true, secondTeam: "electrician" } },
  },
  {
    id: "flood_near_electrics",
    when: { item: "flooding", problem: "water_entering" },
    question: "Is the water near switches or plugs?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    outcomes: { yes: { danger: true, secondTeam: "electrician" } },
  },
  {
    id: "ceiling_near_light",
    when: { item: "pipe", problem: "ceiling_drip" },
    question: "Is it near a light or fan?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    outcomes: { yes: { danger: true, secondTeam: "electrician" } },
  },
  {
    id: "toilet_spreading",
    when: { item: "toilet", problem: "overflowing" },
    question: "Is it spreading outside the restroom?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    outcomes: { yes: { high: true } },
  },
  {
    id: "spill_slip",
    when: { item: "floor_cleaning", problem: "spill" },
    question: "Could someone slip on it?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    outcomes: { yes: { danger: true } },
  },
];

/** "Other (type)": the team comes from the issue type; "How bad?" sets seriousness. */
export const OTHER_HOW_BAD: { value: string; label: string; seriousness: Seriousness; danger?: true }[] = [
  { value: "cant_use", label: "Can't use it", seriousness: "A" },
  { value: "works_badly", label: "Works badly", seriousness: "B" },
  { value: "small", label: "Small problem", seriousness: "C" },
  { value: "dangerous", label: "Dangerous", seriousness: "A", danger: true },
];

export const OTHER_ITEM_ID = "other";

export function findIssueType(id: string): IssueTypeDef | undefined {
  return ISSUE_TYPES.find((t) => t.id === id);
}

export function findItem(itemId: string): { type: IssueTypeDef; item: ItemDef } | undefined {
  for (const type of ISSUE_TYPES) {
    const item = type.items.find((i) => i.id === itemId);
    if (item) return { type, item };
  }
  return undefined;
}

export function findProblem(item: ItemDef, problemId: string): ProblemDef | undefined {
  return item.problems.find((x) => x.id === problemId);
}

export function findFollowUp(itemId: string, problemId: string, howMany?: string): FollowUpDef[] {
  return FOLLOW_UPS.filter((f) => {
    if (f.when.item !== itemId) return false;
    if (f.when.problem !== undefined) {
      const wanted = Array.isArray(f.when.problem) ? f.when.problem : [f.when.problem];
      if (!wanted.includes(problemId)) return false;
    }
    if (f.when.howMany !== undefined && f.when.howMany !== howMany) return false;
    return true;
  });
}

/**
 * What the student's browser is allowed to know: labels and follow-up
 * questions only. No seriousness, tags, size, team or outcomes, so nothing in
 * the payload lets anyone work out how to push a ticket up.
 */
export function publicCatalogue() {
  return {
    floors: FLOORS,
    areas: AREAS,
    parts: PARTS,
    howBad: OTHER_HOW_BAD.map(({ value, label }) => ({ value, label })),
    issueTypes: ISSUE_TYPES.map((t) => ({
      id: t.id,
      label: t.label,
      items: t.items.map((i) => ({
        id: i.id,
        label: i.label,
        areas: i.areas ?? null,
        floors: i.floors ?? null,
        problems: i.problems.map((x) => ({ id: x.id, label: x.label })),
        // The form tells the reporter the Sustainability Officer is told too.
        alertsOfficer: !!i.alertsOfficer,
        followUps: FOLLOW_UPS.filter((f) => f.when.item === i.id).map((f) => ({
          id: f.id,
          problems: f.when.problem === undefined ? null : [].concat(f.when.problem as any),
          howMany: f.when.howMany ?? null,
          question: f.question,
          options: f.options,
        })),
      })),
    })),
  };
}
