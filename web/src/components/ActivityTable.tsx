"use client";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";

const SOURCE_LABEL: Record<string, string> = {
  manual: "ידני",
  weekly: "שבועי",
  welcome: "ברוך הבא",
  review: "ביקורת",
  test: "טסט",
  otp: "קוד כניסה",
  alert: "התראה",
};

export interface ActivityRow {
  sentAt: string;
  source: string;
  message: string;
  recipientsCount?: number;
  credits: number | null;
}

export function ActivityTable({
  rows,
  showRecipients = false,
  pageSize = 10,
  emptyText = "אין פעילות עדיין",
}: {
  rows: ActivityRow[];
  showRecipients?: boolean;
  pageSize?: number;
  emptyText?: string;
}) {
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = rows.slice(cur * pageSize, cur * pageSize + pageSize);

  if (rows.length === 0) {
    return <div className="card"><p className="faint text-sm">{emptyText}</p></div>;
  }

  return (
    <>
      <div className="card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="muted text-right" style={{ background: "var(--surface-2)" }}>
              <tr>
                <th className="py-3 px-4 font-medium">תאריך</th>
                <th className="py-3 px-4 font-medium">מקור</th>
                <th className="py-3 px-4 font-medium">הודעה</th>
                {showRecipients && <th className="py-3 px-4 font-medium">נמענים</th>}
                <th className="py-3 px-4 font-medium">קרדיט</th>
                <th className="py-3 px-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {slice.map((r, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--border-soft)" }}>
                  <td className="py-3 px-4 whitespace-nowrap muted">{formatDateTime(r.sentAt)}</td>
                  <td className="py-3 px-4">
                    <span className="chip">{SOURCE_LABEL[r.source] ?? r.source}</span>
                  </td>
                  <td
                    className="py-3 px-4 max-w-xs truncate cursor-pointer hover:underline"
                    onClick={() => setOpen(r.message)}
                    title="לחצו לצפייה"
                  >
                    {r.message}
                  </td>
                  {showRecipients && <td className="py-3 px-4">{r.recipientsCount ?? 1}</td>}
                  <td className="py-3 px-4">{r.credits ?? "—"}</td>
                  <td className="py-3 px-4">
                    <button
                      className="toolbtn"
                      onClick={() => setOpen(r.message)}
                      title="צפייה בהודעה"
                    >
                      👁
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: "1px solid var(--border-soft)" }}
          >
            <span className="faint text-sm">
              עמוד {cur + 1} מתוך {pages}
            </span>
            <div className="flex gap-2">
              <button
                className="toolbtn"
                disabled={cur === 0}
                onClick={() => setPage(cur - 1)}
              >
                ‹ הקודם
              </button>
              <button
                className="toolbtn"
                disabled={cur >= pages - 1}
                onClick={() => setPage(cur + 1)}
              >
                הבא ›
              </button>
            </div>
          </div>
        )}
      </div>

      {open !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpen(null)}
        >
          <div
            className="card w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">תוכן ההודעה</h3>
              <button className="toolbtn" onClick={() => setOpen(null)}>✕</button>
            </div>
            <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {open}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
