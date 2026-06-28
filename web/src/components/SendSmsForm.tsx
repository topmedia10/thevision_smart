"use client";
import { useState } from "react";
import { SmsTextarea, BusinessInfo } from "./SmsTextarea";
import { PhonePreview } from "./PhonePreview";
import { sendManualAction, sendTestAction, SendResult } from "@/app/(admin)/sms/actions";

interface SavedMsg { id: string; title: string; body: string }
interface EmpOpt { employeeId: string; name: string }

export function SendSmsForm({
  business,
  saved,
  employees,
  defaults,
}: {
  business: BusinessInfo;
  saved: SavedMsg[];
  employees: EmpOpt[];
  defaults: {
    message?: string;
    employeeId?: string;
    audience?: string;
    filterDays?: number;
  };
}) {
  const [message, setMessage] = useState(defaults.message || "");
  const [employeeId, setEmployeeId] = useState(defaults.employeeId || "all");
  const [audience, setAudience] = useState(defaults.audience || "all");
  const [filterDays, setFilterDays] = useState(defaults.filterDays || 0);
  const [busy, setBusy] = useState<"send" | "test" | null>(null);
  const [result, setResult] = useState<SendResult | null>(null);

  function buildForm() {
    const fd = new FormData();
    fd.set("message", message);
    fd.set("employeeId", employeeId);
    fd.set("audience", audience);
    fd.set("filterDays", String(filterDays));
    return fd;
  }

  async function onSend() {
    if (!confirm("לשלוח את ההודעה לכל הנמענים שתואמים את הסינון?")) return;
    setBusy("send");
    setResult(null);
    const r = await sendManualAction(buildForm());
    setResult(r);
    setBusy(null);
  }
  async function onTest() {
    setBusy("test");
    setResult(null);
    const r = await sendTestAction(buildForm());
    setResult(r);
    setBusy(null);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        <div>
          <label className="label">הודעה שמורה</label>
          <select
            className="input"
            value=""
            onChange={(e) => {
              const m = saved.find((s) => s.id === e.target.value);
              if (m) setMessage(m.body);
            }}
          >
            <option value="">בחרו הודעה שמורה...</option>
            {saved.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">מסתפרים אצל</label>
            <select
              className="input"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="all">כל הספרים</option>
              {employees.map((e) => (
                <option key={e.employeeId} value={e.employeeId}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">קהל לקוחות</label>
            <select
              className="input"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="all">כל הלקוחות</option>
              <option value="active">פעילים</option>
              <option value="stopped">הפסיקו להגיע</option>
              <option value="inactive">לא פעילים</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">תוכן ההודעה</label>
          <SmsTextarea value={message} onChange={setMessage} business={business} />
        </div>

        <div>
          <label className="label">
            סינון תורים מ-{filterDays || "—"} הימים האחרונים (0 = ללא סינון)
          </label>
          <input
            type="range"
            min={0}
            max={10}
            value={filterDays}
            onChange={(e) => setFilterDays(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <p className="text-xs text-amber-600">
          ⚠️ תזכורת: הודעות שיווקיות מחויבות לכלול את המילה &quot;פרסומת&quot;,
          את שם העסק ואפשרות הסרה.
        </p>

        <div className="flex gap-3">
          <button className="btn-primary" onClick={onSend} disabled={busy !== null}>
            {busy === "send" ? "שולח..." : "שלח הודעה"}
          </button>
          <button className="btn-secondary" onClick={onTest} disabled={busy !== null}>
            {busy === "test" ? "שולח טסט..." : "שלח טסט"}
          </button>
        </div>

        {result && (
          <div
            className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}
          >
            {result.ok
              ? `נשלח בהצלחה ל-${result.count} נמענים (ההודעות בתור השליחה)`
              : result.error}
          </div>
        )}
      </div>

      <PhonePreview sender={business.businessName || "TheVision"} message={message} />
    </div>
  );
}
