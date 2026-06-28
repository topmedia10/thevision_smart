import { requireAdmin } from "@/lib/auth";
import { getSettings, RuntimeSettings } from "@/lib/settings";
import { PushForm } from "@/components/PushForm";

export const dynamic = "force-dynamic";

export default async function PushPage() {
  await requireAdmin();
  const runtime = await getSettings<RuntimeSettings>("runtime");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">שליחת פוש</h1>
      <PushForm lastCount={runtime.lastPushCount ?? 0} />
    </div>
  );
}
