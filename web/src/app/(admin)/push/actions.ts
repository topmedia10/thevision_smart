"use server";
import { requireAdmin } from "@/lib/auth";
import { invokeSendPush, PushResult } from "@/lib/lambda";

export async function sendPushAction(formData: FormData): Promise<PushResult> {
  await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!title || !body) return { ok: false, error: "יש למלא כותרת ותוכן" };
  return invokeSendPush(title, body);
}
