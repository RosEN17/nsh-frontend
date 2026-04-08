"use client";

import { useState, useMemo } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";

// ── Formatters ────────────────────────────────────────────────────
function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MSEK`;
  if (abs >= 1_000)     return `${Math.round(n / 1_000)} tkr`;
  return `${Math.round(n)} kr`;
}
function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;
}
function clean(v: any): string {
  const s = String(v ?? "").trim();
  return !s || s.toLowerCase() === "nan" ? "" : s;
}

// ── Kontoklassificering (BAS-kontoplan) ───────────────────────────
function getAccountCategory(konto: string): "intäkt" | "kostnad" | "tillgång" | "skuld" | "övrigt" {
  const k = parseInt(konto || "0", 10);
  if (k >= 1000 && k <= 1999) return "tillgång";
  if (k >= 2000 && k <= 2999) return "skuld";
  if (k >= 3000 && k <= 3999) return "intäkt";
  if (k >= 4000 && k <= 7999) return "kostnad";
  if (k >= 8000 && k <= 8999) return "övrigt";
  return "övrigt";
}

function getCategoryColor(cat: string): string {
  switch (cat) {
    case "intäkt":  return "#22c55e";
    case "kostnad": return "#ef4444";
    case "tillgång":return "#6c63ff";
    case "skuld":   return "#f59e0b";
    default:        return "#6b7280";
  }
}

function getCategoryLabel(cat: string): string {
  switch (cat) {
    case "intäkt":  return "Intäkter (3xxx)";
    case "kostnad": return "Kostnader (4-7xxx)";
    case "tillgång":return "Tillgångar (1xxx)";
    case "skuld":   return "Skulder (2xxx)";
    default:        return "Övrigt (8xxx)";
  }
}

// ── Sparkline ─────────────────────────────────────────────────────
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
  const last = pts.split(" ").at(-1)!.split(",");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} />
    </svg>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────
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

// ── Area trend chart ──────────────────────────────────────────────
function TrendChart({ series, selectedPeriod, onPeriodClick }: {
  series: any[]; selectedPeriod: string | null; onPeriodClick: (p: string) => void;
}) {
  if (!series || series.length < 2) return (
    <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "20px 0" }}>
      Ingen perioddata tillgänglig
    </div>
  );

  const W = 100; const H = 60;
  const actuals = series.map(p => Math.abs(Number(p.actual || 0)));
  const budgets = series.map(p => Math.abs(Number(p.budget || 0)));
  const max     = Math.max(...actuals, ...budgets, 1);

  function toPoints(vals: number[]) {
    return vals.map((v, i) => {
      const x = series.length < 2 ? W/2 : (i / (series.length - 1)) * W;
      const y = H - (v / max) * (H - 8) - 4;
      return { x, y };
    });
  }

  const aPts = toPoints(actuals);
  const bPts = toPoints(budgets);

  function pathD(pts: {x:number;y:number}[]) {
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  }

  const areaD = `${pathD(aPts)} L${aPts.at(-1)!.x},${H} L${aPts[0].x},${H} Z`;

  return (
    <div style={{ position: "relative" }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ overflow: "visible", display: "block" }}>
        <defs>
          <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#6c63ff" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#aG)"/>
        <path d={pathD(bPts)} fill="none" stroke="rgba(255,255,255,0.15)"
          strokeWidth="1" strokeDasharray="2,2"/>
        <path d={pathD(aPts)} fill="none" stroke="#6c63ff" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"/>
        {aPts.map((p, i) => {
          const period = String(series[i]?.period || "");
          const isSel  = period === selectedPeriod;
          return (
            <g key={i} style={{ cursor: "pointer" }} onClick={() => onPeriodClick(period)}>
              <circle cx={p.x} cy={p.y} r={isSel ? 4 : 2.5}
                fill={isSel ? "#fff" : "#6c63ff"}
                stroke={isSel ? "#6c63ff" : "none"} strokeWidth="2"/>
            </g>
          );
        })}
      </svg>
      {/* Period labels */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        {series.slice(-6).map((p, i) => {
          const period = String(p.period || "");
          const isSel  = period === selectedPeriod;
          return (
            <button key={i}
              onClick={() => onPeriodClick(period)}
              style={{
                fontSize: 9, color: isSel ? "#6c63ff" : "var(--text-faint)",
                fontWeight: isSel ? 700 : 400, background: "none",
                border: "none", cursor: "pointer", padding: "2px 0",
                fontFamily: "var(--font)",
              }}>
              {period.slice(-5)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Account row ───────────────────────────────────────────────────
function AccountRow({ row, maxAbs }: { row: any; maxAbs: number }) {
  const konto   = clean(row.Konto || row.account || "");
  const label   = clean(row.Label || row.account_name || row.Konto || "—");
  const actual  = Number(row.Utfall ?? row.actual ?? 0);
  const budget  = Number(row.Budget ?? row.budget ?? 0);
  const diff    = Number(row["Vs budget diff"] ?? (actual - budget));
  const pct     = budget !== 0 ? diff / Math.abs(budget) : 0;
  const cat     = getAccountCategory(konto);
  const color   = getCategoryColor(cat);
  const barW    = maxAbs > 0 ? Math.min(Math.abs(actual) / maxAbs * 100, 100) : 0;
  const diffPos = diff >= 0;

  return (
    <div className="db3-acc-row">
      <div className="db3-acc-left">
        {konto && (
          <span className="db3-acc-konto" style={{ color }}>
            {konto}
          </span>
        )}
        <span className="db3-acc-label">{label}</span>
      </div>
      <div className="db3-acc-bar-wrap">
        <div className="db3-acc-bar-track">
          <div className="db3-acc-bar-fill"
            style={{ width: `${barW}%`, background: color, opacity: 0.7 }}/>
        </div>
      </div>
      <div className="db3-acc-nums">
        <span className="db3-acc-actual">{fmtMoney(actual)}</span>
        {budget !== 0 && (
          <span className={`db3-acc-diff ${diffPos ? "pos" : "neg"}`}>
            {diffPos ? "+" : ""}{fmtMoney(diff)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Category summary ──────────────────────────────────────────────
function CategoryBar({ label, actual, budget, color, onClick, active }: {
  label: string; actual: number; budget: number; color: string;
  onClick: () => void; active: boolean;
}) {
  const diff    = actual - budget;
  const diffPos = diff >= 0;
  return (
    <button className={`db3-cat-btn${active ? " active" : ""}`}
      onClick={onClick}
      style={{ borderColor: active ? color : "var(--border)" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="db3-cat-label">{label}</div>
        <div className="db3-cat-actual">{fmtMoney(actual)}</div>
      </div>
      {budget !== 0 && (
        <span className={`db3-cat-diff ${diffPos ? "pos" : "neg"}`}>
          {diffPos ? "+" : ""}{fmtMoney(diff)}
        </span>
      )}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const pack        = getPack();
  const reportItems = getReportItems();

  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchTerm,     setSearchTerm]     = useState("");
  const [sortBy,         setSortBy]         = useState<"actual" | "diff" | "konto">("diff");
  const [showAll,        setShowAll]        = useState(false);

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header reportCount={0} />
        <div className="ns-page">
          <div className="ns-hero-title">Dashboard</div>
          <div className="ns-hero-sub" style={{ marginTop: 6 }}>
            Ingen analys laddad — gå till Filer och ladda upp en fil först.
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  // ── Beräkningar ───────────────────────────────────────────────
  const isFortnox    = pack.source === "fortnox";
  const periodSeries  = Array.isArray(pack.period_series) ? pack.period_series : [];
  const accountRows   = Array.isArray(pack.account_rows)  ? pack.account_rows  : [];
  const topBudget     = Array.isArray(pack.top_budget)    ? pack.top_budget    : [];
  const topMom        = Array.isArray(pack.top_mom)       ? pack.top_mom       : [];
  const allFlagged    = Array.isArray(pack.all_flagged)   ? pack.all_flagged   : [];

  // Aktiv period — vald eller senaste
  const activePeriod = selectedPeriod || pack.current_period;

  // Filtrera account_rows på vald period
  const periodRows = useMemo(() => {
    if (!activePeriod || accountRows.length === 0) return accountRows;
    const filtered = accountRows.filter((r: any) =>
      String(r.period || "").trim() === activePeriod.trim()
    );
    return filtered.length > 0 ? filtered : accountRows;
  }, [accountRows, activePeriod]);

  // Kategorisera
  const categorized = useMemo(() => {
    const cats: Record<string, { actual: number; budget: number; rows: any[] }> = {};
    for (const row of periodRows) {
      const konto = clean(row.Konto || row.account || "");
      const cat   = getAccountCategory(konto);
      if (!cats[cat]) cats[cat] = { actual: 0, budget: 0, rows: [] };
      cats[cat].actual += Number(row.Utfall ?? row.actual ?? 0);
      cats[cat].budget += Number(row.Budget ?? row.budget ?? 0);
      cats[cat].rows.push(row);
    }
    return cats;
  }, [periodRows]);

  // Filtrera och sortera rader
  const filteredRows = useMemo(() => {
    let rows = activeCategory
      ? (categorized[activeCategory]?.rows ?? periodRows)
      : periodRows;

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      rows = rows.filter((r: any) =>
        String(r.Label || r.account_name || r.Konto || "").toLowerCase().includes(s) ||
        String(r.Konto || r.account || "").includes(s)
      );
    }

    rows = [...rows].sort((a: any, b: any) => {
      if (sortBy === "actual") return Math.abs(Number(b.Utfall ?? b.actual ?? 0)) - Math.abs(Number(a.Utfall ?? a.actual ?? 0));
      if (sortBy === "diff")   return Math.abs(Number(b["Vs budget diff"] ?? 0)) - Math.abs(Number(a["Vs budget diff"] ?? 0));
      if (sortBy === "konto")  return String(a.Konto || "").localeCompare(String(b.Konto || ""));
      return 0;
    });

    return rows;
  }, [periodRows, activeCategory, searchTerm, sortBy, categorized]);

  const shownRows  = showAll ? filteredRows : filteredRows.slice(0, 12);
  const maxAbs     = Math.max(...filteredRows.map((r: any) => Math.abs(Number(r.Utfall ?? r.actual ?? 0))), 1);

  // KPI-beräkningar
  const totalActual   = Number(pack.total_actual ?? 0);
  const totalBudget   = Number(pack.total_budget ?? 0);
  const variance      = totalActual - totalBudget;
  const variancePct   = totalBudget !== 0 ? variance / Math.abs(totalBudget) : 0;
  const kpiRow        = Array.isArray(pack.kpi_summary) ? (pack.kpi_summary[0] ?? {}) : {};
  const momPct        = kpiRow["MoM %"] != null ? Number(kpiRow["MoM %"]) : null;
  const sparkActuals  = periodSeries.slice(-8).map((p: any) => Math.abs(Number(p.actual || 0)));
  const withBudget    = topBudget.filter((x: any) => x.Budget && Number(x.Budget) !== 0).length;
  const totalKonton   = topBudget.length || 1;

  // Period-selector
  const allPeriods = periodSeries.map((p: any) => String(p.period || "")).filter(Boolean);

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <div className="ns-page db2-page">

        {/* ── Header ── */}
        <div className="db2-header">
          <div>
            <div className="ns-hero-title">Dashboard</div>
            <div className="ns-hero-sub">
              {activePeriod}
              {pack.previous_period && ` · jämför ${pack.previous_period}`}
            </div>
          </div>
          <div className="db2-header-right">
            <div className="db2-live-pill">
              <span className="db2-live-dot" />
              Senaste uppladdning
            </div>
            <a href="/variances" className="db2-goto-btn">Hantera avvikelser →</a>
          </div>
        </div>

        {/* ── KPI rad ── */}
        <div className="db2-kpi-row">
          <KPICard
            label={isFortnox ? "Periodens utfall" : "Totalt utfall"}
            value={fmtMoney(totalActual)}
            sub={isFortnox
              ? `Föregående ${fmtMoney(Number(pack.kpi_summary?.[0]?.Föregående ?? 0))}`
              : `Budget ${fmtMoney(totalBudget)}`}
            trend={momPct !== null ? `${Math.abs(Math.round(momPct * 100))}% MoM` : undefined}
            trendPos={momPct !== null ? momPct >= 0 : undefined}
            sparkValues={sparkActuals}
          />
          <KPICard
            label={isFortnox ? "MoM-avvikelse" : "Budgetavvikelse"}
            value={isFortnox
              ? fmtMoney(Number(pack.kpi_summary?.[0]?.["MoM diff"] ?? variance))
              : fmtMoney(variance)}
            sub={isFortnox ? `vs ${pack.previous_period || "föregående"}` : variance < 0 ? "Under plan" : "Över plan"}
            trend={`${Math.round(Math.abs(variancePct) * 100)}%`}
            trendPos={variance >= 0}
          />
          <KPICard
            label="Konton med budget"
            value={`${withBudget} / ${totalKonton}`}
            sub={`${Math.round((withBudget / totalKonton) * 100)}% täckningsgrad`}
            trendPos={(withBudget / totalKonton) >= 0.8}
            trend={`${Math.round((withBudget / totalKonton) * 100)}%`}
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

        {/* ── Trend chart + period selector ── */}
        <div className="db3-trend-section">
          <div className="db3-trend-card">
            <div className="db2-card-head" style={{ marginBottom: 12 }}>
              <div>
                <div className="db2-card-title">Utfall över tid</div>
                <div className="db2-card-sub">Klicka på en period för att filtrera kontovyn</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {selectedPeriod && (
                  <button className="db3-clear-btn" onClick={() => setSelectedPeriod(null)}>
                    Visa alla perioder ✕
                  </button>
                )}
                <div className="db3-legend">
                  <span style={{ width: 12, height: 2, background: "#6c63ff", display: "inline-block", borderRadius: 1 }}/>
                  <span style={{ fontSize: 10, color: "var(--text-faint)" }}>Utfall</span>
                  <span style={{ width: 12, height: 2, background: "rgba(255,255,255,0.2)", display: "inline-block", borderRadius: 1 }}/>
                  <span style={{ fontSize: 10, color: "var(--text-faint)" }}>Budget</span>
                </div>
              </div>
            </div>
            <TrendChart
              series={periodSeries}
              selectedPeriod={selectedPeriod}
              onPeriodClick={(p) => setSelectedPeriod(prev => prev === p ? null : p)}
            />
          </div>
        </div>

        {/* ── Kategoriknappar ── */}
        {Object.keys(categorized).length > 0 && (
          <div>
            <div className="db3-section-label">Kontoklasser</div>
            <div className="db3-cat-grid">
              {Object.entries(categorized).map(([cat, data]) => (
                <CategoryBar
                  key={cat}
                  label={getCategoryLabel(cat)}
                  actual={data.actual}
                  budget={data.budget}
                  color={getCategoryColor(cat)}
                  active={activeCategory === cat}
                  onClick={() => setActiveCategory(prev => prev === cat ? null : cat)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Kontotabell ── */}
        <div className="db3-acc-section">
          <div className="db3-acc-toolbar">
            <div className="db3-section-label" style={{ margin: 0 }}>
              Verifikationer
              {activePeriod && (
                <span style={{ marginLeft: 8, fontSize: 11, color: "var(--accent-text)",
                  background: "var(--accent-soft)", padding: "1px 7px", borderRadius: 4 }}>
                  {activePeriod}
                </span>
              )}
              {activeCategory && (
                <span style={{ marginLeft: 6, fontSize: 11, color: getCategoryColor(activeCategory),
                  background: "rgba(0,0,0,0.15)", padding: "1px 7px", borderRadius: 4 }}>
                  {getCategoryLabel(activeCategory)}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="db3-search"
                placeholder="Sök konto eller namn..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <select className="db3-sort-select"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}>
                <option value="diff">Sortera: Avvikelse</option>
                <option value="actual">Sortera: Utfall</option>
                <option value="konto">Sortera: Kontonr</option>
              </select>
              {(activeCategory || searchTerm) && (
                <button className="db3-clear-btn" onClick={() => {
                  setActiveCategory(null); setSearchTerm("");
                }}>
                  Rensa filter ✕
                </button>
              )}
            </div>
          </div>

          {shownRows.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "20px 0" }}>
              Inga konton matchar filtret.
            </div>
          ) : (
            <>
              <div className="db3-acc-list">
                <div className="db3-acc-header">
                  <span>Konto</span>
                  <span>Utfall</span>
                  <span>Avvikelse</span>
                </div>
                {shownRows.map((row: any, i: number) => (
                  <AccountRow key={i} row={row} maxAbs={maxAbs} />
                ))}
              </div>
              {filteredRows.length > 12 && (
                <button className="db3-show-more" onClick={() => setShowAll(v => !v)}>
                  {showAll
                    ? "Visa färre ↑"
                    : `Visa alla ${filteredRows.length} konton ↓`}
                </button>
              )}
            </>
          )}
        </div>

        {/* ── AI sammanfattning ── */}
        <div className="db-narrative">
          <div className="db-narrative-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z"
                fill="#9b94ff"/>
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
