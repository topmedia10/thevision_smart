"use client";
import { useState } from "react";
import { sendPushAction } from "@/app/(admin)/push/actions";
import { PushResult } from "@/lib/lambda";
import { PushPreview } from "./PushPreview";

export function PushForm({
  lastSentAt,
  businessName,
}: {
  lastSentAt?: string;
  businessName?: string;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);

  async function send() {
    if (!confirm("לשלוח התראת פוש לכל המכשירים?")) return;
    setBusy(true);
    setResult(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("body", body);
    const r = await sendPushAction(fd);
    setResult(r);
    setBusy(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="card max-w-xl space-y-4 h-fit">
        <div className="muted text-sm">
          פוש אחרון נשלח:{" "}
          <span className="font-semibold" style={{ color: "var(--text)" }}>
            {lastSentAt ? new Date(lastSentAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }) : "טרם נשלח"}
          </span>
        </div>
        <div>
          <label className="label">כותרת</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">תוכן</label>
          <textarea className="input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <button className="btn-primary" onClick={send} disabled={busy}>
          {busy ? "שולח..." : "שליחת פוש"}
        </button>
        {result && (
          <div className="text-sm" style={{ color: result.ok ? "var(--success)" : "var(--danger)" }}>
            {result.ok ? "ההתראה נשלחה ✓" : `שגיאה: ${result.error}`}
          </div>
        )}
      </div>
      <PushPreview appName={businessName || "The Vision"} title={title} body={body} />
    </div>
  );
}
