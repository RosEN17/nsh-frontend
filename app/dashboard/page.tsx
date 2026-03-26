"use client";

import { useEffect, useRef } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import AIInsights from "@/components/AIInsights";
import AIChat from "@/components/AIChat";
import { getPack, getReportItems } from "@/lib/store";

function DonutChart({
  title,
  sub,
  value,
  max,
  color,
  label,
}: {
  title: string;
  sub: string;
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const gap = circ - dash;

  return (
    <div className="donut-card">
      <div className="donut-wrap">
        <svg viewBox="0 0 140 140" width="140" height="140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
          <circle
            cx="70" cy="70" r={r}
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
          <text x="70" y="66" textAnchor="middle" fontSize="18" fontWeight="600" fill="#f0f0f8">{label}</text>
          <text x="70" y="82" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.35)">{Math.round(pct * 100)}%</text>
        </svg>
      </div>
      <div className="donut-title">{title}</div>
      <div className="donut-sub">{sub}</div>
    </div>
  );
}

export default function DashboardPage() {
  const pack = getPack();
  const reportItems = getReportItems();

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header reportCount={0} />
        <div className="ns-page">
          <div className="ns-hero">
            <div className="ns-hero-title">Dashboard</div>
            <div className="ns-hero-sub">Ingen analys laddad — gå till Connect först.</div>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  const totalActual  = pack.total_actual  || 0;
  const totalBudget  = pack.total_budget  || 1;
  const budgetUsedPct = totalBudget > 0 ? totalActual / totalBudget : 0;

  const topBudget = pack.top_budget || [];
  const topMom    = pack.top_mom    || [];

  // Budget utilisation
  const budgetLabel = `${Math.round(budgetUsedPct * 100)}%`;

  // Variance coverage: how many accounts have a budget vs total accounts
  const totalAccounts   = topBudget.length || 1;
  const withBudget      = topBudget.filter((x: any) => x.Budget != null && x.Budget !== 0).length;
  const coveragePct     = withBudget / totalAccounts;

  // MoM trend: share of accounts with positive MoM diff
  const positiveAccounts = topMom.filter((x: any) => (x["MoM diff"] ?? 0) > 0).length;
  const trendPct         = topMom.length > 0 ? positiveAccounts / topMom.length : 0;

  const fmtMoney = (n: number) => {
    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MSEK`;
    if (Math.abs(n) >= 1_000)     return `${Math.round(n / 1_000)} tkr`;
    return `${Math.round(n)}`;
  };

  const insights = [
    pack.narrative || "Ingen narrativ kommentar tillgänglig.",
    ...(pack.warnings || []).slice(0, 2),
  ];

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <div className="ns-page">
        <div className="ns-hero">
          <div className="ns-hero-title">Dashboard</div>
          <div className="ns-hero-sub">Översikt för period {pack.current_period}</div>
        </div>

        {/* KPI row */}
        <div className="kpi-grid">
          {[
            { title: "Utfall",         value: fmtMoney(totalActual), chip: "Aktuell period" },
            { title: "Budget",         value: fmtMoney(totalBudget), chip: "Aktuell period" },
            { title: "Avvikelse",      value: fmtMoney(totalActual - totalBudget), chip: "vs budget" },
            { title: "Föregående",     value: pack.previous_period || "—", chip: "Period" },
          ].map((c, i) => (
            <div key={i} className="kpi-card">
              <div className="kpi-title">{c.title}</div>
              <div className="kpi-value">{c.value}</div>
              <div className="kpi-sub"><span className="kpi-chip">{c.chip}</span></div>
            </div>
          ))}
        </div>

        {/* Donut charts */}
        <div className="donut-grid">
          <DonutChart
            title="Budgetutnyttjande"
            sub="Utfall som andel av budget"
            value={totalActual}
            max={totalBudget}
            color="#6c63ff"
            label={fmtMoney(totalActual)}
          />
          <DonutChart
            title="Budgettäckning"
            sub="Andel konton med budget"
            value={withBudget}
            max={totalAccounts}
            color="#22c55e"
            label={`${withBudget}/${totalAccounts}`}
          />
          <DonutChart
            title="Positiv MoM-trend"
            sub="Andel konton bättre än föregående"
            value={positiveAccounts}
            max={topMom.length || 1}
            color="#f59e0b"
            label={`${positiveAccounts}/${topMom.length || 0}`}
          />
        </div>

        {/* AI row */}
        <div className="two-col">
          <AIInsights insights={insights} />
          <AIChat pack={pack} />
        </div>
      </div>
    </ProtectedLayout>
  );
}
