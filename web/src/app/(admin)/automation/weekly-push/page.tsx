import { requireAdmin } from "@/lib/auth";
import { getSettings, WeeklyPushSettings } from "@/lib/settings";
import { WeeklyPushForm } from "@/components/AutomationForms";

export const dynamic = "force-dynamic";

export default async function WeeklyPushPage() {
  await requireAdmin();
  const weekly = await getSettings<WeeklyPushSettings>("weeklyPush");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">אוטומציית פוש שבועי</h1>
      <WeeklyPushForm initial={weekly} />
    </div>
  );
}
