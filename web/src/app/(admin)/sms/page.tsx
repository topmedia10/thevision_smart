import { requireAdmin } from "@/lib/auth";
import {
  getSettings,
  BusinessSettings,
  RuntimeSettings,
} from "@/lib/settings";
import { listSavedMessages } from "@/lib/savedMessages";
import { listEmployees } from "@/lib/employees";
import { SendSmsForm } from "@/components/SendSmsForm";

export const dynamic = "force-dynamic";

export default async function SmsPage() {
  await requireAdmin();
  const [business, saved, employees, runtime] = await Promise.all([
    getSettings<BusinessSettings>("business"),
    listSavedMessages(),
    listEmployees(),
    getSettings<RuntimeSettings>("runtime"),
  ]);

  const smsEmployees = employees
    .filter((e) => e.showInSms)
    .map((e) => ({
      employeeId: e.employeeId,
      name: [e.firstName, e.lastName].filter(Boolean).join(" ") || e.employeeId,
    }));

  const defaults = (runtime.lastManualSms ?? {}) as {
    message?: string;
    employeeId?: string;
    audience?: string;
    filterDays?: number;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">שליחת SMS</h1>
      <SendSmsForm
        business={business}
        saved={saved.map((s) => ({ id: s.id, title: s.title, body: s.body }))}
        employees={smsEmployees}
        defaults={defaults}
      />
    </div>
  );
}
