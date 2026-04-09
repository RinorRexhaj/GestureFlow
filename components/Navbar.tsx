"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useHandDetectionStore from "@/store/handDetection";

const NAV_LINKS = [
  { label: "Dashboard", href: "/" },
  { label: "History", href: "/history" },
  { label: "Tutorials", href: "/settings" },
  { label: "Controls", href: "/controls" },
];

interface NavbarProps {
  onOpenSettings: () => void;
}

const Navbar = ({ onOpenSettings }: NavbarProps) => {
  const pathname = usePathname();
  const { cameraEnabled, toggleCamera } = useHandDetectionStore();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4
                 bg-background/40 backdrop-blur-xl
                 shadow-[0_0_60px_rgba(137,206,255,0.06)]"
    >
      {/* Wordmark */}
      <Link href="/" className="flex-shrink-0">
        <span className="text-2xl font-bold font-headline tracking-tight gradient-text cursor-pointer">
          GestureFlow
        </span>
      </Link>

      {/* Centre nav links — hidden on small screens */}
      <div className="hidden md:flex items-center gap-1">
        {NAV_LINKS.map(({ label, href }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`font-headline text-sm px-3 py-1.5 rounded-lg transition-all duration-300
                ${
                  active
                    ? "text-primary font-semibold"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/20"
                }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Right icon actions */}
      <div className="flex items-center gap-1">
        {[
          {
            icon: cameraEnabled ? "camera_alt" : "no_photography",
            label: cameraEnabled ? "Camera On" : "Camera Off",
            onClick: toggleCamera,
          },
          { icon: "settings", label: "Settings", onClick: onOpenSettings },
          { icon: "help", label: "Help", onClick: undefined },
        ].map(({ icon, label, onClick }) => (
          <button
            key={icon}
            onClick={onClick}
            aria-label={label}
            className="p-2 flex justify-center items-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-variant/20
                       transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="material-symbols-outlined">{icon}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default Navbar;
