"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
            <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
              <rect x="8" y="40" width="20" height="52" rx="3" fill="#f59e0b"/>
              <rect x="34" y="24" width="20" height="68" rx="3" fill="#fbbf24"/>
              <rect x="60" y="8" width="20" height="84" rx="3" fill="#f59e0b"/>
              <path d="M4 92h80" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <div className="login-left-wordmark">
              <span className="wm-nord">BYGG</span>
              <span className="wm-sheet">KALK</span>
            </div>
          </div>
          <div className="login-tagline">
            AI-driven<br />
            <span className="login-tagline-muted">kalkylering för</span><br />
            hantverkare.
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
            <svg width="52" height="52" viewBox="0 0 100 100" fill="none">
              <rect x="8" y="40" width="20" height="52" rx="3" fill="#f59e0b"/>
              <rect x="34" y="24" width="20" height="68" rx="3" fill="#fbbf24"/>
              <rect x="60" y="8" width="20" height="84" rx="3" fill="#f59e0b"/>
              <path d="M4 92h80" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="login-heading">Välkommen till ByggKalk</div>
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
