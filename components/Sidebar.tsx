"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/connect", label: "Connect" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/variances", label: "Variances" },
  { href: "/forecast", label: "Forecast" },
  { href: "/export", label: "Export" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="ns-brand">
        <div className="ns-brand-mark">✦</div>
        <div>
          <div className="ns-brand-title">NORDSHEET</div>
          <div className="ns-brand-sub">AI workspace for controllers</div>
        </div>
      </div>

      <div className="ns-sidebar-section">Workspace</div>

      <nav className="sidebar-nav">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? "sidebar-link active" : "sidebar-link"}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}