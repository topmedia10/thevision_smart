"use client";
import { useState } from "react";
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

  const upd = (patch: Partial<EmpRow>) =>
    setEditing((e) => (e ? { ...e, ...patch } : e));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">אנשי צוות</h1>
        <button className="btn-primary" onClick={() => start(null)}>
          + איש צוות חדש
        </button>
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
              <input
                className="input text-left"
                dir="ltr"
                value={editing.employeeId}
                disabled={!isNew}
                onChange={(e) => upd({ employeeId: e.target.value })}
                placeholder="מהמערכת התורים"
              />
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
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button className="btn-primary" onClick={save} disabled={busy}>
              {busy ? "שומר..." : "שמירה"}
            </button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>ביטול</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-gray-500 text-right border-b border-gray-100">
            <tr>
              <th className="py-2 font-medium">שם</th>
              <th className="py-2 font-medium">טלפון</th>
              <th className="py-2 font-medium">לקוחות</th>
              <th className="py-2 font-medium">הרשאות</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((e) => (
              <tr key={e.employeeId} className="border-t border-gray-50">
                <td className="py-2">{[e.firstName, e.lastName].filter(Boolean).join(" ") || "—"}</td>
                <td className="py-2" dir="ltr">{e.phone || "—"}</td>
                <td className="py-2">{e.customerCount}</td>
                <td className="py-2 text-xs text-gray-500">
                  {[e.admin && "ניהול", e.showInSms && "SMS", e.notifyLowBalance && "התראות"]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="py-2">
                  <div className="flex gap-2">
                    <button className="toolbtn" onClick={() => start(e)}>עריכה</button>
                    <button className="toolbtn text-red-600" onClick={() => remove(e.employeeId)}>מחיקה</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
