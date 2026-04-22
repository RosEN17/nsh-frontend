"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function NordsheetLogo({ scale = 1 }: { scale?: number }) {
  const w = Math.round(320 * scale);
  const h = Math.round(88 * scale);
  return (
    <svg width={w} height={h} viewBox="0 0 320 88" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* ── Document icon ── */}
      <rect x="2" y="2" width="58" height="74" rx="6" fill="white"/>
      <path d="M44 2 L60 18 L44 18 Z" fill="#b0bec5"/>
      <path d="M44 2 L60 18 H44 Z" fill="#cfd8dc"/>
      <text x="8" y="44" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="24" fill="#1a2530">N</text>
      <circle cx="10" cy="64" r="3.5" fill="#6a8193"/>
      <path d="M10 64 Q22 52 32 57 Q42 62 52 46" stroke="#6a8193" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
      <path d="M52 46 L46 43 L49 50 Z" fill="#6a8193"/>
      {/* ── Wordmark ── */}
      <text x="74" y="38" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="26" fill="#6a8193">Nord</text>
      <text x="74" y="38" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="26" fill="#ffffff" dx="52">Sheet</text>
      <text x="75" y="56" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="10" fill="#6a8193" letterSpacing="2">SNABB PRECISION</text>
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
            <NordsheetLogo scale={0.75} />
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
            <NordsheetLogo scale={0.6} />
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
