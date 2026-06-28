"use client";
import { useState } from "react";
import { SmsTextarea, BusinessInfo } from "./SmsTextarea";
import { PhonePreview } from "./PhonePreview";
import {
  saveWelcomeAction,
  saveReviewsAction,
  saveWeeklySmsAction,
  saveWeeklyPushAction,
  SaveResult,
} from "@/app/(admin)/automation/actions";

const DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

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
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-brand-500" : "bg-gray-300"
        }`}
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

function SaveButton({
  onSave,
}: {
  onSave: () => Promise<SaveResult>;
}) {
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
        <span className={`text-sm ${res.ok ? "text-green-600" : "text-red-600"}`}>
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
      <div className="space-y-4">
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
      <div className="space-y-4">
        <Toggle checked={enabled} onChange={setEnabled} label="הפעלת אוטומציית ביקורות" />
        <div>
          <label className="label">המתנה לפני שליחה (דקות)</label>
          <input
            type="number"
            min={0}
            max={99}
            className="input w-32"
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
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
  matchCount,
}: {
  business: BusinessInfo;
  initial: {
    enabled?: boolean;
    dayOfWeek?: number;
    time?: string;
    filterDays?: number;
    message?: string;
  };
  matchCount: number;
}) {
  const [enabled, setEnabled] = useState(!!initial.enabled);
  const [dayOfWeek, setDayOfWeek] = useState(initial.dayOfWeek ?? 0);
  const [time, setTime] = useState(initial.time || "09:00");
  const [filterDays, setFilterDays] = useState(initial.filterDays ?? 1);
  const [message, setMessage] = useState(initial.message || "");
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-4">
        <div className="card bg-brand-50 border-brand-100 text-brand-700">
          כרגע <span className="font-bold">{matchCount}</span> לקוחות תואמים את הסינון (לא ביקרו ב-{filterDays} הימים האחרונים)
        </div>
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
            <label className="label">סינון תורים מ-{filterDays} ימים</label>
            <input type="number" min={1} max={10} className="input" value={filterDays} onChange={(e) => setFilterDays(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="label">תוכן ההודעה</label>
          <SmsTextarea value={message} onChange={setMessage} business={business} />
        </div>
        <p className="text-xs text-amber-600">
          ⚠️ הודעות שיווקיות מחויבות לכלול &quot;פרסומת&quot;, שם העסק ואפשרות הסרה.
        </p>
        <SaveButton
          onSave={() => {
            const fd = new FormData();
            if (enabled) fd.set("enabled", "on");
            fd.set("dayOfWeek", String(dayOfWeek));
            fd.set("time", time);
            fd.set("filterDays", String(filterDays));
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
  initial,
}: {
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
    <div className="max-w-xl space-y-4">
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
  );
}
