"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  getEmployeeById,
  putEmployee,
  updateEmployeeFields,
  deleteEmployee,
} from "@/lib/employees";
import { normalizeIsraeliPhone } from "@/lib/phone";

export interface EmpResult {
  ok: boolean;
  error?: string;
}

export async function saveEmployeeAction(formData: FormData): Promise<EmpResult> {
  await requireAdmin();
  const employeeId = String(formData.get("employeeId") || "").trim();
  if (!employeeId) return { ok: false, error: "מזהה עובד חובה" };

  const phoneRaw = String(formData.get("phone") || "").trim();
  const phone = phoneRaw ? normalizeIsraeliPhone(phoneRaw) : null;
  if (phoneRaw && !phone) return { ok: false, error: "מספר טלפון לא תקין" };

  const fields = {
    firstName: String(formData.get("firstName") || "").trim(),
    lastName: String(formData.get("lastName") || "").trim(),
    phone: phone || undefined,
    admin: formData.get("admin") === "on",
    showInSms: formData.get("showInSms") === "on",
    notifyLowBalance: formData.get("notifyLowBalance") === "on",
  };

  const existing = await getEmployeeById(employeeId);
  if (existing) {
    // Update editable fields only — preserve OTP/session state.
    await updateEmployeeFields(employeeId, fields);
  } else {
    await putEmployee({ employeeId, ...fields });
  }
  revalidatePath("/employees");
  return { ok: true };
}

export async function deleteEmployeeAction(employeeId: string): Promise<EmpResult> {
  await requireAdmin();
  await deleteEmployee(employeeId);
  revalidatePath("/employees");
  return { ok: true };
}
