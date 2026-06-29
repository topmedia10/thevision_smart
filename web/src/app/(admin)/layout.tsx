import { redirect } from "next/navigation";
import { requireAdmin, logout } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

async function logoutAction() {
  "use server";
  await logout();
  redirect("/login");
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const emp = await requireAdmin();
  const name = [emp.firstName, emp.lastName].filter(Boolean).join(" ");

  return (
    <div className="flex min-h-screen">
      <Sidebar name={name} logoutAction={logoutAction} />
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8 max-w-6xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
