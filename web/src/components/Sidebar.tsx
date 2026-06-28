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
        className={`fixed md:static z-20 h-screen md:h-auto md:min-h-screen w-64 shrink-0 p-4 flex flex-col transition-transform ${
          open ? "translate-x-0" : "translate-x-full md:translate-x-0"
        }`}
        style={{
          background: "var(--surface)",
          borderInlineStart: "1px solid var(--border-soft)",
        }}
      >
        <div className="px-2 mb-7 mt-1">
          <div className="flex items-center gap-2">
            <span
              className="grid h-9 w-9 place-items-center rounded-xl text-white font-bold"
              style={{ background: "linear-gradient(180deg,var(--brand),var(--brand-2))" }}
            >
              S
            </span>
            <div>
              <div className="text-lg font-bold leading-none">סמארט</div>
              <div className="faint text-xs mt-0.5">The Vision</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition"
                  style={
                    active
                      ? { background: "var(--brand-weak)", color: "#c9c8fb", fontWeight: 600 }
                      : { color: "var(--muted)" }
                  }
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
                {item.children && active && (
                  <div className="mr-7 mt-0.5 space-y-0.5">
                    {item.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-lg px-3 py-1.5 text-sm transition"
                        style={{
                          color:
                            pathname === c.href ? "var(--text)" : "var(--faint)",
                          fontWeight: pathname === c.href ? 600 : 400,
                        }}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="pt-3 mt-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
          <div className="px-2 text-sm muted mb-2">{name}</div>
          <form action={logoutAction}>
            <button className="btn-secondary w-full text-sm">התנתקות</button>
          </form>
        </div>
      </aside>
    </>
  );
}
