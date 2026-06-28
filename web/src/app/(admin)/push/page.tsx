import { requireAdmin } from "@/lib/auth";
import { getSettings, RuntimeSettings, BusinessSettings } from "@/lib/settings";
import { PushForm } from "@/components/PushForm";

export const dynamic = "force-dynamic";

export default async function PushPage() {
  await requireAdmin();
  const [runtime, business] = await Promise.all([
    getSettings<RuntimeSettings>("runtime"),
    getSettings<BusinessSettings>("business"),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">שליחת פוש</h1>
      <PushForm lastSentAt={runtime.lastPushSentAt} businessName={business.businessName} />
    </div>
  );
}
