"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function NordsheetStar({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <path
        d="M100 4 C100 4,118 82,196 100 C118 118,100 196,100 196 C100 196,82 118,4 100 C82 82,100 4,100 4Z"
        fill="white"
      />
      <path
        d="M100 52 C100 52,112 88,148 100 C112 112,100 148,100 148 C100 148,88 112,52 100 C88 88,100 52,100 52Z"
        fill="#0a0a0f"
      />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Fel e-post eller lösenord. Försök igen.");
      return;
    }
    router.push("/connect");
  }

  return (
    <div className="login-shell">
      {/* Left panel */}
      <div className="login-left">
        <div className="login-left-bg" />
        <div className="login-left-content">
          <div className="login-left-logo">
            <NordsheetStar size={28} />
            <div className="login-left-wordmark">
              <span className="wm-nord">NORD</span>
              <span className="wm-sheet">SHEET</span>
            </div>
          </div>
          <div className="login-tagline">
            Finance intelligence<br />
            <span className="login-tagline-muted">for the modern</span><br />
            controller.
          </div>
          <div className="login-features">
            {[
              "AI-driven variansanalys",
              "Automatisk kolumnmapping",
              "Export till PPTX & DOCX",
              "Realtids AI Copilot",
            ].map((f) => (
              <div key={f} className="login-feat">
                <span className="login-feat-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-logo-wrap">
            <NordsheetStar size={52} />
          </div>

          <div className="login-heading">Välkommen tillbaka</div>
          <div className="login-sub">Logga in på ditt Nordsheet-konto</div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="login-field">
              <label className="login-label">E-POSTADRESS</label>
              <input
                className="login-input"
                type="email"
                placeholder="namn@foretag.se"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="login-field">
              <label className="login-label">LÖSENORD</label>
              <input
                className="login-input"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? "Loggar in..." : "Logga in"}
            </button>
          </form>

          <div className="login-footer">
            Inget konto? Kontakta din administratör.
          </div>

          <div className="login-badges">
            <span className="login-badge">256-bit kryptering</span>
            <span className="login-badge">GDPR-säker</span>
            <span className="login-badge">Supabase Auth</span>
          </div>
        </div>
      </div>
    </div>
  );
}
