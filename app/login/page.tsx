"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function NordsheetLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="10" width="130" height="160" rx="10" ry="10" fill="white"/>
      <path d="M120 10 L150 40 L120 40 Z" fill="#c8d6de"/>
      <path d="M120 10 L150 40 H120 Z" fill="#dce8ef"/>
      <text x="38" y="85" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="52" fill="#1a2530">N</text>
      <polyline points="35,145 75,115 105,130 145,90" stroke="#6a8193" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="35" cy="145" r="7" fill="#6a8193"/>
      <polygon points="145,90 130,82 138,100" fill="#6a8193"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError("Fel e-post eller lösenord."); return; }
    router.push("/dashboard");
  }

  return (
    <div className="login-shell">
      <div className="login-left">
        <div className="login-left-bg" />
        <div className="login-left-content">
          <div className="login-left-logo">
            <NordsheetLogo size={32} />
            <div className="login-left-wordmark">
              <span className="wm-nord">Nord</span>
              <span className="wm-sheet">Sheet</span>
            </div>
          </div>
          <div className="login-tagline">
            Smart<br />
            <span className="login-tagline-muted">kalkylering för</span><br />
            proffs.
          </div>
          <div className="login-features">
            {[
              "Beskriv jobbet – AI räknar",
              "Svenska materialpriser",
              "ROT-avdrag automatiskt",
              "Offert på minuter, inte timmar",
            ].map((f) => (
              <div key={f} className="login-feat">
                <span className="login-feat-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <div className="login-logo-wrap">
            <NordsheetLogo size={52} />
          </div>
          <div className="login-heading">Välkommen till NordSheet</div>
          <div className="login-sub">Logga in för att börja kalkylera</div>
          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label className="login-label">E-POSTADRESS</label>
              <input className="login-input" type="email" placeholder="namn@foretag.se" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="login-field">
              <label className="login-label">LÖSENORD</label>
              <input className="login-input" type="password" placeholder="••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            {error && <div className="login-error">{error}</div>}
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? "Loggar in..." : "Logga in"}
            </button>
          </form>
          <div className="login-footer">Inget konto? Kontakta oss för tillgång.</div>
          <div className="login-badges">
            <span className="login-badge">256-bit kryptering</span>
            <span className="login-badge">GDPR</span>
            <span className="login-badge">Supabase Auth</span>
          </div>
        </div>
      </div>
    </div>
  );
}
