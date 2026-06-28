import "server-only";
import { EC2_API_BASE, EC2_API_TOKEN } from "./constants";

/** Call the EC2 HTTP API (the only host whitelisted at Global SMS). */
async function ec2Fetch(path: string, init?: RequestInit) {
  if (!EC2_API_BASE || !EC2_API_TOKEN) {
    throw new Error("EC2_API_BASE / EC2_API_TOKEN not configured");
  }
  return fetch(`${EC2_API_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${EC2_API_TOKEN}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

export async function fetchBalance(): Promise<
  { ok: true; balance: number } | { ok: false; error: string }
> {
  try {
    const res = await ec2Fetch("/balance");
    const data = await res.json();
    return data;
  } catch (e) {
    return { ok: false, error: `שגיאת תקשורת מול שרת ה-SMS` };
  }
}

export async function sendOtpSms(
  phone: string,
  message: string,
): Promise<{ ok: true; credits: number } | { ok: false; error: string }> {
  try {
    const res = await ec2Fetch("/send-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: "שגיאת תקשורת מול שרת ה-SMS" };
  }
}
