"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV } from "@/lib/nav";

export function Sidebar({
  name,
  logoutAction,
}: {
  name: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <button
        className="md:hidden fixed top-3 right-3 z-30 btn-secondary"
        onClick={() => setOpen((o) => !o)}
        aria-label="תפריט"
      >
        ☰
      </button>
      <aside
        className={`fixed md:static z-20 h-full w-64 bg-white border-l border-gray-100 p-4 flex flex-col transition-transform ${
          open ? "translate-x-0" : "translate-x-full md:translate-x-0"
        }`}
      >
        <div className="px-2 mb-6">
          <div className="text-2xl font-bold text-brand-600">סמארט</div>
          <div className="text-xs text-gray-500">The Vision</div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {NAV.map((item) => (
            <div key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                  isActive(item.href)
                    ? "bg-brand-50 text-brand-700 font-semibold"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
              {item.children && isActive(item.href) && (
                <div className="mr-6 mt-1 space-y-1">
                  {item.children.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      onClick={() => setOpen(false)}
                      className={`block rounded-lg px-3 py-1.5 text-sm ${
                        pathname === c.href
                          ? "text-brand-700 font-medium"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="border-t border-gray-100 pt-3 mt-3">
          <div className="px-2 text-sm text-gray-600 mb-2">{name}</div>
          <form action={logoutAction}>
            <button className="btn-secondary w-full text-sm">התנתקות</button>
          </form>
        </div>
      </aside>
    </>
  );
}
