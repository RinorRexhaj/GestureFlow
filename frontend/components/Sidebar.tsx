"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { icon: "space_dashboard", href: "/", label: "Dashboard" },
  { icon: "history", href: "/history", label: "History" },
  { icon: "school", href: "/settings", label: "Tutorials" },
  { icon: "settings_input_component", href: "/controls", label: "Controls" },
];

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <>
      {/* ─── Desktop fixed left rail ─── */}
      <aside
        className="fixed left-0 top-0 h-full w-20 z-40 mt-16
                   bg-surface-container/60 backdrop-blur-2xl rounded-r-2xl
                   flex-col items-center pt-8 pb-6 gap-4
                   hidden md:flex flex-col"
      >
        <div className="flex flex-col gap-3 mt-4 flex-1">
          {ITEMS.map(({ icon, href, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={`p-3 rounded-xl transition-all duration-300
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                            ${
                              active
                                ? "bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-[0_0_15px_rgba(14,165,233,0.4)]"
                                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20"
                            }`}
              >
                <span className="material-symbols-outlined select-none">
                  {icon}
                </span>
              </Link>
            );
          })}
        </div>

        {/* User avatar */}
        <div
          className="w-10 h-10 rounded-full bg-surface-container-highest border border-outline-variant/15
                        flex items-center justify-center flex-shrink-0"
        >
          <span
            className="material-symbols-outlined text-primary text-[18px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            person
          </span>
        </div>
      </aside>

      {/* ─── Mobile bottom tab bar ─── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden
                   bg-surface-container/80 backdrop-blur-2xl
                   items-center justify-around px-4 py-3
                   border-t border-outline-variant/10"
      >
        {ITEMS.map(({ icon, href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300
                          ${active ? "text-primary" : "text-on-surface-variant"}`}
            >
              <span className="material-symbols-outlined text-[22px]">
                {icon}
              </span>
              <span className="text-[10px] font-label">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};

export default Sidebar;
