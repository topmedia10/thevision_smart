"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveEmployeeAction, deleteEmployeeAction } from "@/app/(admin)/employees/actions";

export interface EmpRow {
  employeeId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  admin?: boolean;
  showInSms?: boolean;
  notifyLowBalance?: boolean;
  customerCount: number;
}

const EMPTY: EmpRow = {
  employeeId: "",
  firstName: "",
  lastName: "",
  phone: "",
  admin: false,
  showInSms: true,
  notifyLowBalance: false,
  customerCount: 0,
};

export function EmployeesManager({ initial }: { initial: EmpRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<EmpRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [showAll, setShowAll] = useState(false); // default: only "showInSms"

  const visible = useMemo(
    () => (showAll ? initial : initial.filter((e) => e.showInSms)),
    [initial, showAll],
  );

  function start(emp: EmpRow | null) {
    setEditing(emp ? { ...emp } : { ...EMPTY });
    setIsNew(!emp);
    setError(undefined);
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(undefined);
    const fd = new FormData();
    fd.set("employeeId", editing.employeeId);
    fd.set("firstName", editing.firstName || "");
    fd.set("lastName", editing.lastName || "");
    fd.set("phone", editing.phone || "");
    if (editing.admin) fd.set("admin", "on");
    if (editing.showInSms) fd.set("showInSms", "on");
    if (editing.notifyLowBalance) fd.set("notifyLowBalance", "on");
    const r = await saveEmployeeAction(fd);
    setBusy(false);
    if (!r.ok) setError(r.error);
    else {
      setEditing(null);
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm("למחוק את איש הצוות?")) return;
    await deleteEmployeeAction(id);
    router.refresh();
  }

  const upd = (patch: Partial<EmpRow>) => setEditing((e) => (e ? { ...e, ...patch } : e));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-2xl font-bold">אנשי צוות</h1>
        <div className="flex items-center gap-3">
          <select
            className="input !w-auto py-1.5"
            value={showAll ? "all" : "sms"}
            onChange={(e) => setShowAll(e.target.value === "all")}
          >
            <option value="sms">רק בשליחת SMS</option>
            <option value="all">כל הצוות</option>
          </select>
          <button className="btn-primary" onClick={() => start(null)}>+ איש צוות חדש</button>
        </div>
      </div>

      {editing && (
        <div className="card space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">שם פרטי</label>
              <input className="input" value={editing.firstName || ""} onChange={(e) => upd({ firstName: e.target.value })} />
            </div>
            <div>
              <label className="label">שם משפחה</label>
              <input className="input" value={editing.lastName || ""} onChange={(e) => upd({ lastName: e.target.value })} />
            </div>
            <div>
              <label className="label">טלפון</label>
              <input className="input text-left" dir="ltr" value={editing.phone || ""} onChange={(e) => upd({ phone: e.target.value })} placeholder="05X-XXXXXXX" />
            </div>
            <div>
              <label className="label">מזהה עובד (employeeId)</label>
              <input className="input text-left" dir="ltr" value={editing.employeeId} disabled={!isNew} onChange={(e) => upd({ employeeId: e.target.value })} placeholder="מהמערכת התורים" />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!editing.admin} onChange={(e) => upd({ admin: e.target.checked })} />
              גישה למערכת
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!editing.showInSms} onChange={(e) => upd({ showInSms: e.target.checked })} />
              להציג בשליחת SMS
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={!!editing.notifyLowBalance} onChange={(e) => upd({ notifyLowBalance: e.target.checked })} />
              התראות הטענת קרדיט
            </label>
          </div>
          {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" onClick={save} disabled={busy}>{busy ? "שומר..." : "שמירה"}</button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>ביטול</button>
          </div>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="muted text-right" style={{ background: "var(--surface-2)" }}>
            <tr>
              <th className="py-3 px-4 font-medium">שם</th>
              <th className="py-3 px-4 font-medium">לקוחות</th>
              <th className="py-3 px-4 font-medium">הרשאות</th>
              <th className="py-3 px-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr key={e.employeeId} style={{ borderTop: "1px solid var(--border-soft)" }}>
                <td className="py-3 px-4">{[e.firstName, e.lastName].filter(Boolean).join(" ") || "—"}</td>
                <td className="py-3 px-4">{e.customerCount}</td>
                <td className="py-3 px-4 faint text-xs">
                  {[e.admin && "ניהול", e.showInSms && "SMS", e.notifyLowBalance && "התראות"]
                    .filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button className="toolbtn" onClick={() => start(e)}>עריכה</button>
                    <button className="toolbtn" style={{ color: "var(--danger)" }} onClick={() => remove(e.employeeId)}>מחיקה</button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={4} className="py-6 px-4 faint text-sm">אין אנשי צוות להצגה</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
