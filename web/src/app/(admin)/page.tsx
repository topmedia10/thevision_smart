import { requireAdmin } from "@/lib/auth";
import { fetchBalance } from "@/lib/ec2";
import { getSettings, RuntimeSettings } from "@/lib/settings";
import { getCustomersCount, getRecentActivity } from "@/lib/stats";
import { formatDate, formatTime } from "@/lib/format";
import { ActivityTable } from "@/components/ActivityTable";

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
  const color =
    tone === "brand" ? "#928ff8" : tone === "warn" ? "#fbbf24" : "var(--text)";
  return (
    <div className="card">
      <div className="muted text-sm">{title}</div>
      <div className="text-3xl font-bold mt-1.5" style={{ color }}>
        {value}
      </div>
      {hint && <div className="faint text-xs mt-1">{hint}</div>}
    </div>
  );
}

export default async function Dashboard() {
  const emp = await requireAdmin();
  const [balance, runtime, customers, activity] = await Promise.all([
    fetchBalance(),
    getSettings<RuntimeSettings>("runtime"),
    getCustomersCount(),
    getRecentActivity(50),
  ]);

  const name = [emp.firstName, emp.lastName].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ברוך הבא, {name} 👋</h1>
        <p className="muted">מבט מהיר על המערכת</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="יתרת SMS"
          value={balance.ok ? String(balance.balance) : "—"}
          hint={balance.ok ? "יתרה זמינה" : balance.error}
          tone={balance.ok ? "brand" : "warn"}
        />
        <StatCard
          title="פוש אחרון נשלח"
          value={runtime.lastPushSentAt ? formatDate(runtime.lastPushSentAt) : "—"}
          hint={runtime.lastPushSentAt ? formatTime(runtime.lastPushSentAt) : "טרם נשלח"}
          tone="brand"
        />
        <StatCard title="סך הלקוחות" value={String(customers)} />
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">פעילות אחרונה</h2>
        <ActivityTable rows={activity} />
      </div>
    </div>
  );
}
