"use server";
import { requestOtp, verifyOtp } from "@/lib/auth";

export async function requestOtpAction(_prev: unknown, formData: FormData) {
  const phone = String(formData.get("phone") || "");
  const res = await requestOtp(phone);
  return { step: res.ok ? "otp" : "phone", phone, error: res.error };
}

export async function verifyOtpAction(_prev: unknown, formData: FormData) {
  const phone = String(formData.get("phone") || "");
  const code = String(formData.get("code") || "");
  const res = await verifyOtp(phone, code);
  if (res.ok) return { step: "done", phone, error: undefined };
  return { step: "otp", phone, error: res.error };
}
