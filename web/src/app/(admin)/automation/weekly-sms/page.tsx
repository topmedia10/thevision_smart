import { requireAdmin } from "@/lib/auth";
import { getSettings, BusinessSettings, WeeklySmsSettings } from "@/lib/settings";
import { countWeeklyMatch } from "@/lib/customers";
import { WeeklySmsForm } from "@/components/AutomationForms";

export const dynamic = "force-dynamic";

export default async function WeeklySmsPage() {
  await requireAdmin();
  const [business, weekly] = await Promise.all([
    getSettings<BusinessSettings>("business"),
    getSettings<WeeklySmsSettings>("weeklySms"),
  ]);
  const matchCount = await countWeeklyMatch(weekly.filterDays ?? 1);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">אוטומציית SMS שבועי</h1>
      <WeeklySmsForm business={business} initial={weekly} matchCount={matchCount} />
    </div>
  );
}
