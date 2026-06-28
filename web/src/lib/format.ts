import { TIMEZONE } from "./constants";

const TZ = TIMEZONE || "Asia/Jerusalem";

/** Format an ISO timestamp in Israel time (date + time). */
export function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", {
    timeZone: TZ,
    dateStyle: "short",
  });
}

export function formatTime(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("he-IL", {
    timeZone: TZ,
    timeStyle: "short",
  });
}
