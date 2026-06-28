import "server-only";
import { createHash, randomInt, randomBytes, timingSafeEqual } from "crypto";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import {
  getEmployeeByPhone,
  updateEmployeeFields,
  Employee,
} from "./employees";
import { normalizeIsraeliPhone } from "./phone";
import { sendOtpSms } from "./ec2";
import { getSettings, BusinessSettings } from "./settings";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function pepper(): string {
  return process.env.SESSION_SECRET || "";
}
function hash(value: string): string {
  return createHash("sha256").update(value + pepper()).digest("hex");
}
function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Step 1: phone → OTP. Returns a generic result regardless of whether the
 * number exists / is an admin (no account enumeration).
 */
export async function requestOtp(
  rawPhone: string,
): Promise<{ ok: boolean; error?: string }> {
  const phone = normalizeIsraeliPhone(rawPhone);
  if (!phone) return { ok: false, error: "מספר טלפון לא תקין" };

  const emp = await getEmployeeByPhone(phone);
  if (!emp || !emp.admin) {
    // Pretend success — don't reveal existence.
    return { ok: true };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await updateEmployeeFields(emp.employeeId, {
    otpHash: hash(code + phone),
    otpExpiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    otpAttempts: 0,
  });

  const business = await getSettings<BusinessSettings>("business");
  const brand = business.businessName ? ` ${business.businessName}` : "";
  const message = `קוד הכניסה שלך${brand}: ${code}`;
  const res = await sendOtpSms(phone, message);
  if (!res.ok) return { ok: false, error: "שליחת הקוד נכשלה, נסו שוב" };
  return { ok: true };
}

/**
 * Step 2: verify OTP → create session. Returns ok=false with a generic error
 * on any failure (wrong code, expired, too many attempts).
 */
export async function verifyOtp(
  rawPhone: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const phone = normalizeIsraeliPhone(rawPhone);
  if (!phone) return { ok: false, error: "מספר טלפון לא תקין" };

  const emp = await getEmployeeByPhone(phone);
  if (!emp || !emp.admin || !emp.otpHash || !emp.otpExpiresAt) {
    return { ok: false, error: "קוד שגוי או שפג תוקפו" };
  }
  if (new Date(emp.otpExpiresAt).getTime() < Date.now()) {
    return { ok: false, error: "קוד שגוי או שפג תוקפו" };
  }
  if ((emp.otpAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "יותר מדי ניסיונות, בקשו קוד חדש" };
  }

  const matches = safeEqualHex(hash(code + phone), emp.otpHash);
  if (!matches) {
    await updateEmployeeFields(emp.employeeId, {
      otpAttempts: (emp.otpAttempts ?? 0) + 1,
    });
    return { ok: false, error: "קוד שגוי או שפג תוקפו" };
  }

  // Success → issue a strong session token; store only its hash.
  const token = randomBytes(32).toString("hex");
  await updateEmployeeFields(emp.employeeId, {
    sessionTokenHash: hash(token),
    sessionExpiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    otpHash: "",
    otpExpiresAt: "",
    otpAttempts: 0,
  });

  const session = await getSession();
  session.phone = phone;
  session.name = [emp.firstName, emp.lastName].filter(Boolean).join(" ");
  session.token = token;
  session.loggedIn = true;
  await session.save();
  return { ok: true };
}

/** Validate the session server-side against the stored token hash + admin flag. */
export async function getCurrentEmployee(): Promise<Employee | null> {
  const session = await getSession();
  if (!session.loggedIn || !session.phone || !session.token) return null;
  const emp = await getEmployeeByPhone(session.phone);
  if (!emp || !emp.admin || !emp.sessionTokenHash || !emp.sessionExpiresAt) {
    return null;
  }
  if (new Date(emp.sessionExpiresAt).getTime() < Date.now()) return null;
  if (!safeEqualHex(hash(session.token), emp.sessionTokenHash)) return null;
  return emp;
}

/** Guard for protected routes/actions. Redirects to /login if unauthorized. */
export async function requireAdmin(): Promise<Employee> {
  const emp = await getCurrentEmployee();
  if (!emp) redirect("/login");
  return emp;
}

export async function logout(): Promise<void> {
  const session = await getSession();
  if (session.phone) {
    const emp = await getEmployeeByPhone(session.phone);
    if (emp) {
      await updateEmployeeFields(emp.employeeId, {
        sessionTokenHash: "",
        sessionExpiresAt: "",
      });
    }
  }
  session.destroy();
}
