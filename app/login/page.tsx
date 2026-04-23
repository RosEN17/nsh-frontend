"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: { main: 14, sub: 8, spacing: "1.6px", gap: 2 },
    md: { main: 17, sub: 9, spacing: "1.8px", gap: 2 },
    lg: { main: 22, sub: 10, spacing: "2px", gap: 3 },
  };
  const s = sizes[size];
  return (
    <div>
      <div style={{ lineHeight: 1 }}>
        <span style={{ fontSize: s.main, fontWeight: 700, color: "#6a8193" }}>Nord</span>
        <span style={{ fontSize: s.main, fontWeight: 700, color: "#ffffff" }}>Sheet</span>
      </div>
      <div style={{ fontSize: s.sub, letterSpacing: s.spacing, color: "#6a8193", fontWeight: 600, marginTop: s.gap }}>
        SNABB PRECISION
      </div>
    </div>
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
            <Logo size="md" />
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
            <Logo size="lg" />
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
