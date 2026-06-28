import "server-only";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./aws/clients";
import { TABLES } from "./constants";
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

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d;
}

/** Scan all customers (small base per business). */
async function scanAll(): Promise<Customer[]> {
  const out: Customer[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({ TableName: TABLES.customers, ExclusiveStartKey }),
    );
    for (const i of res.Items ?? []) out.push(i as Customer);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return out;
}

/** Bucket a customer by lastVisitAt against the audience thresholds. */
function bucketOf(
  c: Customer,
  audience: AudienceSettings,
): AudienceKind | null {
  if (!c.lastVisitAt) return null;
  const visit = new Date(c.lastVisitAt).getTime();
  const activeCut = monthsAgo(audience.activeMonths ?? 3).getTime();
  const stoppedCut = monthsAgo(audience.stoppedMonths ?? 6).getTime();
  const inactiveCut = monthsAgo(audience.inactiveMonths ?? 12).getTime();
  if (visit >= activeCut) return "active";
  // stopped = band between inactive threshold (older) and stopped threshold (newer)
  if (visit < stoppedCut && visit >= inactiveCut) return "stopped";
  if (visit < inactiveCut) return "inactive";
  return null; // falls in a gap (e.g. between active and stopped thresholds)
}

export interface ResolveOpts {
  audience?: AudienceKind | "all";
  employeeId?: string; // "" / "all" = no filter
  filterDays?: number; // optional: visited within the last N days
}

/**
 * Resolve manual-send recipients: audience bucket + employee + optional
 * last-N-days filter, always excluding unsubscribed.
 */
export async function resolveRecipients(
  opts: ResolveOpts,
  audienceSettings: AudienceSettings,
): Promise<Customer[]> {
  const all = await scanAll();
  const filterCut =
    opts.filterDays && opts.filterDays > 0
      ? Date.now() - opts.filterDays * 86400000
      : null;

  return all.filter((c) => {
    if (c.unsubscribe && c.unsubscribe !== "0") return false;
    if (opts.employeeId && opts.employeeId !== "all" && c.employeeId !== opts.employeeId)
      return false;
    if (opts.audience && opts.audience !== "all") {
      if (bucketOf(c, audienceSettings) !== opts.audience) return false;
    }
    if (filterCut !== null) {
      if (!c.lastVisitAt || new Date(c.lastVisitAt).getTime() < filterCut)
        return false;
    }
    return true;
  });
}

/** Count for the weekly-SMS page: lastVisitAt older than filterDays days. */
export async function countWeeklyMatch(filterDays: number): Promise<number> {
  const cut = Date.now() - filterDays * 86400000;
  const all = await scanAll();
  return all.filter(
    (c) =>
      (!c.unsubscribe || c.unsubscribe === "0") &&
      c.lastVisitAt &&
      new Date(c.lastVisitAt).getTime() < cut,
  ).length;
}

/** Map employeeId → assigned customer count (for the employees page). */
export async function customerCountsByEmployee(): Promise<Record<string, number>> {
  const all = await scanAll();
  const counts: Record<string, number> = {};
  for (const c of all) {
    if (c.employeeId) counts[c.employeeId] = (counts[c.employeeId] ?? 0) + 1;
  }
  return counts;
}
