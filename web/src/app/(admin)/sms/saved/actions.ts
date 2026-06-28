"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  upsertSavedMessage,
  deleteSavedMessage,
} from "@/lib/savedMessages";

export async function saveMessageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") || "") || undefined;
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  if (!title || !body) return { ok: false, error: "יש למלא כותרת ותוכן" };
  await upsertSavedMessage(title, body, id);
  revalidatePath("/sms/saved");
  return { ok: true };
}

export async function deleteMessageAction(id: string) {
  await requireAdmin();
  await deleteSavedMessage(id);
  revalidatePath("/sms/saved");
  return { ok: true };
}
