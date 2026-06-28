import { requireAdmin } from "@/lib/auth";
import { getSettings, WeeklyPushSettings, BusinessSettings } from "@/lib/settings";
import { WeeklyPushForm } from "@/components/AutomationForms";

export const dynamic = "force-dynamic";

export default async function WeeklyPushPage() {
  await requireAdmin();
  const [weekly, business] = await Promise.all([
    getSettings<WeeklyPushSettings>("weeklyPush"),
    getSettings<BusinessSettings>("business"),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">אוטומציית פוש שבועי</h1>
      <WeeklyPushForm initial={weekly} businessName={business.businessName} />
    </div>
  );
}
