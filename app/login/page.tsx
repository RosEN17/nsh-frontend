"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function StarLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <path d="M100 0C100 0,120 75,125 80C130 85,200 100,200 100C200 100,130 115,125 120C120 125,100 200,100 200C100 200,80 125,75 120C70 115,0 100,0 100C0 100,70 85,75 80C80 75,100 0,100 0Z" fill="white"/>
      <path d="M100 72C100 72,108 90,112 94C116 98,134 100,134 100C134 100,116 102,112 106C108 110,100 128,100 128C100 128,92 110,88 106C84 102,66 100,66 100C66 100,84 98,88 94C92 90,100 72,100 72Z" fill="#f97316"/>
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
            <StarLogo size={32} />
            <div className="login-left-wordmark">
              <span className="wm-nord">NORD</span>
              <span className="wm-sheet">SHEET</span>
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
            <StarLogo size={52} />
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
