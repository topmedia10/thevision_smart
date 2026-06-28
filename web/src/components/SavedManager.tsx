"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SmsTextarea, BusinessInfo } from "./SmsTextarea";
import { saveMessageAction, deleteMessageAction } from "@/app/(admin)/sms/saved/actions";

interface SavedMsg { id: string; title: string; body: string }

export function SavedManager({
  initial,
  business,
}: {
  initial: SavedMsg[];
  business: BusinessInfo;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<SavedMsg | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  function startNew() {
    setEditing({ id: "", title: "", body: "" });
    setTitle("");
    setBody("");
  }
  function startEdit(m: SavedMsg) {
    setEditing(m);
    setTitle(m.title);
    setBody(m.body);
  }
  async function save() {
    setBusy(true);
    const fd = new FormData();
    if (editing?.id) fd.set("id", editing.id);
    fd.set("title", title);
    fd.set("body", body);
    await saveMessageAction(fd);
    setBusy(false);
    setEditing(null);
    router.refresh();
  }
  async function remove(id: string) {
    if (!confirm("למחוק את ההודעה השמורה?")) return;
    await deleteMessageAction(id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">הודעות שמורות</h1>
        <button className="btn-primary" onClick={startNew}>
          + הודעה חדשה
        </button>
      </div>

      {editing && (
        <div className="card space-y-3">
          <div>
            <label className="label">כותרת</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="שם ההודעה"
            />
          </div>
          <div>
            <label className="label">תוכן</label>
            <SmsTextarea value={body} onChange={setBody} business={business} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={save} disabled={busy}>
              {busy ? "שומר..." : "שמירה"}
            </button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>
              ביטול
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {initial.length === 0 && !editing && (
          <p className="faint text-sm">אין הודעות שמורות עדיין</p>
        )}
        {initial.map((m) => (
          <div key={m.id} className="card flex justify-between items-start gap-4">
            <div className="min-w-0">
              <div className="font-semibold">{m.title}</div>
              <div className="text-sm muted whitespace-pre-wrap line-clamp-2">
                {m.body}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="toolbtn" onClick={() => startEdit(m)}>
                עריכה
              </button>
              <button
                className="toolbtn"
                style={{ color: "var(--danger)" }}
                onClick={() => remove(m.id)}
              >
                מחיקה
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
