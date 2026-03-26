"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/connect",   label: "+ Connect" },
  { href: "/dashboard", label: "Review",   separator: true },
  { href: "/variances", label: "Review" },
  { href: "/forecast",  label: "Explain" },
  { href: "/export",    label: "Report" },
];

const filterItems = [
  { label: "Att hantera", count: "8",  hi: true },
  { label: "Öppen",       count: "6" },
  { label: "Utredd",      count: "2" },
  { label: "Godkända",    count: "<" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="ns-brand">
        <div className="ns-brand-logo">
          <span className="ns-brand-mark">✦</span>
          <span className="ns-brand-title">NORDSHEET</span>
        </div>
        <div className="ns-brand-sub">AI workspace for controllers</div>
      </div>

      <div className="ns-sidebar-section">Filter</div>

      <nav className="sidebar-nav">
        {filterItems.map((item) => (
          <div
            key={item.label}
            className={`sidebar-link ${item.hi ? "active" : ""}`}
          >
            {item.label}
            <span className={`sidebar-badge${item.hi ? " hi" : ""}`}>
              {item.count}
            </span>
          </div>
        ))}
      </nav>

      <div className="sidebar-sep" />

      <div className="ns-sidebar-section">Skickad</div>
      <div className="sidebar-link">
        Februari
        <span className="sidebar-badge">13k</span>
      </div>

      <div className="sidebar-period">
        <div className="sidebar-period-label">PERIOD</div>
        <div className="sidebar-period-val">Feb 2025</div>
      </div>
    </aside>
  );
}
