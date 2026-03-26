"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const filterItems = [
  { label: "AI Alerts", count: "—", hi: true },
  { label: "Inkorg",    count: "6" },
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
        <div className="ns-brand-sub">Finance platform</div>
      </div>

      <div className="ns-sidebar-section">Filter</div>

      <nav className="sidebar-nav">
        {filterItems.map((item) => (
          <div key={item.label} className={`sidebar-link ${item.hi ? "active" : ""}`}>
            {item.label}
            <span className={`sidebar-badge${item.hi ? " hi" : ""}`}>{item.count}</span>
          </div>
        ))}
      </nav>
    </aside>
  );
}
