import "server-only";
import { ScanCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./aws/clients";
import { TABLES, INDEXES } from "./constants";
import { AudienceSettings } from "./settings";

export interface Customer {
  phone: string;
  firstName?: string;
  lastName?: string;
  employeeId?: string;
  lastAppointmentEnd?: string;
  lastVisitAt?: string;
  unsubscribe?: string;
}

export type AudienceKind = "active" | "stopped" | "inactive";

function monthsAgoIso(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

export interface ResolveOpts {
  audience?: AudienceKind | "all";
  employeeId?: string; // "" / "all" = no filter
  filterDays?: number; // exclude customers who visited within the last N days
}

/**
 * Compute the lastVisitAt [lo, hi) bounds for an audience + days filter.
 *   active   : visited within activeMonths            → lo = activeCut
 *   stopped  : between inactiveMonths and activeMonths → [inactiveCut, activeCut)
 *   inactive : older than inactiveMonths              → hi = inactiveCut
 * Days filter EXCLUDES recent visitors → upper bound capped at (now - days).
 */
function audienceRange(
  audience: ResolveOpts["audience"],
  s: AudienceSettings,
  filterDays?: number,
): { lo: string | null; hi: string | null } {
  const activeCut = monthsAgoIso(s.activeMonths ?? 3);
  const inactiveCut = monthsAgoIso(s.inactiveMonths ?? 12);
  let lo: string | null = null;
  let hi: string | null = null;
  if (audience === "active") lo = activeCut;
  else if (audience === "stopped") {
    lo = inactiveCut;
    hi = activeCut;
  } else if (audience === "inactive") hi = inactiveCut;

  if (filterDays && filterDays > 0) {
    const daysCut = new Date(Date.now() - filterDays * 86400000).toISOString();
    hi = hi === null ? daysCut : daysCut < hi ? daysCut : hi;
  }
  return { lo, hi };
}

async function runAudienceQuery(
  opts: ResolveOpts,
  s: AudienceSettings,
  count: boolean,
): Promise<Customer[] | number> {
  const { lo, hi } = audienceRange(opts.audience, s, opts.filterDays);
  if (lo !== null && hi !== null && lo > hi) return count ? 0 : []; // empty range

  // Sort-key condition on lastVisitAt.
  let sk = "";
  const values: Record<string, unknown> = { ":u": "0" };
  if (lo !== null && hi !== null) {
    sk = " AND lastVisitAt BETWEEN :lo AND :hi";
    values[":lo"] = lo;
    values[":hi"] = hi;
  } else if (lo !== null) {
    sk = " AND lastVisitAt >= :lo";
    values[":lo"] = lo;
  } else if (hi !== null) {
    sk = " AND lastVisitAt < :hi";
    values[":hi"] = hi;
  }

  const names: Record<string, string> = {};
  let filter: string | undefined;
  if (opts.employeeId && opts.employeeId !== "all") {
    filter = "#e = :e";
    names["#e"] = "employeeId";
    values[":e"] = opts.employeeId;
  }

  const items: Customer[] = [];
  let total = 0;
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: TABLES.customers,
        IndexName: INDEXES.audienceIndex,
        KeyConditionExpression: `unsubscribe = :u${sk}`,
        FilterExpression: filter,
        ExpressionAttributeNames: Object.keys(names).length ? names : undefined,
        ExpressionAttributeValues: values,
        Select: count ? "COUNT" : undefined,
        ExclusiveStartKey,
      }),
    );
    if (count) total += res.Count ?? 0;
    else for (const i of res.Items ?? []) items.push(i as Customer);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  return count ? total : items;
}

/** Manual-send recipients: audience + employee + days, excluding unsubscribed. */
export async function resolveRecipients(
  opts: ResolveOpts,
  s: AudienceSettings,
): Promise<Customer[]> {
  return (await runAudienceQuery(opts, s, false)) as Customer[];
}

export async function countManual(opts: ResolveOpts, s: AudienceSettings): Promise<number> {
  return (await runAudienceQuery(opts, s, true)) as number;
}

/** Weekly count: audience + days (no employee), excluding unsubscribed. */
export async function countWeekly(
  filterDays: number,
  audience: AudienceKind | "all",
  s: AudienceSettings,
): Promise<number> {
  return (await runAudienceQuery({ audience, employeeId: "all", filterDays }, s, true)) as number;
}

/** Total customers per employee (stats — full scan, runs once per page). */
export async function customerCountsByEmployee(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: TABLES.customers,
        ProjectionExpression: "employeeId",
        ExclusiveStartKey,
      }),
    );
    for (const i of res.Items ?? []) {
      const e = (i as Customer).employeeId;
      if (e) counts[e] = (counts[e] ?? 0) + 1;
    }
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return counts;
}
