"use client";

import { useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";

function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MSEK`;
  if (abs >= 1_000)     return `${Math.round(n / 1_000)} tkr`;
  return `${Math.round(n)}`;
}

// ── Sparkline (mini SVG line) ─────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 80; const H = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={pts.split(" ").at(-1)!.split(",")[0]}
        cy={pts.split(" ").at(-1)!.split(",")[1]}
        r="2.5" fill={color} />
    </svg>
  );
}

// ── KPI card ──────────────────────────────────────────────────────
function KPICard({ label, value, sub, trend, trendPos, sparkValues }: {
  label: string; value: string; sub: string;
  trend?: string; trendPos?: boolean; sparkValues?: number[];
}) {
  return (
    <div className="db2-kpi">
      <div className="db2-kpi-top">
        <span className="db2-kpi-label">{label}</span>
        {trend && (
          <span className={`db2-kpi-badge ${trendPos ? "db2-badge-pos" : "db2-badge-neg"}`}>
            {trendPos ? "↑" : "↓"} {trend}
          </span>
        )}
      </div>
      <div className="db2-kpi-bottom">
        <div>
          <div className={`db2-kpi-val ${trendPos === false ? "db2-val-neg" : ""}`}>{value}</div>
          <div className="db2-kpi-sub">{sub}</div>
        </div>
        {sparkValues && sparkValues.length >= 2 && (
          <Sparkline values={sparkValues} color={trendPos === false ? "#ef4444" : "#6c63ff"} />
        )}
      </div>
    </div>
  );
}

// ── Horizontal bar ─────────────────────────────────────────────────
function HBar({ label, actual, budget, max }: {
  label: string; actual: number; budget: number; max: number;
}) {
  const aW = max > 0 ? (Math.abs(actual) / max) * 100 : 0;
  const bW = max > 0 ? (Math.abs(budget) / max) * 100 : 0;
  const pos = actual >= budget;
  return (
    <div className="db2-hbar-row">
      <div className="db2-hbar-label">{label}</div>
      <div className="db2-hbar-tracks">
        <div className="db2-hbar-track">
          <div className="db2-hbar-fill db2-hbar-actual"
            style={{ width: `${aW}%` }} />
        </div>
        <div className="db2-hbar-track db2-hbar-track-budget">
          <div className="db2-hbar-fill db2-hbar-budget-fill"
            style={{ width: `${bW}%` }} />
        </div>
      </div>
      <div className={`db2-hbar-val ${pos ? "db2-pos" : "db2-neg"}`}>
        {fmtMoney(actual)}
      </div>
    </div>
  );
}

// ── Variance item row ──────────────────────────────────────────────
function VarRow({ label, konto, impact, pct }: {
  label: string; konto: string; impact: number; pct: number;
}) {
  const pos  = impact >= 0;
  const barW = Math.min(Math.abs(pct) * 300, 100);
  return (
    <div className="db2-var-row">
      <div className="db2-var-left">
        {konto && <span className="db2-var-konto">{konto}</span>}
        <span className="db2-var-name">{label}</span>
      </div>
      <div className="db2-var-bar-wrap">
        <div className="db2-var-bar-track">
          <div className="db2-var-bar-fill"
            style={{ width: `${barW}%`, background: pos ? "#22c55e" : "#ef4444" }} />
        </div>
      </div>
      <div className={`db2-var-val ${pos ? "db2-pos" : "db2-neg"}`}>
        {pos ? "+" : "−"}{fmtMoney(Math.abs(impact))}
      </div>
    </div>
  );
}

// ── Period dot timeline ────────────────────────────────────────────
function PeriodTimeline({ series }: { series: any[] }) {
  if (!series || series.length < 2) return null;
  const max = Math.max(...series.map((p: any) => Math.abs(Number(p.actual || 0))), 1);
  const W = 100; const H = 44;
  const pts = series.slice(-8).map((p: any, i: number, arr) => {
    const x = arr.length < 2 ? W / 2 : (i / (arr.length - 1)) * W;
    const y = H - (Math.abs(Number(p.actual || 0)) / max) * (H - 8) - 4;
    return { x, y, val: Number(p.actual || 0), label: String(p.period || "") };
  });
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaD = `${pathD} L${pts.at(-1)!.x},${H} L${pts[0].x},${H} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#6c63ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#areaGrad)" />
      <path d={pathD} fill="none" stroke="#6c63ff" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5"
          fill={i === pts.length - 1 ? "#6c63ff" : "var(--bg-elevated)"}
          stroke="#6c63ff" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

// ── Main page ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const pack        = getPack();
  const reportItems = getReportItems();
  const [activeVar, setActiveVar] = useState<"neg" | "pos">("neg");

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header reportCount={0} />
        <div className="ns-page">
          <div className="ns-hero-title">Dashboard</div>
          <div className="ns-hero-sub" style={{ marginTop: 6 }}>
            Ingen analys laddad — gå till Connect och ladda upp en fil först.
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  const totalActual  = Number(pack.total_actual  ?? 0);
  const totalBudget  = Number(pack.total_budget  ?? 0);
  const variance     = totalActual - totalBudget;
  const variancePct  = totalBudget !== 0 ? Math.abs(variance / totalBudget) : 0;
  const kpiRow       = Array.isArray(pack.kpi_summary) ? (pack.kpi_summary[0] ?? {}) : {};
  const momPct       = kpiRow["MoM %"] != null ? Number(kpiRow["MoM %"]) : null;
  const topBudget    = Array.isArray(pack.top_budget) ? pack.top_budget : [];
  const topMom       = Array.isArray(pack.top_mom)    ? pack.top_mom    : [];
  const periodSeries = Array.isArray(pack.period_series) ? pack.period_series : [];

  // Täckningsgrad
  const withBudget   = topBudget.filter((x: any) => x.Budget && Number(x.Budget) !== 0).length;
  const totalKonton  = topBudget.length || 1;

  // Sparkline from period series
  const sparkActuals = periodSeries.slice(-8).map((p: any) => Math.abs(Number(p.actual || 0)));

  // Hbar max
  const hbarMax = Math.max(...topBudget.slice(0, 5).flatMap((x: any) => [
    Math.abs(Number(x.Utfall ?? 0)), Math.abs(Number(x.Budget ?? 0))
  ]), 1);

  // Variances split
  const negVars = topBudget.filter((x: any) => Number(x["Vs budget diff"] ?? 0) < 0).slice(0, 5);
  const posVars = topMom.filter((x: any) =>    Number(x["Vs budget diff"] ?? 0) > 0).slice(0, 5);
  const shownVars = activeVar === "neg" ? negVars : posVars;

  // Completion donut
  const donePct  = (withBudget / totalKonton);
  const R = 32; const C = 2 * Math.PI * R;
  const dash = donePct * C;

  function clean(v: any) {
    const s = String(v ?? "").trim();
    return !s || s.toLowerCase() === "nan" ? "" : s;
  }

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <div className="ns-page db2-page">

        {/* ── Top header ── */}
        <div className="db2-header">
          <div>
            <div className="ns-hero-title">Dashboard</div>
            <div className="ns-hero-sub">
              {pack.current_period}
              {pack.previous_period && ` · jämför ${pack.previous_period}`}
            </div>
          </div>
          <div className="db2-header-right">
            <div className="db2-live-pill">
              <span className="db2-live-dot" />
              Senaste uppladdning
            </div>
            <a href="/variances" className="db2-goto-btn">
              Hantera avvikelser →
            </a>
          </div>
        </div>

        {/* ── KPI row ── */}
        <div className="db2-kpi-row">
          <KPICard
            label="Totalt utfall"
            value={fmtMoney(totalActual)}
            sub={`Budget ${fmtMoney(totalBudget)}`}
            trend={momPct !== null ? `${Math.abs(Math.round(momPct * 100))}% MoM` : undefined}
            trendPos={momPct !== null ? momPct >= 0 : undefined}
            sparkValues={sparkActuals}
          />
          <KPICard
            label="Budgetavvikelse"
            value={fmtMoney(variance)}
            sub={variance < 0 ? "Under plan" : "Över plan"}
            trend={`${Math.round(variancePct * 100)}%`}
            trendPos={variance >= 0}
          />
          <KPICard
            label="Konton med budget"
            value={`${withBudget} / ${totalKonton}`}
            sub={`${Math.round(donePct * 100)}% täckningsgrad`}
            trendPos={donePct >= 0.8}
            trend={`${Math.round(donePct * 100)}%`}
          />
          {momPct !== null && (
            <KPICard
              label="MoM förändring"
              value={`${momPct >= 0 ? "+" : ""}${Math.round(momPct * 100)}%`}
              sub={`vs ${pack.previous_period || "föregående"}`}
              trendPos={momPct >= 0}
            />
          )}
        </div>

        {/* ── Middle row ── */}
        <div className="db2-mid-row">

          {/* Trend chart */}
          <div className="db2-card db2-trend-card">
            <div className="db2-card-head">
              <div>
                <div className="db2-card-title">Utfall över tid</div>
                <div className="db2-card-sub">Senaste perioder</div>
              </div>
              <div className="db2-trend-val">
                {fmtMoney(totalActual)}
              </div>
            </div>
            <div className="db2-trend-chart">
              <PeriodTimeline series={periodSeries} />
            </div>
            <div className="db2-trend-labels">
              {periodSeries.slice(-4).map((p: any, i: number) => (
                <span key={i} className="db2-trend-label">{String(p.period || "").slice(-5)}</span>
              ))}
            </div>
          </div>

          {/* Top variances */}
          <div className="db2-card db2-var-card">
            <div className="db2-card-head">
              <div className="db2-card-title">Avvikelser</div>
              <div className="db2-var-tabs">
                <button
                  className={`db2-var-tab${activeVar === "neg" ? " active" : ""}`}
                  onClick={() => setActiveVar("neg")}>
                  Negativa {negVars.length > 0 && <span className="db2-tab-count">{negVars.length}</span>}
                </button>
                <button
                  className={`db2-var-tab${activeVar === "pos" ? " active" : ""}`}
                  onClick={() => setActiveVar("pos")}>
                  Positiva {posVars.length > 0 && <span className="db2-tab-count db2-tab-count-pos">{posVars.length}</span>}
                </button>
              </div>
            </div>
            <div className="db2-var-list">
              {shownVars.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "12px 0" }}>
                  Inga avvikelser att visa
                </div>
              ) : shownVars.map((x: any, i: number) => (
                <VarRow key={i}
                  label={clean(x.Label || x.Konto) || "—"}
                  konto={clean(x.Konto)}
                  impact={Number(x["Vs budget diff"] ?? x["MoM diff"] ?? 0)}
                  pct={Number(x["Vs budget %"] ?? x["MoM %"] ?? 0)}
                />
              ))}
            </div>
            <a href="/variances" className="db2-var-more">
              Visa alla avvikelser →
            </a>
          </div>

          {/* Coverage donut */}
          <div className="db2-card db2-donut-card">
            <div className="db2-card-title">Budgettäckning</div>
            <div className="db2-card-sub" style={{ marginBottom: 16 }}>Konton med budget</div>
            <div className="db2-donut-wrap">
              <svg width="100" height="100" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r={R}
                  fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <circle cx="40" cy="40" r={R}
                  fill="none" stroke="#6c63ff" strokeWidth="8"
                  strokeDasharray={`${dash} ${C}`}
                  strokeLinecap="round"
                  transform="rotate(-90 40 40)" />
                <text x="40" y="36" textAnchor="middle" fontSize="14"
                  fontWeight="600" fill="#f0f0f8">
                  {Math.round(donePct * 100)}%
                </text>
                <text x="40" y="50" textAnchor="middle" fontSize="9" fill="#44445a">
                  täckt
                </text>
              </svg>
            </div>
            <div className="db2-donut-stats">
              <div className="db2-donut-stat">
                <div className="db2-donut-stat-val" style={{ color: "#6c63ff" }}>{withBudget}</div>
                <div className="db2-donut-stat-label">Med budget</div>
              </div>
              <div className="db2-donut-stat">
                <div className="db2-donut-stat-val" style={{ color: "var(--text-faint)" }}>
                  {totalKonton - withBudget}
                </div>
                <div className="db2-donut-stat-label">Utan budget</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Hbar + AI row ── */}
        <div className="db2-bottom-row">

          {/* Top konton hbar */}
          <div className="db2-card db2-hbar-card">
            <div className="db2-card-head">
              <div>
                <div className="db2-card-title">Topp konton</div>
                <div className="db2-card-sub">Utfall vs budget</div>
              </div>
              <div className="db2-hbar-legend">
                <span className="db2-leg-dot" style={{ background: "#6c63ff" }} />
                <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Utfall</span>
                <span className="db2-leg-dot" style={{ background: "rgba(255,255,255,0.12)" }} />
                <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Budget</span>
              </div>
            </div>
            <div className="db2-hbar-list">
              {topBudget.slice(0, 5).map((x: any, i: number) => (
                <HBar key={i}
                  label={clean(x.Label || x.Konto) || "—"}
                  actual={Number(x.Utfall ?? 0)}
                  budget={Number(x.Budget ?? 0)}
                  max={hbarMax}
                />
              ))}
            </div>
          </div>

          {/* AI narrative */}
          <div className="db2-card db2-ai-card">
            <div className="db2-ai-icon">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z"
                  fill="#9b94ff" />
              </svg>
            </div>
            <div className="db2-ai-title">AI-sammanfattning</div>
            <div className="db2-ai-text">
              {pack.narrative || "Ingen sammanfattning tillgänglig."}
            </div>
            {pack.warnings?.length > 0 && (
              <div className="db2-ai-warnings">
                {pack.warnings.slice(0, 2).map((w: string, i: number) => (
                  <div key={i} className="db2-ai-warning">
                    <span className="db2-warn-dot" />
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
