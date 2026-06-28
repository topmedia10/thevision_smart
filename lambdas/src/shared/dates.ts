/**
 * Global SMS / booking webhook dates arrive as `dd/MM/yyyy HH:mm` in local
 * (Asia/Jerusalem) wall-clock time. We store everything as ISO 8601 UTC.
 *
 * Asia/Jerusalem is UTC+2 (IST) / UTC+3 (IDT). To convert a wall-clock local
 * time to a correct UTC instant we use the timezone offset for that date.
 */

const TZ = "Asia/Jerusalem";

/** Offset in minutes that must be SUBTRACTED from local wall-clock to get UTC. */
function jerusalemOffsetMinutes(utcGuess: Date): number {
  // Use Intl to read what the wall-clock would be in Jerusalem for this instant,
  // then derive the offset.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(utcGuess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return (asUtc - utcGuess.getTime()) / 60000;
}

/** Parse `dd/MM/yyyy HH:mm` (Jerusalem local) → ISO UTC string. */
export function parseLocalDateTimeToIso(input: string): string {
  const m = input
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) throw new Error(`Unparseable date: "${input}"`);
  const [, dd, MM, yyyy, HH, mm, ss] = m;
  // First assume the local wall-clock equals UTC, then correct by the offset.
  const naiveUtc = Date.UTC(
    Number(yyyy),
    Number(MM) - 1,
    Number(dd),
    Number(HH),
    Number(mm),
    Number(ss ?? "0"),
  );
  const offset = jerusalemOffsetMinutes(new Date(naiveUtc));
  return new Date(naiveUtc - offset * 60000).toISOString();
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** ISO string for `now - days`. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

/** yyyy-mm-dd in Jerusalem local time (for daily dedup keys). */
export function jerusalemDateKey(d: Date = new Date()): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(d); // en-CA → yyyy-mm-dd
}
