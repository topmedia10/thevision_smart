import { requireAdmin } from "@/lib/auth";
import { listEmployees } from "@/lib/employees";
import { customerCountsByEmployee } from "@/lib/customers";
import { EmployeesManager, EmpRow } from "@/components/EmployeesManager";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  await requireAdmin();
  const [employees, counts] = await Promise.all([
    listEmployees(),
    customerCountsByEmployee(),
  ]);
  const rows: EmpRow[] = employees.map((e) => ({
    employeeId: e.employeeId,
    firstName: e.firstName,
    lastName: e.lastName,
    phone: e.phone,
    admin: e.admin,
    showInSms: e.showInSms,
    notifyLowBalance: e.notifyLowBalance,
    customerCount: counts[e.employeeId] ?? 0,
  }));
  return <EmployeesManager initial={rows} />;
}
