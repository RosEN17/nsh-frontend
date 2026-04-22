"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function NordsheetLogo() {
  return (
    <svg width="160" height="44" viewBox="0 0 320 88" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* ── Document icon ── */}
      {/* Body */}
      <rect x="2" y="2" width="58" height="74" rx="6" fill="white"/>
      {/* Folded corner cut */}
      <path d="M44 2 L60 18 L44 18 Z" fill="#b0bec5"/>
      <path d="M44 2 L60 18 H44 Z" fill="#cfd8dc"/>
      {/* N letter */}
      <text x="8" y="44" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="24" fill="#1a2530">N</text>
      {/* Chart dots + curve */}
      <circle cx="10" cy="64" r="3.5" fill="#6a8193"/>
      <path d="M10 64 Q22 52 32 57 Q42 62 52 46" stroke="#6a8193" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      {/* Arrow head */}
      <path d="M52 46 L46 43 L49 50 Z" fill="#6a8193"/>

      {/* ── Wordmark ── */}
      <text x="74" y="38" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="26" fill="#6a8193">Nord</text>
      <text x="74" y="38" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="26" fill="#ffffff" dx="52">Sheet</text>
      {/* Tagline */}
      <text x="75" y="56" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="10" fill="#6a8193" letterSpacing="2">SNABB PRECISION</text>
    </svg>
  );
}

function SbIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    dashboard: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>,
    estimate:  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v3h3M5 8h6M5 11h4" strokeLinecap="round"/></svg>,
    estimates: <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M2 3h12M2 6.5h12M2 10h8M2 13.5h6" strokeLinecap="round"/></svg>,
    settings:  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeLinecap="round"/></svg>,
    logout:    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 11l3-3-3-3M13 8H6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  };
  return icons[name] || null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function SbLink({ href, icon, label }: { href: string; icon: string; label: string }) {
    const active = pathname === href;
    return (
      <Link href={href} className={`sb-nav-item${active ? " active" : ""}`}>
        <span className="sb-nav-icon"><SbIcon name={icon} /></span>
        <span className="sb-nav-label">{label}</span>
      </Link>
    );
  }

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <NordsheetLogo />
      </div>
      <div className="sb-divider" />
      <nav className="sb-nav">
        <SbLink href="/dashboard" icon="dashboard" label="Dashboard" />
        <SbLink href="/estimate"  icon="estimate"  label="Ny kalkyl" />
        <SbLink href="/estimates" icon="estimates" label="Mina offerter" />
      </nav>
      <div className="sb-bottom">
        <div className="sb-divider" />
        <nav className="sb-nav">
          <SbLink href="/settings" icon="settings" label="Inställningar" />
        </nav>
        <button className="sb-logout" onClick={signOut}>
          <span className="sb-nav-icon"><SbIcon name="logout" /></span>
          <span>Logga ut</span>
        </button>
      </div>
    </aside>
  );
}
