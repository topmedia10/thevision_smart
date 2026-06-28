import { requireAdmin } from "@/lib/auth";
import { fetchBalance } from "@/lib/ec2";
import { getSettings, RuntimeSettings } from "@/lib/settings";
import { getCustomersCount, getRecentActivity } from "@/lib/stats";

export const dynamic = "force-dynamic";

function StatCard({
  title,
  value,
  hint,
  tone = "default",
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: "default" | "brand" | "warn";
}) {
  const toneClass =
    tone === "brand"
      ? "text-brand-600"
      : tone === "warn"
        ? "text-amber-600"
        : "text-gray-900";
  return (
    <div className="card">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-3xl font-bold mt-1 ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

export default async function Dashboard() {
  const emp = await requireAdmin();
  const [balance, runtime, customers, activity] = await Promise.all([
    fetchBalance(),
    getSettings<RuntimeSettings>("runtime"),
    getCustomersCount(),
    getRecentActivity(8),
  ]);

  const name = [emp.firstName, emp.lastName].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ברוך הבא, {name} 👋</h1>
        <p className="text-gray-500">מבט מהיר על המערכת</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="יתרת SMS"
          value={balance.ok ? String(balance.balance) : "—"}
          hint={balance.ok ? "יתרה זמינה" : balance.error}
          tone={balance.ok ? "brand" : "warn"}
        />
        <StatCard
          title="פוש אחרון נשלח"
          value={
            runtime.lastPushSentAt
              ? new Date(runtime.lastPushSentAt).toLocaleDateString("he-IL")
              : "—"
          }
          hint={
            runtime.lastPushSentAt
              ? new Date(runtime.lastPushSentAt).toLocaleTimeString("he-IL")
              : "טרם נשלח"
          }
          tone="brand"
        />
        <StatCard title="סך הלקוחות" value={String(customers)} />
        <StatCard
          title="הודעות אחרונות"
          value={String(activity.length)}
          hint="רשומות אחרונות ביומן"
        />
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">פעילות אחרונה</h2>
        {activity.length === 0 ? (
          <p className="text-gray-400 text-sm">אין פעילות עדיין</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-right">
                <tr>
                  <th className="py-2 font-medium">תאריך</th>
                  <th className="py-2 font-medium">מקור</th>
                  <th className="py-2 font-medium">הודעה</th>
                  <th className="py-2 font-medium">קרדיט</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((a, i) => (
                  <tr key={i} className="border-t border-gray-50">
                    <td className="py-2 whitespace-nowrap text-gray-600">
                      {new Date(a.sentAt).toLocaleString("he-IL")}
                    </td>
                    <td className="py-2">{a.source}</td>
                    <td className="py-2 max-w-xs truncate">{a.message}</td>
                    <td className="py-2">{a.credits ?? "—"}</td>
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
