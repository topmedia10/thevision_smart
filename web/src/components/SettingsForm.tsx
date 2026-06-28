"use client";
import { useState } from "react";
import { SmsTextarea, BusinessInfo } from "./SmsTextarea";
import { saveSettingsAction, SettingsResult } from "@/app/(admin)/settings/actions";

export function SettingsForm({
  business,
  audience,
  alerts,
}: {
  business: BusinessInfo;
  audience: { activeMonths?: number; stoppedMonths?: number; inactiveMonths?: number };
  alerts: {
    lowBalanceThreshold?: number;
    lowBalanceMessage?: string;
    weeklyPrecheckMessage?: string;
  };
}) {
  const [b, setB] = useState<BusinessInfo>(business);
  const [active, setActive] = useState(audience.activeMonths ?? 3);
  const [stopped, setStopped] = useState(audience.stoppedMonths ?? 6);
  const [inactive, setInactive] = useState(audience.inactiveMonths ?? 12);
  const [threshold, setThreshold] = useState(alerts.lowBalanceThreshold ?? 200);
  const [lowMsg, setLowMsg] = useState(alerts.lowBalanceMessage ?? "");
  const [preMsg, setPreMsg] = useState(alerts.weeklyPrecheckMessage ?? "");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<SettingsResult | null>(null);

  const upB = (p: Partial<BusinessInfo>) => setB((x) => ({ ...x, ...p }));

  async function save() {
    setBusy(true);
    setRes(null);
    const fd = new FormData();
    fd.set("businessName", b.businessName || "");
    fd.set("businessAddress", b.businessAddress || "");
    fd.set("bookingLink", b.bookingLink || "");
    fd.set("googleReviewLink", b.googleReviewLink || "");
    fd.set("smsUnsubscribeLink", b.smsUnsubscribeLink || "");
    fd.set("activeMonths", String(active));
    fd.set("stoppedMonths", String(stopped));
    fd.set("inactiveMonths", String(inactive));
    fd.set("lowBalanceThreshold", String(threshold));
    fd.set("lowBalanceMessage", lowMsg);
    fd.set("weeklyPrecheckMessage", preMsg);
    setRes(await saveSettingsAction(fd));
    setBusy(false);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <section className="card space-y-3">
        <h2 className="font-semibold text-lg">פרטי העסק</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">שם העסק</label>
            <input className="input" value={b.businessName || ""} onChange={(e) => upB({ businessName: e.target.value })} />
          </div>
          <div>
            <label className="label">כתובת</label>
            <input className="input" value={b.businessAddress || ""} onChange={(e) => upB({ businessAddress: e.target.value })} />
          </div>
          <div>
            <label className="label">קישור לקביעת תור</label>
            <input className="input text-left" dir="ltr" value={b.bookingLink || ""} onChange={(e) => upB({ bookingLink: e.target.value })} />
          </div>
          <div>
            <label className="label">קישור לביקורת גוגל</label>
            <input className="input text-left" dir="ltr" value={b.googleReviewLink || ""} onChange={(e) => upB({ googleReviewLink: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">קישור הסרה מרשימת תפוצה</label>
            <input className="input text-left" dir="ltr" value={b.smsUnsubscribeLink || ""} onChange={(e) => upB({ smsUnsubscribeLink: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-lg">הגדרות קהל לקוחות</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">פעילים: ביקרו ב-{active} החודשים האחרונים</label>
            <input type="number" min={1} max={12} className="input" value={active} onChange={(e) => setActive(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">הפסיקו להגיע: מעל {stopped} חודשים</label>
            <input type="number" min={1} max={12} className="input" value={stopped} onChange={(e) => setStopped(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">לא פעילים: מעל {inactive} חודשים</label>
            <input type="number" min={1} max={12} className="input" value={inactive} onChange={(e) => setInactive(Number(e.target.value))} />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          &quot;הפסיקו להגיע&quot; הוא הטווח שבין הסף שלו לסף &quot;לא פעילים&quot; (חייב להיות קטן ממנו).
        </p>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-lg">התראות יתרה</h2>
        <div>
          <label className="label">שלח התראה כשהיתרה יורדת מתחת ל-</label>
          <input type="number" min={0} className="input w-40" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
        </div>
        <p className="text-xs text-gray-500">
          הערה: בהודעות התראה לאנשי צוות אין החלפת משתני לקוח (שם_פרטי וכו&apos;).
        </p>
        <div>
          <label className="label">הודעת התראת יתרה נמוכה</label>
          <SmsTextarea value={lowMsg} onChange={setLowMsg} business={b} rows={4} />
        </div>
        <div>
          <label className="label">הודעת התראה לפני שליחה שבועית</label>
          <SmsTextarea value={preMsg} onChange={setPreMsg} business={b} rows={4} />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? "שומר..." : "שמירת הגדרות"}
        </button>
        {res && (
          <span className={`text-sm ${res.ok ? "text-green-600" : "text-red-600"}`}>
            {res.ok ? "נשמר בהצלחה ✓" : res.error}
          </span>
        )}
      </div>
    </div>
  );
}
