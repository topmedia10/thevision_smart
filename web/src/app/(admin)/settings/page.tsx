import { requireAdmin } from "@/lib/auth";
import {
  getSettings,
  BusinessSettings,
  AudienceSettings,
  AlertsSettings,
} from "@/lib/settings";
import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const [business, audience, alerts] = await Promise.all([
    getSettings<BusinessSettings>("business"),
    getSettings<AudienceSettings>("audience"),
    getSettings<AlertsSettings>("alerts"),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">הגדרות</h1>
      <SettingsForm business={business} audience={audience} alerts={alerts} />
    </div>
  );
}
