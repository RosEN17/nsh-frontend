"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack } from "@/lib/store";

function fmt(n: number | null): string {
  if (n === null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n/1_000_000).toFixed(1)} MSEK`;
  if (abs >= 1_000) return `${Math.round(n/1_000)} tkr`;
  return `${Math.round(n)}`;
}

function clean(v: any): string {
  const s = String(v ?? "").trim();
  return !s || s.toLowerCase() === "nan" ? "—" : s;
}

export default function AlertsPage() {
  const pack = getPack();

  const alerts = pack ? [
    ...(pack.top_budget || []).map((x: any) => ({
      type: "budget",
      label: clean(x.Label || x.Konto),
      konto: clean(x.Konto),
      impact: Number(x["Vs budget diff"] ?? x.variance ?? 0),
      severity: Math.abs(Number(x["Vs budget diff"] ?? 0)) > 100_000 ? "high" : "medium",
    })),
    ...(pack.top_mom || []).map((x: any) => ({
      type: "mom",
      label: clean(x.Label || x.Konto),
      konto: clean(x.Konto),
      impact: Number(x["MoM diff"] ?? 0),
      severity: "low",
    })),
  ] : [];

  return (
    <ProtectedLayout>
      <Header reportCount={0} />
      <div className="ns-page">
        <div className="ns-hero-title">AI Alerts</div>
        <div className="ns-hero-sub" style={{ marginTop: 3 }}>
          {alerts.length} avvikelser flaggade av AI
        </div>

        {alerts.length === 0 ? (
          <div className="sb-empty-state">
            <div className="sb-empty-icon">
              <svg width="24" height="24" viewBox="0 0 16 16" fill="none">
                <path d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z" fill="var(--text-faint)"/>
              </svg>
            </div>
            <div className="sb-empty-title">Inga alerts</div>
            <div className="sb-empty-sub">Ladda upp en fil i Connect för att se AI-flaggade avvikelser.</div>
          </div>
        ) : (
          <div className="alerts-list">
            {alerts.map((a, i) => {
              const pos = a.impact >= 0;
              const sev = a.severity;
              return (
                <div key={i} className={`alert-card-item alert-sev-${sev}`}>
                  <div className={`alert-sev-bar alert-sev-bar-${sev}`} />
                  <div className="alert-body">
                    <div className="alert-top-row">
                      <div className="alert-label">{a.label}</div>
                      <span className={`alert-impact ${pos ? "impact-pos" : "impact-neg"}`}>
                        {pos ? "+ " : "− "}{fmt(Math.abs(a.impact))}
                      </span>
                    </div>
                    <div className="alert-meta">
                      <span className="alert-konto">{a.konto !== "—" ? a.konto : ""}</span>
                      <span className={`alert-type-badge ${a.type}`}>
                        {a.type === "budget" ? "vs budget" : "MoM"}
                      </span>
                      <span className={`alert-severity-badge ${sev}`}>
                        {sev === "high" ? "Hög prioritet" : sev === "medium" ? "Medium" : "Låg"}
                      </span>
                    </div>
                  </div>
                  <a href="/variances" className="alert-action-btn">Hantera →</a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
