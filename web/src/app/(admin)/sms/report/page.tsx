import { requireAdmin } from "@/lib/auth";
import { getCampaignReport } from "@/lib/stats";

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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">דוח פעילות SMS</h1>
      <div className="card">
        {campaigns.length === 0 ? (
          <p className="text-gray-400 text-sm">אין פעילות עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-right border-b border-gray-100">
                <tr>
                  <th className="py-2 font-medium">תאריך</th>
                  <th className="py-2 font-medium">סוג</th>
                  <th className="py-2 font-medium">הודעה</th>
                  <th className="py-2 font-medium">נמענים</th>
                  <th className="py-2 font-medium">קרדיט</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.key} className="border-t border-gray-50 align-top">
                    <td className="py-2 whitespace-nowrap text-gray-600">
                      {new Date(c.sentAt).toLocaleString("he-IL")}
                    </td>
                    <td className="py-2">{SOURCE_LABEL[c.source] ?? c.source}</td>
                    <td className="py-2 max-w-md truncate">{c.message}</td>
                    <td className="py-2">{c.recipientsCount}</td>
                    <td className="py-2">{c.credits}</td>
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
