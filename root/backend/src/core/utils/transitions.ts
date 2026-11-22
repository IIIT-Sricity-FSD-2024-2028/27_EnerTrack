import { ForbiddenException } from "@nestjs/common";

/**
 * A workflow's allowed moves for one group of roles: from-status → the
 * statuses that group may move a record to.
 */
export interface MoveTable {
  roles: string[];
  moves: Record<string, string[]>;
}

/**
 * Throws 403 unless `role` may move a record from `from` to `to` under one of
 * the tables. Moving to the same status is not a move and is always allowed,
 * so editing a record's other fields never trips this.
 *
 * The message names what was tried and what is allowed, so a refused request
 * explains itself.
 */
export function assertMove(
  tables: MoveTable[],
  role: string | undefined,
  from: string,
  to: string,
  /** With its article: "a wastage report", "an initiative". */
  what = "a record",
): void {
  if (from === to) return;
  const allowed = new Set<string>();
  for (const table of tables) {
    if (!role || !table.roles.includes(role)) continue;
    for (const next of table.moves[from] ?? []) allowed.add(next);
  }
  if (allowed.has(to)) return;
  const options = [...allowed];
  throw new ForbiddenException(
    `${role ?? "This role"} cannot move ${what} from '${from}' to '${to}'.` +
      (options.length ? ` Allowed next: ${options.map((s) => `'${s}'`).join(", ")}.` : " No move is allowed from here."),
  );
}
