"use client";
import { useState } from "react";
import { sendPushAction } from "@/app/(admin)/push/actions";
import { PushResult } from "@/lib/lambda";

export function PushForm({ lastCount }: { lastCount: number }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);

  async function send() {
    if (!confirm("לשלוח התראת פוש לכל המכשירים הרשומים?")) return;
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
    <div className="card max-w-xl space-y-4">
      <div className="text-sm text-gray-500">
        נשלחו בשליחה האחרונה: <span className="font-semibold">{lastCount}</span> הודעות
      </div>
      <div>
        <label className="label">כותרת</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label">תוכן</label>
        <textarea
          className="input"
          rows={4}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <button className="btn-primary" onClick={send} disabled={busy}>
        {busy ? "שולח..." : "שליחת פוש"}
      </button>
      {result && (
        <div className={`text-sm ${result.ok ? "text-green-600" : "text-red-600"}`}>
          {result.ok
            ? `נשלח! הצלחות: ${result.successCount ?? 0}, כשלונות: ${result.failureCount ?? 0}`
            : `שגיאה: ${result.error}`}
        </div>
      )}
    </div>
  );
}
