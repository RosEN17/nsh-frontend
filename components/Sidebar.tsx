"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function Logo() {
  return (
    <div className="sb-logo-wrap">
      <svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* House body */}
        <rect x="16" y="50" width="68" height="44" rx="3" fill="#6b7280"/>
        {/* Roof */}
        <polygon points="8,52 50,12 92,52" fill="#9ca3af"/>
        {/* Door */}
        <rect x="38" y="66" width="24" height="28" rx="2" fill="#4b5563"/>
        {/* Window left */}
        <rect x="20" y="57" width="15" height="14" rx="2" fill="#374151"/>
        {/* Window right */}
        <rect x="65" y="57" width="15" height="14" rx="2" fill="#374151"/>
        {/* Star top-right corner – coral, discrete */}
        <polygon
          points="86,3 88.2,9.8 95.5,9.8 89.8,14 92,20.5 86,16.5 80,20.5 82.2,14 76.5,9.8 83.8,9.8"
          fill="#FF6B6B"
          opacity="0.88"
        />
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
        <SbLink href="/estimates" icon="estimates" label="Mina kalkyler" />
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
