"use client";
import { useEffect, useState } from "react";
import { SmsTextarea, BusinessInfo } from "./SmsTextarea";
import { PhonePreview } from "./PhonePreview";
import { PushPreview } from "./PushPreview";
import {
  saveWelcomeAction,
  saveReviewsAction,
  saveWeeklySmsAction,
  saveWeeklyPushAction,
  countWeeklyAction,
  SaveResult,
} from "@/app/(admin)/automation/actions";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const AUD_LABEL: Record<string, string> = {
  all: "כל הלקוחות",
  active: "פעילים",
  stopped: "הפסיקו להגיע",
  inactive: "לא פעילים",
};

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span
        className="relative inline-flex h-6 w-11 items-center rounded-full transition"
        style={{ background: checked ? "var(--brand)" : "var(--surface-3)" }}
        onClick={() => onChange(!checked)}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
            checked ? "-translate-x-5" : "-translate-x-0.5"
          }`}
        />
      </span>
      <span className="font-medium">{label}</span>
    </label>
  );
}

function SaveButton({ onSave }: { onSave: () => Promise<SaveResult> }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<SaveResult | null>(null);
  return (
    <div className="flex items-center gap-3">
      <button
        className="btn-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setRes(null);
          setRes(await onSave());
          setBusy(false);
        }}
      >
        {busy ? "שומר..." : "שמירה"}
      </button>
      {res && (
        <span className="text-sm" style={{ color: res.ok ? "var(--success)" : "var(--danger)" }}>
          {res.ok ? "נשמר בהצלחה ✓" : res.error}
        </span>
      )}
    </div>
  );
}

export function WelcomeForm({
  business,
  initial,
}: {
  business: BusinessInfo;
  initial: { enabled?: boolean; message?: string };
}) {
  const [enabled, setEnabled] = useState(!!initial.enabled);
  const [message, setMessage] = useState(initial.message || "");
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="card space-y-4 h-fit">
        <Toggle checked={enabled} onChange={setEnabled} label="הפעלת אוטומציית ברוך הבא" />
        <div>
          <label className="label">הודעת ברוך הבא</label>
          <SmsTextarea value={message} onChange={setMessage} business={business} />
        </div>
        <SaveButton
          onSave={() => {
            const fd = new FormData();
            if (enabled) fd.set("enabled", "on");
            fd.set("message", message);
            return saveWelcomeAction(fd);
          }}
        />
      </div>
      <PhonePreview sender={business.businessName || "TheVision"} message={message} />
    </div>
  );
}

export function ReviewsForm({
  business,
  initial,
}: {
  business: BusinessInfo;
  initial: { enabled?: boolean; delayMinutes?: number; message?: string };
}) {
  const [enabled, setEnabled] = useState(!!initial.enabled);
  const [delay, setDelay] = useState(initial.delayMinutes ?? 0);
  const [message, setMessage] = useState(initial.message || "");
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="card space-y-4 h-fit">
        <Toggle checked={enabled} onChange={setEnabled} label="הפעלת אוטומציית ביקורות" />
        <div>
          <label className="label">המתנה לפני שליחה מרגע סיום התור (בדקות)</label>
          <input
            type="number" min={0} max={99} className="input w-32"
            value={delay} onChange={(e) => setDelay(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="label">הודעת בקשת ביקורת</label>
          <SmsTextarea value={message} onChange={setMessage} business={business} />
        </div>
        <SaveButton
          onSave={() => {
            const fd = new FormData();
            if (enabled) fd.set("enabled", "on");
            fd.set("delayMinutes", String(delay));
            fd.set("message", message);
            return saveReviewsAction(fd);
          }}
        />
      </div>
      <PhonePreview sender={business.businessName || "TheVision"} message={message} />
    </div>
  );
}

export function WeeklySmsForm({
  business,
  initial,
}: {
  business: BusinessInfo;
  initial: {
    enabled?: boolean;
    dayOfWeek?: number;
    time?: string;
    filterDays?: number;
    audience?: string;
    message?: string;
  };
}) {
  const [enabled, setEnabled] = useState(!!initial.enabled);
  const [dayOfWeek, setDayOfWeek] = useState(initial.dayOfWeek ?? 0);
  const [time, setTime] = useState(initial.time || "09:00");
  const [filterDays, setFilterDays] = useState(initial.filterDays ?? 1);
  const [audience, setAudience] = useState(initial.audience || "all");
  const [message, setMessage] = useState(initial.message || "");
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCount(null);
    const t = setTimeout(async () => {
      const n = await countWeeklyAction({ audience, filterDays });
      if (!cancelled) setCount(n);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [audience, filterDays]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="card space-y-4 h-fit">
        <Toggle checked={enabled} onChange={setEnabled} label="הפעלת SMS שבועי" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">יום בשבוע</label>
            <select className="input" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAYS.map((d, i) => (
                <option key={i} value={i}>{`יום ${d}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">שעה</label>
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div>
            <label className="label">קהל לקוחות</label>
            <select className="input" value={audience} onChange={(e) => setAudience(e.target.value)}>
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
          <label className="label">סינון תורים מ-{filterDays} הימים האחרונים</label>
          <input
            type="range" min={0} max={10} value={filterDays}
            onChange={(e) => setFilterDays(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div className="info-bar">
          {count === null ? "מחשב נמענים..." : (
            <>
              כרגע <b>{count}</b> לקוחות תואמים · קהל: {AUD_LABEL[audience]} ·{" "}
              {filterDays > 0
                ? `ללא מי שהגיעו ב-${filterDays} הימים האחרונים`
                : "ללא סינון ימים"}
            </>
          )}
        </div>

        <SaveButton
          onSave={() => {
            const fd = new FormData();
            if (enabled) fd.set("enabled", "on");
            fd.set("dayOfWeek", String(dayOfWeek));
            fd.set("time", time);
            fd.set("filterDays", String(filterDays));
            fd.set("audience", audience);
            fd.set("message", message);
            return saveWeeklySmsAction(fd);
          }}
        />
      </div>
      <PhonePreview sender={business.businessName || "TheVision"} message={message} />
    </div>
  );
}

export function WeeklyPushForm({
  businessName,
  initial,
}: {
  businessName?: string;
  initial: {
    enabled?: boolean;
    dayOfWeek?: number;
    time?: string;
    title?: string;
    body?: string;
  };
}) {
  const [enabled, setEnabled] = useState(!!initial.enabled);
  const [dayOfWeek, setDayOfWeek] = useState(initial.dayOfWeek ?? 0);
  const [time, setTime] = useState(initial.time || "09:00");
  const [title, setTitle] = useState(initial.title || "");
  const [body, setBody] = useState(initial.body || "");
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="card max-w-xl space-y-4 h-fit">
        <Toggle checked={enabled} onChange={setEnabled} label="הפעלת פוש שבועי" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">יום בשבוע</label>
            <select className="input" value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
              {DAYS.map((d, i) => (
                <option key={i} value={i}>{`יום ${d}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">שעה</label>
            <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">כותרת</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">תוכן</label>
          <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <SaveButton
          onSave={() => {
            const fd = new FormData();
            if (enabled) fd.set("enabled", "on");
            fd.set("dayOfWeek", String(dayOfWeek));
            fd.set("time", time);
            fd.set("title", title);
            fd.set("body", body);
            return saveWeeklyPushAction(fd);
          }}
        />
      </div>
      <PushPreview appName={businessName || "The Vision"} title={title} body={body} />
    </div>
  );
}
