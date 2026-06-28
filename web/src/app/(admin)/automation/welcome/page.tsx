import { requireAdmin } from "@/lib/auth";
import { getSettings, BusinessSettings, WelcomeSettings } from "@/lib/settings";
import { WelcomeForm } from "@/components/AutomationForms";

export const dynamic = "force-dynamic";

export default async function WelcomeAutomationPage() {
  await requireAdmin();
  const [business, welcome] = await Promise.all([
    getSettings<BusinessSettings>("business"),
    getSettings<WelcomeSettings>("welcome"),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">אוטומציית ברוך הבא</h1>
      <WelcomeForm business={business} initial={welcome} />
    </div>
  );
}
