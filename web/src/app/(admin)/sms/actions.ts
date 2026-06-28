"use server";
import { v4 as uuid } from "uuid";
import { requireAdmin } from "@/lib/auth";
import { listEmployees } from "@/lib/employees";
import { getSettings, AudienceSettings, patchSettings } from "@/lib/settings";
import { resolveRecipients, countManual, AudienceKind } from "@/lib/customers";
import { enqueueSms, SmsJob } from "@/lib/sqs";
import { renderMessage } from "@/lib/vars";

export interface SendResult {
  ok: boolean;
  count?: number;
  error?: string;
}

export async function sendManualAction(formData: FormData): Promise<SendResult> {
  await requireAdmin();
  const message = String(formData.get("message") || "").trim();
  const employeeId = String(formData.get("employeeId") || "all");
  const audience = String(formData.get("audience") || "all") as
    | AudienceKind
    | "all";
  const filterDays = Number(formData.get("filterDays") || 0);

  if (!message) return { ok: false, error: "ההודעה ריקה" };

  const audienceSettings = await getSettings<AudienceSettings>("audience");
  const recipients = await resolveRecipients(
    { audience, employeeId, filterDays },
    audienceSettings,
  );
  if (!recipients.length) return { ok: false, error: "לא נמצאו נמענים מתאימים" };

  const employees = await listEmployees();
  const empById = new Map(employees.map((e) => [e.employeeId, e]));

  const batchId = `manual-${uuid().slice(0, 8)}`;
  const jobs: SmsJob[] = recipients.map((c) => {
    const emp = c.employeeId ? empById.get(c.employeeId) : undefined;
    return {
      to: c.phone,
      body: renderMessage(message, {
        customerFirstName: c.firstName,
        customerLastName: c.lastName,
        employeeFirstName: emp?.firstName,
        employeeLastName: emp?.lastName,
      }),
      dedupKey: `manual#${batchId}#${c.phone}`,
      source: "manual",
      batchId,
    };
  });
  await enqueueSms(jobs);

  // Remember last manual send for default prefill next time.
  await patchSettings("runtime", {
    lastManualSms: { message, employeeId, audience, filterDays },
  });

  return { ok: true, count: jobs.length };
}

export async function countManualAction(input: {
  audience: string;
  employeeId: string;
  filterDays: number;
}): Promise<number> {
  await requireAdmin();
  const audienceSettings = await getSettings<AudienceSettings>("audience");
  return countManual(
    {
      audience: input.audience as AudienceKind | "all",
      employeeId: input.employeeId,
      filterDays: input.filterDays,
    },
    audienceSettings,
  );
}

export async function sendTestAction(formData: FormData): Promise<SendResult> {
  const emp = await requireAdmin();
  const message = String(formData.get("message") || "").trim();
  if (!message) return { ok: false, error: "ההודעה ריקה" };
  if (!emp.phone) return { ok: false, error: "אין מספר טלפון למשתמש" };

  const body = renderMessage(message, {
    customerFirstName: emp.firstName,
    customerLastName: emp.lastName,
    employeeFirstName: emp.firstName,
    employeeLastName: emp.lastName,
  });
  await enqueueSms([
    {
      to: emp.phone,
      body,
      dedupKey: `test#${emp.phone}#${uuid()}`,
      source: "test",
    },
  ]);
  return { ok: true, count: 1 };
}
