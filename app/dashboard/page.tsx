"use client";

import { useState, useMemo } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";

function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MSEK`;
  if (abs >= 1_000)     return `${Math.round(n / 1_000)} tkr`;
  return `${Math.round(n)} kr`;
}

/* ═══════════════════════════════════════════════════════════════════
   COMPARISON LOGIC
   ═══════════════════════════════════════════════════════════════════ */

type CompareMode = "mom" | "yoy";

function parsePeriod(p: string): { year: number; month: number } | null {
  const m1 = p.match(/^(\d{4})-(\d{2})$/);
  if (m1) return { year: parseInt(m1[1]), month: parseInt(m1[2]) };
  const m2 = p.match(/^(\d{4})(\d{2})$/);
  if (m2) return { year: parseInt(m2[1]), month: parseInt(m2[2]) };
  return null;
}

function getComparePeriod(period: string, mode: CompareMode): string | null {
  const p = parsePeriod(period);
  if (!p) return null;
  if (mode === "mom") {
    const m = p.month - 1;
    if (m < 1) return `${p.year - 1}-12`;
    return `${p.year}-${String(m).padStart(2, "0")}`;
  }
  return `${p.year - 1}-${String(p.month).padStart(2, "0")}`;
}

function computeComparison(detailedRows: any[], selectedPeriod: string, comparePeriod: string) {
  const current = detailedRows.filter((r: any) => String(r.period || "") === selectedPeriod);
  const compare = detailedRows.filter((r: any) => String(r.period || "") === comparePeriod);

  const currentMap: Record<string, { actual: number; budget: number; name: string }> = {};
  for (const r of current) {
    const k = String(r.account || "");
    if (!currentMap[k]) currentMap[k] = { actual: 0, budget: 0, name: String(r.account_name || k) };
    currentMap[k].actual += Number(r.actual || 0);
    currentMap[k].budget += Number(r.budget || 0);
  }
  const compareMap: Record<string, { actual: number; budget: number }> = {};
  for (const r of compare) {
    const k = String(r.account || "");
    if (!compareMap[k]) compareMap[k] = { actual: 0, budget: 0 };
    compareMap[k].actual += Number(r.actual || 0);
    compareMap[k].budget += Number(r.budget || 0);
  }

  const totalCurrent = Object.values(currentMap).reduce((s, v) => s + v.actual, 0);
  const totalCompare = Object.values(compareMap).reduce((s, v) => s + v.actual, 0);
  const totalDiff = totalCurrent - totalCompare;
  const totalPct = totalCompare !== 0 ? totalDiff / Math.abs(totalCompare) : 0;

  const allAccounts = new Set([...Object.keys(currentMap), ...Object.keys(compareMap)]);
  const diffs = Array.from(allAccounts).map(k => {
    const cur = currentMap[k]?.actual || 0;
    const comp = compareMap[k]?.actual || 0;
    const diff = cur - comp;
    const pctDiff = comp !== 0 ? diff / Math.abs(comp) : 0;
    return { account: k, label: currentMap[k]?.name || k, current: cur, compare: comp, diff, pctDiff };
  }).sort((a, b) => a.diff - b.diff);

  return {
    totalCurrent, totalCompare, totalDiff, totalPct,
    negDiffs: diffs.filter(d => d.diff < 0).slice(0, 5),
    posDiffs: diffs.filter(d => d.diff > 0).reverse().slice(0, 5),
  };
}


/* ═══════════════════════════════════════════════════════════════════
   CHART DATA — builds usable chart values from period_series
   or falls back to detailed_rows if period_series has near-zero values
   ═══════════════════════════════════════════════════════════════════ */

function buildChartData(pack: any) {
  const periodSeries = Array.isArray(pack.period_series) ? pack.period_series : [];
  const detailedRows = Array.isArray(pack.detailed_rows) ? pack.detailed_rows : [];

  // First try period_series
  if (periodSeries.length > 0) {
    const vals = periodSeries.slice(-8).map((p: any) => ({
      period: String(p.period || ""),
      value: Math.abs(Number(p.actual || 0)),
    }));
    const maxVal = Math.max(...vals.map((v: { period: string; value: number }) => v.value), 1);

    // If the max value is meaningful (> 100), use period_series
    if (maxVal > 100) {
      return { bars: vals, max: maxVal, label: "Resultaträkning" };
    }
  }

  // Fallback: compute from detailed_rows
  if (detailedRows.length > 0) {
    const byPeriod: Record<string, number> = {};
    for (const r of detailedRows) {
      const p = String(r.period || "");
      if (!p) continue;
      byPeriod[p] = (byPeriod[p] || 0) + Math.abs(Number(r.actual || 0));
    }
    const sorted = Object.entries(byPeriod)
      .sort(([a]: [string, number], [b]: [string, number]) => a.localeCompare(b))
      .slice(-8);
    const vals = sorted.map(([period, value]: [string, number]) => ({ period, value }));
    const maxVal = Math.max(...vals.map(v => v.value), 1);
    return { bars: vals, max: maxVal, label: "Totalt omsättning" };
  }

  return { bars: [], max: 1, label: "Ingen data" };
}


/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const pack = getPack();

  const [compareMode, setCompareMode] = useState<CompareMode>("mom");

  const periods = useMemo(() => pack?.periods || [], [pack]);
  const [selectedPeriod, setSelectedPeriod] = useState(() =>
    pack?.current_period || (periods.length > 0 ? periods[periods.length - 1] : "")
  );

  const comparison = useMemo(() => {
    if (!pack) return null;
    const detailedRows = pack.detailed_rows || [];
    const comparePeriod = getComparePeriod(selectedPeriod, compareMode);
    if (detailedRows.length > 0 && comparePeriod) {
      return computeComparison(detailedRows, selectedPeriod, comparePeriod);
    }
    return null;
  }, [pack, selectedPeriod, compareMode]);

  const comparePeriodLabel = getComparePeriod(selectedPeriod, compareMode) || "—";

  /* ── empty state ── */
  if (!pack) {
    return (
      <ProtectedLayout>
        <Header />
        <div className="ns-page">
          <div className="ns-hero-title">Dashboard</div>
          <div className="ns-hero-sub" style={{ marginTop: 6 }}>
            Ingen analys laddad — gå till <a href="/data" style={{ color: "var(--accent-text)" }}>Data</a> och koppla Fortnox eller ladda upp en fil.
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  function clean(v: any) {
    const s = String(v ?? "").trim();
    return !s || s.toLowerCase() === "nan" ? "" : s;
  }

  const totalActual  = comparison ? comparison.totalCurrent : Number(pack.total_actual ?? 0);
  const totalBudget  = Number(pack.total_budget ?? 0);
  const variance     = comparison ? comparison.totalDiff : (totalActual - totalBudget);
  const variancePct  = comparison ? Math.abs(comparison.totalPct) : (totalBudget !== 0 ? Math.abs(variance / totalBudget) : 0);
  const allFlagged   = Array.isArray(pack.all_flagged) ? pack.all_flagged : [];
  const dataSource   = pack.source === "fortnox" ? "Fortnox" : "Filuppladdning";

  // Alerts count
  const critCount = allFlagged.filter((a: any) => String(a.severity || a.Severity || "").toLowerCase().includes("krit")).length;
  const warnCount = allFlagged.length - critCount;

  // Chart data with fallback
  const chartData = buildChartData(pack);

  // Short month label
  const MONTHS = ["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"];
  function shortLabel(period: string) {
    const p = parsePeriod(period);
    if (!p) return period.slice(-5);
    return MONTHS[p.month - 1] || period.slice(-2);
  }

  const compLabel = compareMode === "mom" ? "Month-over-Month" : "Year-over-Year";

  return (
    <ProtectedLayout>
      <Header />
      <div className="rd-page">

        {/* ── Page header ── */}
        <div className="rd-header">
          <div>
            <div className="rd-title">Dashboard</div>
            <div className="rd-sub">
              {selectedPeriod} vs {comparePeriodLabel} · via {dataSource}
            </div>
          </div>
          <div className="rd-controls">
            <div className="rd-toggle-group">
              <button className={`rd-toggle-btn${compareMode === "mom" ? " active" : ""}`}
                onClick={() => setCompareMode("mom")}>MoM</button>
              <button className={`rd-toggle-btn${compareMode === "yoy" ? " active" : ""}`}
                onClick={() => setCompareMode("yoy")}>YoY</button>
            </div>
            {periods.length > 1 && (
              <select className="rd-period-select" value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value)}>
                {periods.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* ── KPI Row (3 cards) ── */}
        <div className="rd-kpi-row" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="rd-kpi">
            <div className="rd-kpi-label">Resultat {selectedPeriod}</div>
            <div className="rd-kpi-value">{fmtMoney(totalActual)}</div>
            <div className="rd-kpi-sub">Budget: {fmtMoney(totalBudget)}</div>
          </div>

          <div className="rd-kpi">
            <div className="rd-kpi-label">Förändring {compareMode === "mom" ? "MoM" : "YoY"}</div>
            <div>
              <span className="rd-kpi-value" style={{ color: variance >= 0 ? "var(--green)" : "var(--red)" }}>
                {variance >= 0 ? "+" : ""}{Math.round(variancePct * 100)}%
              </span>
              <span className={`rd-kpi-trend ${variance >= 0 ? "up" : "down"}`}>
                {variance >= 0 ? "↑" : "↓"} {fmtMoney(Math.abs(variance))}
              </span>
            </div>
            <div className="rd-kpi-sub">vs {comparePeriodLabel}</div>
          </div>

          <div className="rd-kpi">
            <div className="rd-kpi-label">Avvikelser</div>
            <div>
              <span className="rd-kpi-value" style={{ color: allFlagged.length > 0 ? "var(--red)" : "var(--text-primary)" }}>
                {allFlagged.length}
              </span>
            </div>
            <div className="rd-kpi-sub">
              {critCount > 0 ? `${critCount} kritiska` : ""}
              {critCount > 0 && warnCount > 0 ? ", " : ""}
              {warnCount > 0 ? `${warnCount} varningar` : ""}
              {allFlagged.length === 0 ? "Inga flaggade" : ""}
            </div>
          </div>
        </div>

        {/* ── Compare banner ── */}
        {comparison && (
          <div className="rd-compare-banner">
            <span>
              <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>{compLabel}:</span>{" "}
              {selectedPeriod} vs {comparePeriodLabel}
            </span>
            <span className="rd-compare-result" style={{ color: comparison.totalDiff >= 0 ? "var(--green)" : "var(--red)" }}>
              {comparison.totalDiff >= 0 ? "+" : ""}{fmtMoney(comparison.totalDiff)} ({comparison.totalPct >= 0 ? "+" : ""}{Math.round(comparison.totalPct * 100)}%)
            </span>
          </div>
        )}

        {/* ── Content grid: chart left, alerts + AI right ── */}
        <div className="rd-content-grid">

          {/* ── Chart card ── */}
          <div className="rd-card">
            <div className="rd-card-title">Utfall över tid</div>
            <div className="rd-card-sub">{chartData.label} · senaste {chartData.bars.length} perioder</div>
            {chartData.bars.length > 0 ? (
              <>
                <div className="rd-chart-area">
                  {chartData.bars.map((bar: { period: string; value: number }, i: number) => {
                    const h = chartData.max > 0 ? (bar.value / chartData.max) * 100 : 2;
                    const isLast = i === chartData.bars.length - 1;
                    return (
                      <div key={i} className="rd-chart-bar-group">
                        <div className="rd-chart-bar"
                          style={{
                            height: `${Math.max(h, 3)}%`,
                            background: "var(--accent)",
                            opacity: isLast ? 1 : 0.6,
                            boxShadow: isLast ? "0 0 12px rgba(108,99,255,0.3)" : "none",
                          }} />
                        <div className="rd-chart-label"
                          style={{
                            color: isLast ? "var(--accent-text)" : "var(--text-faint)",
                            fontWeight: isLast ? 500 : 400,
                          }}>
                          {shortLabel(bar.period)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rd-chart-legend">
                  <div className="rd-chart-legend-item">
                    <div className="rd-chart-legend-dot" style={{ background: "var(--accent)" }} />
                    Utfall
                  </div>
                  <div className="rd-chart-legend-item">
                    <div className="rd-chart-legend-dot" style={{ background: "rgba(255,255,255,0.08)" }} />
                    Budget
                  </div>
                </div>
              </>
            ) : (
              <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "var(--text-faint)" }}>
                Ingen perioddata tillgänglig
              </div>
            )}
          </div>

          {/* ── Right column: alerts + AI ── */}
          <div>
            {/* Alerts */}
            <div className="rd-alerts-section">
              <div className="rd-alerts-title-row">
                <span className="rd-alerts-title">Kräver uppmärksamhet</span>
                <a href="/variances" className="rd-alerts-link">Visa alla →</a>
              </div>

              {allFlagged.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "16px 0" }}>
                  Inga avvikelser att visa.
                </div>
              ) : allFlagged.slice(0, 4).map((a: any, i: number) => {
                const sev = String(a.severity || a.Severity || "").toLowerCase();
                const isCrit = sev.includes("krit") || sev.includes("crit");
                const impact = Number(a.impact ?? a["Vs budget diff"] ?? a.diff ?? 0);
                const headline = a.headline || a.Label || a.Konto || "Avvikelse";
                const meta = a.meta || `${clean(a.Konto || a.account || "")}`;
                const trend = a.trend || (a.escalating ? "Eskalerar" : "");

                return (
                  <div key={i} className="rd-alert-item">
                    <div className={`rd-alert-dot ${isCrit ? "critical" : "warning"}`} />
                    <div className="rd-alert-content">
                      <div className="rd-alert-headline">{headline}</div>
                      <div className="rd-alert-meta">
                        {meta}{trend ? ` · ${trend}` : ""}
                      </div>
                    </div>
                    <span className={`rd-alert-sev ${isCrit ? "critical" : "warning"}`}>
                      {isCrit ? "Kritisk" : "Varning"}
                    </span>
                    <span className="rd-alert-value neg">
                      {impact >= 0 ? "+" : ""}{fmtMoney(impact)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* AI narrative */}
            {pack.narrative && (
              <div className="rd-ai-card">
                <div className="rd-ai-icon">✦</div>
                <div className="rd-ai-title">AI-sammanfattning</div>
                <div className="rd-ai-text">{pack.narrative}</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Export CTA ── */}
        <div className="rd-export-row">
          <div className="rd-export-text">
            <strong>Redo att presentera?</strong> Exportera en rapport baserad på din data och AI-analys.
          </div>
          <div className="rd-export-btns">
            <a href="/export" className="rd-export-btn primary">Exportera PPTX</a>
            <a href="/export" className="rd-export-btn secondary">DOCX</a>
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}
