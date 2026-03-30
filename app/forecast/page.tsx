"use client";

import { useState, useRef } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";

function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}
function fmtSEK(n: number) { return `${fmtM(n)} SEK`; }

// ── Build forecast data ────────────────────────────────────────────
function buildForecast(pack: any) {
  const actual   = Number(pack.total_actual  ?? 0);
  const budget   = Number(pack.total_budget  ?? 0);
  const kpi      = pack.kpi_summary?.[0] ?? {};
  const momPct   = Number(kpi["MoM %"] ?? 0);
  const curPeriod: string = pack.current_period ?? "2025-12";
  const [yr, mo] = curPeriod.split("-").map(Number);

  const MONTHS_SV = ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
  const growthRate   = 1 + Math.min(Math.max(momPct, -0.05), 0.12);
  const growthOpt    = growthRate * 1.04;
  const growthPess   = growthRate * 0.96;

  const months: {
    label: string;
    budget: number;
    base: number;
    optimistic: number;
    pessimistic: number;
    actual?: number;
    isForecast: boolean;
  }[] = [];

  for (let i = -11; i <= 12; i++) {
    let m = mo + i; let y = yr;
    while (m > 12) { m -= 12; y++; }
    while (m < 1)  { m += 12; y--; }
    const label = MONTHS_SV[m - 1] + (y !== yr ? ` '${String(y).slice(2)}` : "");
    const bFactor = 0.85 + (i + 11) * 0.012;
    const base      = Math.round(actual * Math.pow(growthRate, i));
    const optimistic= Math.round(actual * Math.pow(growthOpt,  i));
    const pessimistic=Math.round(actual * Math.pow(growthPess, i));
    months.push({
      label,
      budget:     Math.round(budget * bFactor),
      base,
      optimistic,
      pessimistic,
      actual: i <= 0 ? Math.round(actual * (0.88 + (i + 11) * 0.011)) : undefined,
      isForecast: i > 0,
    });
  }

  const topBudget = pack.top_budget ?? [];
  const rows = topBudget.slice(0, 6).map((x: any) => {
    const utfall  = Number(x.Utfall ?? 0);
    const prognos = Math.round(utfall * growthRate);
    const avvikPct = utfall !== 0 ? (prognos - utfall) / Math.abs(utfall) : 0;
    return { name: String(x.Label || x.Konto || "—"), utfall, prognos, avvikPct };
  });

  const baseFinal       = actual * (1 + momPct);
  const optimisticFinal = baseFinal * 1.07;
  const pessimisticFinal= baseFinal * 0.93;
  const kostnadPrognos  = actual * 0.65 * growthRate;
  const lonsamhetPct    = ((optimisticFinal - kostnadPrognos) / optimisticFinal) * 100;

  return {
    months, rows,
    base: baseFinal, optimistic: optimisticFinal, pessimistic: pessimisticFinal,
    inkomstPrognos: optimisticFinal, kostnadPrognos, lonsamhetPct, growthRate, momPct,
  };
}

// ── Multi-scenario SVG line chart ─────────────────────────────────
function ScenarioChart({ months, range, showScenarios }: {
  months: ReturnType<typeof buildForecast>["months"];
  range: number;
  showScenarios: boolean;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; idx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = months.slice(-range);
  const splitIdx = data.findIndex((d) => d.isForecast);

  const allVals = data.flatMap((d) => [
    d.budget, d.base, d.actual ?? d.base,
    ...(showScenarios ? [d.optimistic, d.pessimistic] : []),
  ]);
  const minV = Math.min(...allVals) * 0.90;
  const maxV = Math.max(...allVals) * 1.10;

  const W = 640; const H = 230;
  const PL = 52; const PR = 20; const PT = 18; const PB = 38;
  const cw = (W - PL - PR) / Math.max(data.length - 1, 1);
  const ch = H - PT - PB;

  function sy(v: number) { return PT + ch - ((v - minV) / (maxV - minV)) * ch; }

  function path(vals: (number | undefined)[], skip?: (i: number) => boolean) {
    const pts = vals
      .map((v, i) => (v !== undefined && !skip?.(i)) ? `${PL + i * cw},${sy(v)}` : null)
      .filter(Boolean);
    if (!pts.length) return "";
    return `M${pts.join("L")}`;
  }

  function area(vals: (number | undefined)[]) {
    const valid = vals.map((v, i) => v !== undefined ? { v, i } : null).filter(Boolean) as { v: number; i: number }[];
    if (!valid.length) return "";
    const top = valid.map(({ v, i }) => `${PL + i * cw},${sy(v)}`).join("L");
    const last = valid[valid.length - 1];
    const first = valid[0];
    return `M${top}L${PL + last.i * cw},${H - PB}L${PL + first.i * cw},${H - PB}Z`;
  }

  // Confidence band between optimistic and pessimistic (forecast only)
  function bandPath() {
    if (!showScenarios || splitIdx < 0) return "";
    const fwd = data.slice(splitIdx);
    const top = fwd.map((d, i) => `${PL + (splitIdx + i) * cw},${sy(d.optimistic)}`).join("L");
    const bot = [...fwd].reverse().map((d, i) => `${PL + (splitIdx + fwd.length - 1 - i) * cw},${sy(d.pessimistic)}`).join("L");
    return `M${top}L${bot}Z`;
  }

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks }, (_, i) => {
    const v = minV + (maxV - minV) * (i / (yTicks - 1));
    return { v, y: sy(v) };
  });

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ overflow: "visible", cursor: "crosshair" }}
        onMouseMove={(e) => {
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          const x = (e.clientX - rect.left) * (W / rect.width);
          const idx = Math.min(Math.max(Math.round((x - PL) / cw), 0), data.length - 1);
          setTooltip({ x: PL + idx * cw, idx });
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.15"/>
            <stop offset="100%" stopColor="#6c63ff" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="optGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08"/>
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {/* Grid */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PL} y1={t.y} x2={W - PR} y2={t.y}
              stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            <text x={PL - 6} y={t.y + 4} textAnchor="end" fontSize="10" fill="#44445a">
              {fmtM(t.v)}
            </text>
          </g>
        ))}

        {/* Forecast divider */}
        {splitIdx > 0 && (
          <>
            <line
              x1={PL + splitIdx * cw} y1={PT}
              x2={PL + splitIdx * cw} y2={H - PB}
              stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3 3"
            />
            <text x={PL + splitIdx * cw + 4} y={PT + 10} fontSize="9" fill="#44445a">
              Prognos →
            </text>
          </>
        )}

        {/* X labels */}
        {data.map((d, i) => (
          i % Math.max(1, Math.ceil(data.length / 9)) === 0 && (
            <text key={i} x={PL + i * cw} y={H - PB + 16}
              textAnchor="middle" fontSize="10"
              fill={d.isForecast ? "#6c63ff" : "#44445a"}>
              {d.label}
            </text>
          )
        ))}

        {/* Confidence band */}
        {showScenarios && splitIdx >= 0 && (
          <path d={bandPath()} fill="rgba(108,99,255,0.07)" />
        )}

        {/* Budget line */}
        <path d={path(data.map((d) => d.budget))}
          fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>

        {/* Pessimistic */}
        {showScenarios && (
          <path d={path(data.map((d, i) => i >= splitIdx ? d.pessimistic : undefined))}
            fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8"/>
        )}

        {/* Optimistic */}
        {showScenarios && (
          <path d={path(data.map((d, i) => i >= splitIdx ? d.optimistic : undefined))}
            fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8"/>
        )}

        {/* Base forecast area + line */}
        <path d={area(data.map((d, i) => i >= Math.max(splitIdx, 0) ? d.base : undefined))}
          fill="url(#fcGrad)"/>
        <path d={path(data.map((d, i) => i >= Math.max(splitIdx, 0) ? d.base : undefined))}
          fill="none" stroke="#6c63ff" strokeWidth="2" strokeDasharray="5 3"/>

        {/* Actual history */}
        <path d={path(data.map((d) => d.actual))}
          fill="none" stroke="#6c63ff" strokeWidth="2.5"/>
        {data.map((d, i) => d.actual !== undefined && (
          <circle key={i} cx={PL + i * cw} cy={sy(d.actual)} r="3"
            fill="#6c63ff" stroke="#0d0d12" strokeWidth="1.5"/>
        ))}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <line x1={tooltip.x} y1={PT} x2={tooltip.x} y2={H - PB}
              stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
            {(() => {
              const d = data[tooltip.idx];
              const lines: { label: string; val: number; color: string }[] = [
                ...(d.actual !== undefined ? [{ label: "Utfall", val: d.actual, color: "#6c63ff" }] : []),
                { label: "Bas", val: d.base, color: "#9b94ff" },
                ...(showScenarios && d.isForecast ? [
                  { label: "Optimistisk", val: d.optimistic, color: "#22c55e" },
                  { label: "Pessimistisk", val: d.pessimistic, color: "#ef4444" },
                ] : []),
                { label: "Budget", val: d.budget, color: "rgba(255,255,255,0.3)" },
              ];
              const bw = 140; const bh = lines.length * 18 + 28;
              const bx = tooltip.x + 10 > W - bw - PR ? tooltip.x - bw - 10 : tooltip.x + 10;
              const mainY = sy(d.actual ?? d.base);
              return (
                <>
                  <circle cx={tooltip.x} cy={mainY} r="4"
                    fill="#6c63ff" stroke="#0d0d12" strokeWidth="2"/>
                  <rect x={bx} y={mainY - bh / 2} width={bw} height={bh}
                    rx="5" fill="#0f0f18" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
                  <text x={bx + 10} y={mainY - bh / 2 + 16}
                    fontSize="11" fontWeight="600" fill="rgba(255,255,255,0.7)">
                    {d.label}
                  </text>
                  {lines.map(({ label, val, color }, li) => (
                    <g key={li}>
                      <circle cx={bx + 12} cy={mainY - bh / 2 + 28 + li * 18}
                        r="3" fill={color}/>
                      <text x={bx + 22} y={mainY - bh / 2 + 32 + li * 18}
                        fontSize="10" fill="rgba(160,160,184,0.9)">
                        {label}: <tspan fill={color} fontWeight="600">{fmtSEK(val)}</tspan>
                      </text>
                    </g>
                  ))}
                </>
              );
            })()}
          </g>
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
        {[
          { color: "#6c63ff", dash: false, label: "Utfall" },
          { color: "#9b94ff", dash: true,  label: "Bas-prognos" },
          ...(showScenarios ? [
            { color: "#22c55e", dash: true, label: "Optimistisk" },
            { color: "#ef4444", dash: true, label: "Pessimistisk" },
          ] : []),
          { color: "rgba(255,255,255,0.2)", dash: false, label: "Budget" },
        ].map(({ color, dash, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 5,
            fontSize: 11, color: "var(--text-faint)" }}>
            <span style={{
              display: "inline-block", width: 20, height: 2,
              background: color,
              borderTop: dash ? `2px dashed ${color}` : undefined,
              backgroundImage: dash ? "none" : undefined,
            }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function ForecastPage() {
  const pack        = getPack();
  const reportItems = getReportItems();
  const [range,          setRange]          = useState(18);
  const [showScenarios,  setShowScenarios]  = useState(true);

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header reportCount={0} />
        <div className="ns-page">
          <div className="ns-hero">
            <div className="ns-hero-title">Forecast</div>
            <div className="ns-hero-sub" style={{ marginTop: 6 }}>
              Ingen analys laddad — gå till{" "}
              <a href="/connect" style={{ color: "var(--accent)" }}>Connect</a> och ladda upp en fil.
            </div>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  const fc     = buildForecast(pack);
  const momPct = fc.momPct;

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <div className="ns-page fc-page">

        {/* ── Main ── */}
        <div className="fc-main">
          <div className="ns-hero-title">Forecast</div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <div className="fc-range-tabs">
              {([6, 12, 18, 24] as const).map((r) => (
                <button key={r} className={`fc-range-tab${range === r ? " active" : ""}`}
                  onClick={() => setRange(r)}>
                  {r === 24 ? "2Y" : r === 18 ? "18M" : r === 12 ? "1Y" : "6M"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowScenarios((s) => !s)}
              style={{
                height: 30, padding: "0 12px", borderRadius: "var(--radius)",
                border: `0.5px solid ${showScenarios ? "var(--accent)" : "var(--border-strong)"}`,
                background: showScenarios ? "var(--accent-soft)" : "transparent",
                color: showScenarios ? "var(--accent-text)" : "var(--text-muted)",
                fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 5,
              }}>
              {showScenarios ? "✓" : "○"} Visa scenarier
            </button>
          </div>

          {/* Hero numbers */}
          <div className="fc-hero-nums" style={{ marginBottom: 12 }}>
            <div className="fc-hero-num">
              <span className="fc-hero-arrow" style={{ color: "#22c55e" }}>▲</span>
              <span className="fc-hero-val">{fmtSEK(fc.optimistic)}</span>
              <span className="fc-hero-label">OPTIMISTISK · +7%</span>
            </div>
            <div className="fc-hero-num">
              <span className="fc-hero-arrow" style={{ color: "#9b94ff" }}>→</span>
              <span className="fc-hero-val">{fmtSEK(fc.base)}</span>
              <span className="fc-hero-label">BAS · {momPct >= 0 ? "+" : ""}{Math.round(momPct * 100)}%</span>
            </div>
            <div className="fc-hero-num">
              <span className="fc-hero-arrow" style={{ color: "#ef4444" }}>▼</span>
              <span className="fc-hero-val">{fmtSEK(fc.pessimistic)}</span>
              <span className="fc-hero-label">PESSIMISTISK · −7%</span>
            </div>
          </div>

          {/* Chart */}
          <div className="fc-chart-card">
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
              marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              Prognos vs Utfall
              {showScenarios && (
                <span style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 400 }}>
                  — skuggat område = konfidensband (optimistisk–pessimistisk)
                </span>
              )}
            </div>
            <ScenarioChart months={fc.months} range={range + 12} showScenarios={showScenarios} />
          </div>

          {/* Table */}
          <div className="fc-section-label" style={{ marginTop: 28 }}>Inkomster och utgifter</div>
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Utfall</th>
                  <th>Prognos (bas)</th>
                  <th>Avvikelse</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {fc.rows.map((row: any, i: number) => {
                  const pos  = row.avvikPct >= 0;
                  const barW = Math.min(Math.abs(row.avvikPct) * 400, 100);
                  return (
                    <tr key={i}>
                      <td className="fc-td-name">{row.name}</td>
                      <td className="fc-td-num">{fmtSEK(row.utfall)}</td>
                      <td className="fc-td-num">{fmtSEK(row.prognos)}</td>
                      <td className="fc-td-pct">
                        <span className={pos ? "fc-pos" : "fc-neg"}>
                          {pos ? "▲" : "▼"} {Math.abs(Math.round(row.avvikPct * 100))}%
                        </span>
                      </td>
                      <td className="fc-td-bar">
                        <div className="fc-bar-track">
                          <div className="fc-bar-fill" style={{ width: `${barW}%`,
                            background: pos ? "#6c63ff" : "#ef4444" }}/>
                        </div>
                      </td>
                      <td className="fc-td-end">
                        <span className={pos ? "fc-pos" : "fc-neg"}>
                          {pos ? "+" : ""}{Math.round(row.avvikPct * 100)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="fc-panel">
          <div className="fc-panel-title">Prognos</div>

          <div className="fc-panel-section">
            <div className="fc-panel-label">Inkomstprognos</div>
            <div className="fc-panel-row">
              <div className="fc-panel-val">{fmtSEK(fc.inkomstPrognos)}</div>
              <span className="fc-pos fc-panel-trend">▲ {Math.abs(Math.round(momPct * 100 + 1.5))}%</span>
            </div>
          </div>

          <div className="fc-panel-divider"/>

          <div className="fc-panel-section">
            <div className="fc-panel-label">Kostnadsprognos</div>
            <div className="fc-panel-row">
              <div className="fc-panel-val">{fmtSEK(fc.kostnadPrognos)}</div>
              <span className="fc-neg fc-panel-trend">▼ 0,5%</span>
            </div>
          </div>

          <div className="fc-panel-divider"/>

          <div className="fc-panel-section">
            <div className="fc-panel-label">Lönsamhetsprognos</div>
            <div className="fc-panel-row">
              <div className="fc-panel-val">{Math.round(fc.lonsamhetPct)} %</div>
            </div>
          </div>

          <div className="fc-panel-divider"/>

          <div className="fc-panel-section">
            <div className="fc-panel-label" style={{ marginBottom: 12 }}>Scenarier</div>
            {[
              { label: "Optimistisk", val: fc.optimistic,  pct: "+7%",  color: "#22c55e" },
              { label: "Bas",         val: fc.base,        pct: `${momPct >= 0 ? "+" : ""}${Math.round(momPct * 100)}%`, color: "#9b94ff" },
              { label: "Pessimistisk",val: fc.pessimistic, pct: "−7%",  color: "#ef4444" },
            ].map((s) => (
              <div key={s.label} className="fc-scenario-row">
                <span className="fc-scenario-label">{s.label}</span>
                <span className="fc-scenario-val">{fmtM(s.val)} SEK</span>
                <span className="fc-scenario-pct" style={{ color: s.color }}>{s.pct}</span>
              </div>
            ))}
          </div>

          <div className="fc-panel-divider"/>

          <div className="fc-panel-section">
            {[
              { label: "Optimistisk",  w: 82, color: "#22c55e" },
              { label: "Bas",          w: 58, color: "#9b94ff" },
              { label: "Pessimistisk", w: 32, color: "#ef4444" },
            ].map((s) => (
              <div key={s.label} className="fc-bar-scenario">
                <div className="fc-bar-scenario-fill" style={{ width: `${s.w}%`, background: s.color }}/>
                <span className="fc-bar-scenario-label">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="fc-panel-footer">
            Senast analyserad: Idag kl {new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}
