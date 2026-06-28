"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { putSettings, getSettings, AudienceSettings } from "@/lib/settings";
import { countWeekly, AudienceKind } from "@/lib/customers";
import {
  updateWeeklySmsSchedules,
  updateWeeklyPushSchedule,
} from "@/lib/scheduler";

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export async function saveWelcomeAction(formData: FormData): Promise<SaveResult> {
  await requireAdmin();
  await putSettings("welcome", {
    enabled: formData.get("enabled") === "on",
    message: String(formData.get("message") || ""),
  });
  revalidatePath("/automation/welcome");
  return { ok: true };
}

export async function saveReviewsAction(formData: FormData): Promise<SaveResult> {
  await requireAdmin();
  const delayMinutes = Math.max(0, Math.min(99, Number(formData.get("delayMinutes") || 0)));
  await putSettings("reviews", {
    enabled: formData.get("enabled") === "on",
    delayMinutes,
    message: String(formData.get("message") || ""),
  });
  revalidatePath("/automation/reviews");
  return { ok: true };
}

export async function saveWeeklySmsAction(formData: FormData): Promise<SaveResult> {
  await requireAdmin();
  const dayOfWeek = Number(formData.get("dayOfWeek") || 0);
  const time = String(formData.get("time") || "09:00");
  const filterDays = Math.max(1, Math.min(10, Number(formData.get("filterDays") || 1)));
  await putSettings("weeklySms", {
    enabled: formData.get("enabled") === "on",
    dayOfWeek,
    time,
    filterDays,
    audience: String(formData.get("audience") || "all"),
    message: String(formData.get("message") || ""),
  });
  try {
    await updateWeeklySmsSchedules(dayOfWeek, time);
  } catch (e) {
    return { ok: false, error: `נשמר, אך עדכון התזמון נכשל: ${String(e)}` };
  }
  revalidatePath("/automation/weekly-sms");
  return { ok: true };
}

export async function countWeeklyAction(input: {
  audience: string;
  filterDays: number;
}): Promise<number> {
  await requireAdmin();
  const audienceSettings = await getSettings<AudienceSettings>("audience");
  return countWeekly(
    input.filterDays,
    input.audience as AudienceKind | "all",
    audienceSettings,
  );
}

export async function saveWeeklyPushAction(formData: FormData): Promise<SaveResult> {
  await requireAdmin();
  const dayOfWeek = Number(formData.get("dayOfWeek") || 0);
  const time = String(formData.get("time") || "09:00");
  await putSettings("weeklyPush", {
    enabled: formData.get("enabled") === "on",
    dayOfWeek,
    time,
    title: String(formData.get("title") || ""),
    body: String(formData.get("body") || ""),
  });
  try {
    await updateWeeklyPushSchedule(dayOfWeek, time);
  } catch (e) {
    return { ok: false, error: `נשמר, אך עדכון התזמון נכשל: ${String(e)}` };
  }
  revalidatePath("/automation/weekly-push");
  return { ok: true };
}
