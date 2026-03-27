"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";

// ── Formatters ────────────────────────────────────────────────────
function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MSEK`;
  if (abs >= 1_000)     return `${Math.round(n / 1_000).toLocaleString("sv-SE")} tkr`;
  return `${Math.round(n)}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;
}

// ── KPI Card ──────────────────────────────────────────────────────
function KPICard({
  label, value, sub, trend, trendPos,
}: {
  label: string; value: string; sub: string;
  trend?: string; trendPos?: boolean;
}) {
  return (
    <div className="db-kpi">
      <div className="db-kpi-top">
        <div className="db-kpi-label">{label}</div>
        {trend && (
          <span className={`db-kpi-trend ${trendPos ? "trend-pos" : "trend-neg"}`}>
            {trendPos ? "▲" : "▼"} {trend}
          </span>
        )}
      </div>
      <div className={`db-kpi-val ${trendPos === false ? "neg" : ""}`}>{value}</div>
      <div className="db-kpi-sub">{sub}</div>
    </div>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────
function BarChart({
  data,
}: {
  data: { label: string; actual: number; budget: number }[];
}) {
  const maxVal = Math.max(...data.flatMap((d) => [d.actual, d.budget]), 1);
  return (
    <div className="db-bar-chart">
      <div className="db-bars">
        {data.map((d, i) => (
          <div key={i} className="db-bar-group">
            <div className="db-bar-pair">
              <div
                className="db-bar db-bar-actual"
                style={{ height: `${Math.round((d.actual / maxVal) * 82)}px` }}
                title={`Utfall: ${fmtMoney(d.actual)}`}
              />
              <div
                className="db-bar db-bar-budget"
                style={{ height: `${Math.round((d.budget / maxVal) * 82)}px` }}
                title={`Budget: ${fmtMoney(d.budget)}`}
              />
            </div>
            <div className="db-bar-label">{d.label}</div>
          </div>
        ))}
      </div>
      <div className="db-bar-legend">
        <div className="db-leg-item">
          <div className="db-leg-dot" style={{ background: "#6c63ff" }} />
          Utfall
        </div>
        <div className="db-leg-item">
          <div className="db-leg-dot" style={{ background: "rgba(108,99,255,0.25)" }} />
          Budget
        </div>
      </div>
    </div>
  );
}

// ── Donut Chart ───────────────────────────────────────────────────
function DonutChart({
  pct, centerText, centerSub, color, statA, statB,
}: {
  pct: number;
  centerText: string;
  centerSub: string;
  color: string;
  statA: { val: string; label: string; color?: string };
  statB: { val: string; label: string; color?: string };
}) {
  const r    = 40;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(Math.max(pct, 0), 1) * circ;

  return (
    <div className="db-donut-inner">
      <svg width="96" height="96" viewBox="0 0 110 110">
        <circle
          cx="55" cy="55" r={r}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"
        />
        <circle
          cx="55" cy="55" r={r}
          fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
        />
        <text x="55" y="50" textAnchor="middle" fontSize="16" fontWeight="600" fill="#f0f0f8">
          {centerText}
        </text>
        <text x="55" y="65" textAnchor="middle" fontSize="10" fill="#44445a">
          {centerSub}
        </text>
      </svg>
      <div className="db-donut-stats">
        <div className="db-donut-stat">
          <div className="db-donut-stat-val" style={{ color: statA.color }}>{statA.val}</div>
          <div className="db-donut-stat-label">{statA.label}</div>
        </div>
        <div className="db-donut-stat">
          <div className="db-donut-stat-val" style={{ color: statB.color }}>{statB.val}</div>
          <div className="db-donut-stat-label">{statB.label}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const pack        = getPack();
  const reportItems = getReportItems();

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

  // ── Beräkningar från pack ─────────────────────────────────────
  const totalActual = Number(pack.total_actual ?? 0);
  const totalBudget = Number(pack.total_budget ?? 0);
  const variance    = totalActual - totalBudget;
  const variancePct = totalBudget !== 0 ? variance / Math.abs(totalBudget) : 0;

  const kpiRow  = Array.isArray(pack.kpi_summary) ? (pack.kpi_summary[0] ?? {}) : {};
  const momPct  = kpiRow["MoM %"] != null ? Number(kpiRow["MoM %"]) : null;

  const topBudget   = Array.isArray(pack.top_budget) ? pack.top_budget : [];
  const topMom      = Array.isArray(pack.top_mom)    ? pack.top_mom    : [];

  // Täckningsgrad
  const withBudget  = topBudget.filter((x: any) => x.Budget && Number(x.Budget) !== 0).length;
  const totalKonton = topBudget.length || 1;
  const coveragePct = withBudget / totalKonton;

  // MoM-trend
  const positiveMoM  = topMom.filter((x: any) => Number(x["MoM diff"] ?? 0) > 0).length;
  const momTrendPct  = topMom.length > 0 ? positiveMoM / topMom.length : 0;
  const negativeMoM  = topMom.length - positiveMoM;

  // Stapeldiagram — topp 6 konton utfall vs budget
  const barData = topBudget.slice(0, 6).map((x: any) => ({
    label: String(x.Label || x.Konto || "—").slice(0, 8),
    actual: Math.abs(Number(x.Utfall ?? 0)),
    budget: Math.abs(Number(x.Budget ?? 0)),
  }));

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <div className="ns-page">

        {/* ── Header ── */}
        <div className="db-header">
          <div>
            <div className="ns-hero-title">Dashboard</div>
            <div className="ns-hero-sub">
              Finansiell översikt · {pack.current_period}
              {pack.previous_period && ` · jämför ${pack.previous_period}`}
            </div>
          </div>
          <div className="db-sync-pill">
            <span className="db-sync-dot" />
            Senaste uppladdning
          </div>
        </div>

        {/* ── KPI-rad ── */}
        <div className="db-kpi-row">
          <KPICard
            label="Totalt utfall"
            value={fmtMoney(totalActual)}
            sub={`Budget: ${fmtMoney(totalBudget)}`}
            trend={momPct !== null ? fmtPct(Math.abs(momPct)) + " MoM" : undefined}
            trendPos={momPct !== null ? momPct >= 0 : undefined}
          />
          <KPICard
            label="Budgetavvikelse"
            value={fmtMoney(variance)}
            sub={variance < 0 ? "Under plan" : "Över plan"}
            trend={fmtPct(Math.abs(variancePct))}
            trendPos={variance >= 0}
          />
          <KPICard
            label="Täckningsgrad"
            value={`${withBudget} / ${totalKonton}`}
            sub="Konton med budget"
            trend={`${Math.round(coveragePct * 100)}%`}
            trendPos={coveragePct >= 0.8}
          />
        </div>

        {/* ── Diagram-rad ── */}
        <div className="db-charts-row">
          {/* Stapeldiagram */}
          <div className="db-chart-card">
            <div className="db-card-head">
              <div>
                <div className="db-card-title">Utfall vs budget</div>
                <div className="db-card-sub">Topp konton denna period</div>
              </div>
            </div>
            {barData.length > 0 ? (
              <BarChart data={barData} />
            ) : (
              <div className="db-empty">Ingen data tillgänglig</div>
            )}
          </div>

          {/* Donut — MoM-trend */}
          <div className="db-donut-card">
            <div className="db-card-title">MoM-trend</div>
            <div className="db-card-sub">Konton bättre än föregående</div>
            <DonutChart
              pct={momTrendPct}
              centerText={`${Math.round(momTrendPct * 100)}%`}
              centerSub="positiv"
              color="#22c55e"
              statA={{ val: `${positiveMoM} st`, label: "Bättre", color: "#22c55e" }}
              statB={{ val: `${negativeMoM} st`, label: "Sämre",  color: "#ef4444" }}
            />
          </div>
        </div>

        {/* ── AI-sammanfattning (full bredd) ── */}
        <div className="db-narrative">
          <div className="db-narrative-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z"
                fill="#9b94ff"
              />
            </svg>
          </div>
          <div>
            <div className="db-narrative-title">AI-sammanfattning</div>
            <div className="db-narrative-text">
              {pack.narrative || "Ingen sammanfattning tillgänglig."}
            </div>
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}
