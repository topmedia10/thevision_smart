"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { putSettings, getSettings, AudienceSettings } from "@/lib/settings";

export interface SettingsResult {
  ok: boolean;
  error?: string;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

export async function saveSettingsAction(
  formData: FormData,
): Promise<SettingsResult> {
  await requireAdmin();

  await putSettings("business", {
    businessName: String(formData.get("businessName") || "").trim(),
    businessAddress: String(formData.get("businessAddress") || "").trim(),
    bookingLink: String(formData.get("bookingLink") || "").trim(),
    googleReviewLink: String(formData.get("googleReviewLink") || "").trim(),
    smsUnsubscribeLink: String(formData.get("smsUnsubscribeLink") || "").trim(),
  });

  const active = clamp(Number(formData.get("activeMonths") || 3), 1, 12);
  const stopped = clamp(Number(formData.get("stoppedMonths") || 6), 1, 12);
  const inactive = clamp(Number(formData.get("inactiveMonths") || 12), 1, 12);
  if (!(stopped < inactive)) {
    return {
      ok: false,
      error: "סף 'הפסיקו להגיע' חייב להיות קטן מסף 'לא פעילים'",
    };
  }
  await putSettings("audience", {
    activeMonths: active,
    stoppedMonths: stopped,
    inactiveMonths: inactive,
  } satisfies AudienceSettings);

  await putSettings("alerts", {
    lowBalanceThreshold: Math.max(0, Number(formData.get("lowBalanceThreshold") || 0)),
    lowBalanceMessage: String(formData.get("lowBalanceMessage") || ""),
    weeklyPrecheckMessage: String(formData.get("weeklyPrecheckMessage") || ""),
  });

  revalidatePath("/settings");
  return { ok: true };
}

// Re-export for potential reuse
export async function currentAudience(): Promise<AudienceSettings> {
  return getSettings<AudienceSettings>("audience");
}
