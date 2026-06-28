import { requireAdmin } from "@/lib/auth";
import { getCampaignReport } from "@/lib/stats";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  manual: "ידני",
  weekly: "שבועי",
  welcome: "ברוך הבא",
  review: "ביקורת",
  test: "טסט",
  otp: "קוד כניסה",
  alert: "התראה",
};

export default async function ReportPage() {
  await requireAdmin();
  const campaigns = await getCampaignReport();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">דוח פעילות SMS</h1>
      <div className="card !p-0 overflow-hidden">
        {campaigns.length === 0 ? (
          <p className="faint text-sm p-6">אין פעילות עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="muted text-right" style={{ background: "var(--surface-2)" }}>
                <tr>
                  <th className="py-3 px-4 font-medium">תאריך</th>
                  <th className="py-3 px-4 font-medium">סוג</th>
                  <th className="py-3 px-4 font-medium">הודעה</th>
                  <th className="py-3 px-4 font-medium">נמענים</th>
                  <th className="py-3 px-4 font-medium">קרדיט</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.key}
                    className="align-top"
                    style={{ borderTop: "1px solid var(--border-soft)" }}
                  >
                    <td className="py-3 px-4 whitespace-nowrap muted">
                      {formatDateTime(c.sentAt)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="chip">{SOURCE_LABEL[c.source] ?? c.source}</span>
                    </td>
                    <td className="py-3 px-4 max-w-md truncate">{c.message}</td>
                    <td className="py-3 px-4">{c.recipientsCount}</td>
                    <td className="py-3 px-4">{c.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
