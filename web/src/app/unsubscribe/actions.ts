"use server";
import { headers } from "next/headers";
import { normalizeIsraeliPhone } from "@/lib/phone";
import { applyUnsubscribe, verifyRecaptcha } from "@/lib/unsubscribe";

export interface UnsubResult {
  ok: boolean;
  error?: string;
}

export async function unsubscribeAction(formData: FormData): Promise<UnsubResult> {
  const phoneRaw = String(formData.get("phone") || "");
  const token = String(formData.get("recaptcha") || "");

  const h = await headers();
  const ip =
    h.get("cf-connecting-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "";

  if (!token || !(await verifyRecaptcha(token, ip))) {
    return { ok: false, error: "אימות reCAPTCHA נכשל, נסו שוב" };
  }

  const phone = normalizeIsraeliPhone(phoneRaw);
  // Always return success — never reveal whether the number existed.
  if (phone) {
    try {
      await applyUnsubscribe(phone, ip);
    } catch {
      /* swallow — still return generic success */
    }
  }
  return { ok: true };
}
