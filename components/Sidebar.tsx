"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPack } from "@/lib/store";

const navItems = [
  { href: "/connect",   label: "Connect" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/variances", label: "Variances" },
  { href: "/forecast",  label: "Forecast" },
  { href: "/export",    label: "Report" },
];

function NordsheetLogo() {
  return (
    <div className="sb-logo-wrap">
      <svg width="28" height="28" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M100 4 C100 4,118 82,196 100 C118 118,100 196,100 196 C100 196,82 118,4 100 C82 82,100 4,100 4Z"
          fill="white"
        />
        <path
          d="M100 54 C100 54,112 88,146 100 C112 112,100 146,100 146 C100 146,88 112,54 100 C88 88,100 54,100 54Z"
          fill="#0a0a0f"
        />
      </svg>
      <div className="sb-wordmark">
        <span className="sb-nord">NORD</span><span className="sb-sheet">SHEET</span>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const pack     = getPack();

  const alertCount = pack
    ? (pack.top_budget?.length || 0) + (pack.top_mom?.length || 0)
    : 0;

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <NordsheetLogo />
        <div className="sb-tagline">Finance platform</div>
      </div>

      <div className="ns-sidebar-section">Workspace</div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? "sidebar-link active" : "sidebar-link"}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sb-divider" />
      <div className="ns-sidebar-section">Alerts</div>

      <div className="sb-alert-item">
        <span className="sb-alert-dot" />
        AI Alerts
        {alertCount > 0 && (
          <span className="sb-alert-badge">{alertCount}</span>
        )}
      </div>
    </aside>
  );
}
