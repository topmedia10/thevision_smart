"use client";
import { useState } from "react";
import { sendPushAction } from "@/app/(admin)/push/actions";
import { PushResult } from "@/lib/lambda";

export function PushForm({ lastSentAt }: { lastSentAt?: string }) {
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
    <div className="card max-w-xl space-y-4">
      <div className="text-sm text-gray-500">
        פוש אחרון נשלח:{" "}
        <span className="font-semibold">
          {lastSentAt ? new Date(lastSentAt).toLocaleString("he-IL") : "טרם נשלח"}
        </span>
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
          {result.ok ? "ההתראה נשלחה ✓" : `שגיאה: ${result.error}`}
        </div>
      )}
    </div>
  );
}
