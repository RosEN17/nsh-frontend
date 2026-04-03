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
    alerts:  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z" fill="currentColor"/></svg>,
    inbox:   <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M2 7h3l1.5 2h3L11 7h3" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>,
    calendar:<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M1 7h14M5 1v4M11 1v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
    reports: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M10 2v3h3M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
    profile: <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg>,
    team:    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><circle cx="11" cy="5" r="2" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/><path d="M11 9c2 0 4 1 4 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg>,
    settings:<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
    help:    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" fill="none"/><path d="M6 6c0-1.1.9-2 2-2s2 .9 2 2c0 1.5-2 2-2 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/><circle cx="8" cy="12" r=".7" fill="currentColor"/></svg>,
    logout:  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>,
  };
  return icons[name] || null;
}

// ── Fortnox status block ──────────────────────────────────────────
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
      const res  = await fetch(`${API_BASE}/api/fortnox/auth-url?company_id=${companyId}`);
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      window.location.href = "/connect";
    }
  }

  return (
    <div className="sb-fortnox-block">
      <div className="sb-fortnox-row">
        <div className="sb-fortnox-logo">F</div>
        <div className="sb-fortnox-label">Fortnox</div>
        {connected === null && (
          <span className="sb-fortnox-checking">...</span>
        )}
        {connected === true && (
          <div className="sb-fortnox-status">
            <span className="sb-fortnox-dot" />
            <span className="sb-fortnox-ok">Kopplad</span>
          </div>
        )}
        {connected === false && (
          <button className="sb-fortnox-btn" onClick={connect}>
            Koppla
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { me, company } = useTeam();
  const pack     = getPack();

  const [alertCount, setAlertCount] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    if (pack) {
      setAlertCount((pack.top_budget?.length || 0) + (pack.top_mom?.length || 0));
    }
  }, []);

  useEffect(() => {
    if (!me?.id) return;
    // Inbox — bara om tabellen finns
    supabase.from("inbox_messages")
      .select("id", { count: "exact" })
      .eq("to_id", me.id)
      .eq("read", false)
      .then(({ count }) => setInboxCount(count || 0))
      .catch(() => {}); // tyst om tabellen saknas
  }, [me?.id]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function SbLink({ href, icon, label, badge }: {
    href: string; icon: string; label: string; badge?: number;
  }) {
    const active = pathname === href;
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

      {/* Logo */}
      <div className="sb-brand">
        <NordsheetLogo />
        <div className="sb-tagline">Finance platform</div>
      </div>

      {/* Fortnox status */}
      <FortnoxBlock companyId={company?.id ?? null} />

      {/* Period */}
      {pack?.current_period && (
        <div className="sb-period-wrap">
          <div className="sb-period-dot" />
          <div>
            <div className="sb-period-label">Aktiv period</div>
            <div className="sb-period-val">{pack.current_period}</div>
          </div>
        </div>
      )}

      <div className="sb-divider" />

      {/* Notiser */}
      <div className="sb-section-label">Notiser</div>
      <nav className="sb-nav">
        <SbLink href="/alerts" icon="alerts" label="AI Alerts"  badge={alertCount} />
        <SbLink href="/inbox"  icon="inbox"  label="Inkorg"     badge={inboxCount} />
      </nav>

      <div className="sb-divider" />

      {/* Uppföljningar */}
      <div className="sb-section-label">Uppföljningar</div>
      <nav className="sb-nav">
        <SbLink href="/calendar" icon="calendar" label="Kalender" />
      </nav>

      <div className="sb-divider" />

      {/* Rapporter */}
      <div className="sb-section-label">Rapporter</div>
      <nav className="sb-nav">
        <SbLink href="/reports" icon="reports" label="Sparade rapporter" />
      </nav>

      {/* Bottom */}
      <div className="sb-bottom">
        <div className="sb-divider" />
        <nav className="sb-nav">
          <SbLink href="/profile"  icon="profile"  label="Min profil" />
          <SbLink href="/team"     icon="team"     label="Bolag & Team" />
          <SbLink href="/settings" icon="settings" label="Inställningar" />
          <SbLink href="/help"     icon="help"     label="Hjälp & support" />
        </nav>
        <button className="sb-logout" onClick={signOut}>
          <span className="sb-nav-icon"><SbIcon name="logout" /></span>
          <span>Logga ut</span>
        </button>
      </div>
    </aside>
  );
}
