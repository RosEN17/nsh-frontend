"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useTeam } from "@/lib/useTeam";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Variances", href: "/variances" },
  { label: "Forecast",  href: "/forecast" },
  { label: "Report",    href: "/export" },
];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

export default function Header({ reportCount }: { reportCount: number }) {
  const pathname = usePathname();
  const { me, members, company } = useTeam();
  const [teamOpen, setTeamOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setTeamOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="optima-headerbar">
      <nav className="ns-topnav">
        {navItems.map((item, i) => (
          <span key={i} style={{ display: "contents" }}>
            {i > 0 && <span className="ns-topnav-sep">—</span>}
            <a href={item.href}
              className={`ns-topnav-item${pathname === item.href ? " active" : ""}`}>
              {item.label}
            </a>
          </span>
        ))}
      </nav>

      <div className="header-right">
        <div className="hdr-team-wrap" ref={dropRef}>
          <button className="hdr-team-btn" onClick={() => setTeamOpen(!teamOpen)}>
            <span className="hdr-team-company">{company?.name || "Mitt bolag"}</span>
            <span className="hdr-team-count">{members.length}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{ transform: teamOpen ? "rotate(180deg)" : "", transition: "transform .15s" }}>
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {teamOpen && (
            <div className="hdr-team-dropdown">
              <div className="hdr-team-header">
                <div className="hdr-team-header-title">{company?.name || "Ditt bolag"}</div>
                <div className="hdr-team-header-sub">{members.length} medlemmar</div>
              </div>
              <div className="hdr-team-list">
                {members.map((m) => (
                  <div key={m.id} className={`hdr-team-member${m.id === me?.id ? " is-me" : ""}`}>
                    <div className="hdr-member-avatar">{initials(m.full_name || "?")}</div>
                    <div>
                      <div className="hdr-member-name">
                        {m.full_name || "Okänd"}{m.id === me?.id && " (du)"}
                      </div>
                      <div className="hdr-member-role">{m.role || "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hdr-team-footer">
                <button className="hdr-sign-out" onClick={signOut}>Logga ut</button>
              </div>
            </div>
          )}
        </div>

        <div className="hdr-me-avatar" title={me?.full_name || ""}>
          {initials(me?.full_name || "?")}
        </div>
      </div>
    </div>
  );
}
