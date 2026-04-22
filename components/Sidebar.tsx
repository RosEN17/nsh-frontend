"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function NordsheetLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Document body */}
      <rect x="20" y="10" width="130" height="160" rx="10" ry="10" fill="white"/>
      {/* Folded corner */}
      <path d="M120 10 L150 40 L120 40 Z" fill="#c8d6de"/>
      <path d="M120 10 L150 40 H120 Z" fill="#dce8ef"/>
      {/* Letter N */}
      <text x="38" y="85" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="52" fill="#1a2530">N</text>
      {/* Chart line with arrow */}
      <polyline points="35,145 75,115 105,130 145,90" stroke="#6a8193" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="35" cy="145" r="7" fill="#6a8193"/>
      {/* Arrow head */}
      <polygon points="145,90 130,82 138,100" fill="#6a8193"/>
    </svg>
  );
}

function Logo() {
  return (
    <div className="sb-logo-wrap">
      <NordsheetLogo size={34} />
      <div className="sb-wordmark">
        <span className="sb-nord">Nord</span><span className="sb-sheet">Sheet</span>
      </div>
    </div>
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
      <div className="sb-brand"><Logo /></div>
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
