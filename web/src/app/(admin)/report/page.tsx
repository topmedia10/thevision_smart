import { requireAdmin } from "@/lib/auth";
import { getCampaignReport } from "@/lib/stats";
import { ActivityTable } from "@/components/ActivityTable";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  await requireAdmin();
  const campaigns = await getCampaignReport();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">דוח פעילות SMS</h1>
      <ActivityTable
        rows={campaigns.map((c) => ({
          sentAt: c.sentAt,
          source: c.source,
          message: c.message,
          recipientsCount: c.recipientsCount,
          credits: c.credits,
        }))}
        showRecipients
      />
    </div>
  );
}
