"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTeam } from "@/lib/useTeam";
import { getPack } from "@/lib/store";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

function NordsheetLogo() {
  return (
    <div className="sb-logo-wrap">
      <svg width="26" height="26" viewBox="0 0 200 200" fill="none">
        <path d="M100 4C100 4,118 82,196 100C118 118,100 196,100 196C100 196,82 118,4 100C82 82,100 4,100 4Z" fill="white"/>
        <path d="M100 54C100 54,112 88,146 100C112 112,100 146,100 146C100 146,88 112,54 100C88 88,100 54,100 54Z" fill="#0a0a0f"/>
      </svg>
      <div className="sb-wordmark">
        <span className="sb-nord">NORD</span><span className="sb-sheet">SHEET</span>
      </div>
    </div>
  );
}

function SbIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    dashboard: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>,
    alerts:    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z" fill="currentColor"/></svg>,
    reports:   <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v3h3M5 8h6M5 11h4" strokeLinecap="round"/></svg>,
    import:    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M8 2v8M5 7l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" strokeLinecap="round"/></svg>,
    settings:  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeLinecap="round"/></svg>,
    logout:    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  };
  return icons[name] || null;
}

function FortnoxBlock({ companyId }: { companyId: string | null }) {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    if (!companyId || !API_BASE) { setConnected(false); return; }
    fetch(`${API_BASE}/api/fortnox/status?company_id=${companyId}`)
      .then(r => r.json())
      .then(d => setConnected(d.connected === true))
      .catch(() => setConnected(false));
  }, [companyId]);

  async function connect() {
    if (!companyId || !API_BASE) return;
    try {
      const res = await fetch(`${API_BASE}/api/fortnox/auth-url?company_id=${companyId}`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { window.location.href = "/connect"; }
  }

  return (
    <div className="sb-fortnox-block">
      <div className="sb-fortnox-row">
        <div className="sb-fortnox-logo">F</div>
        <div className="sb-fortnox-label">Fortnox</div>
        {connected === null && <span className="sb-fortnox-checking">...</span>}
        {connected === true && (
          <div className="sb-fortnox-status">
            <span className="sb-fortnox-dot" />
            <span className="sb-fortnox-ok">Kopplad</span>
          </div>
        )}
        {connected === false && (
          <button className="sb-fortnox-btn" onClick={connect}>Koppla</button>
        )}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { me, company } = useTeam();
  const pack = getPack();

  const alertCount = pack?.all_flagged?.length || 0;

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function SbLink({ href, icon, label, badge }: {
    href: string; icon: string; label: string; badge?: number;
  }) {
    const active = pathname === href || (href === "/connect" && pathname === "/filer");
    return (
      <Link href={href} className={`sb-nav-item${active ? " active" : ""}`}>
        <span className="sb-nav-icon"><SbIcon name={icon} /></span>
        <span className="sb-nav-label">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="sb-nav-badge">{badge}</span>
        )}
      </Link>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <NordsheetLogo />
      </div>

      <FortnoxBlock companyId={company?.id ?? null} />

      <div className="sb-divider" />

      <div className="sb-section-label">Analys</div>
      <nav className="sb-nav">
        <SbLink href="/dashboard" icon="dashboard" label="Dashboard" />
        <SbLink href="/variances" icon="alerts" label="Avvikelser" badge={alertCount > 0 ? alertCount : undefined} />
      </nav>

      <div className="sb-divider" />

      <div className="sb-section-label">Export</div>
      <nav className="sb-nav">
        <SbLink href="/reports" icon="reports" label="Rapport" />
      </nav>

      <div className="sb-divider" />

      <div className="sb-section-label">Importera</div>
      <nav className="sb-nav">
        <SbLink href="/connect" icon="import" label="Data" />
      </nav>

      <div className="sb-bottom">
        <div className="sb-divider" />
        <nav className="sb-nav">
          <SbLink href="/settings" icon="settings" label="Installningar" />
        </nav>
        <button className="sb-logout" onClick={signOut}>
          <span className="sb-nav-icon"><SbIcon name="logout" /></span>
          <span>Logga ut</span>
        </button>
      </div>
    </aside>
  );
}
