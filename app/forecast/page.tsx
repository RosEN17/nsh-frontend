"use client";

import { useState, useRef, useEffect } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";

// ── Helpers ───────────────────────────────────────────────────────
function fmtM(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function fmtSEK(n: number): string {
  return `${fmtM(n)} SEK`;
}

// ── Build forecast from pack ──────────────────────────────────────
function buildForecast(pack: any) {
  const actual   = Number(pack.total_actual  ?? 0);
  const budget   = Number(pack.total_budget  ?? 0);
  const kpi      = pack.kpi_summary?.[0] ?? {};
  const momPct   = Number(kpi["MoM %"] ?? 0);
  const curPeriod: string = pack.current_period ?? "2025-12";

  // Parse period YYYY-MM
  const [yr, mo] = curPeriod.split("-").map(Number);

  // Build 24 months of data: 12 history (decreasing) + 12 forecast (increasing)
  const months: { label: string; budget: number; forecast: number; actual?: number }[] = [];
  const growthRate = 1 + Math.min(Math.max(momPct, -0.05), 0.12);

  for (let i = -11; i <= 12; i++) {
    let m = mo + i;
    let y = yr;
    while (m > 12) { m -= 12; y++; }
    while (m < 1)  { m += 12; y--; }
    const label = `${y === yr ? ["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"][m-1] : `${["Jan","Feb","Mar","Apr","Maj","Jun","Jul","Aug","Sep","Okt","Nov","Dec"][m-1]}`}`;

    const bFactor = 0.85 + (i + 11) * 0.012;
    const fBase   = actual * Math.pow(growthRate, i);

    months.push({
      label,
      budget:   Math.round(budget * bFactor),
      forecast: Math.round(fBase),
      actual:   i <= 0 ? Math.round(actual * (0.9 + (i + 11) * 0.01)) : undefined,
    });
  }

  // Scenarios based on current actual
  const base        = actual * (1 + momPct);
  const optimistic  = base * 1.07;
  const pessimistic = base * 0.93;

  // Income/cost categories from top_budget
  const topBudget = pack.top_budget ?? [];
  const rows = topBudget.slice(0, 6).map((x: any) => {
    const utfall   = Number(x.Utfall  ?? 0);
    const prognos  = utfall * growthRate;
    const avvikPct = budget !== 0 ? (prognos - utfall) / Math.abs(utfall) : 0;
    return {
      name:     String(x.Label || x.Konto || "—"),
      utfall,
      prognos:  Math.round(prognos),
      avvikPct,
    };
  });

  const inkomstPrognos  = optimistic;
  const kostnadPrognos  = actual * 0.65 * growthRate;
  const lonsamhetPct    = ((inkomstPrognos - kostnadPrognos) / inkomstPrognos) * 100;

  return { months, base, optimistic, pessimistic, rows, inkomstPrognos, kostnadPrognos, lonsamhetPct, growthRate, curPeriod };
}

// ── Line chart (SVG) ──────────────────────────────────────────────
function LineChart({ months, range }: {
  months: { label: string; budget: number; forecast: number; actual?: number }[];
  range: number;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; idx: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const data = months.slice(-range);
  const allVals = data.flatMap((d) => [d.budget, d.forecast, d.actual ?? d.forecast].filter(Boolean));
  const minV = Math.min(...allVals) * 0.92;
  const maxV = Math.max(...allVals) * 1.08;
  const W = 640; const H = 220; const PL = 48; const PR = 16; const PT = 16; const PB = 36;
  const cw = (W - PL - PR) / (data.length - 1);
  const ch = H - PT - PB;

  function scaleY(v: number) { return PT + ch - ((v - minV) / (maxV - minV)) * ch; }

function buildPath(vals: (number | undefined)[]) {
  const pts = vals
    .map((v, i) => (v !== undefined ? `${PL + i * cw},${scaleY(v)}` : null))
    .filter((p): p is string => p !== null);

  return pts.length ? `M${pts.join("L")}` : "";
}

function buildArea(vals: (number | undefined)[]) {
  const pts = vals
    .map((v, i) => (v !== undefined ? `${PL + i * cw},${scaleY(v)}` : null))
    .filter((p): p is string => p !== null);

  if (!pts.length) return "";

  const lastIdx = vals.reduce<number>(
    (a, v, i) => (v !== undefined ? i : a),
    0
  );

  return `M${pts.join("L")}L${PL + lastIdx * cw},${H - PB}L${PL},${H - PB}Z`;
}

  const forecastPath = buildPath(data.map((d) => d.forecast));
  const budgetPath   = buildPath(data.map((d) => d.budget));
  const areaPath     = buildArea(data.map((d) => d.forecast));
  const actualPath   = buildPath(data.map((d) => d.actual));

  // Y-axis labels
  const yTicks = [minV, (minV + maxV) / 2, maxV].map((v) => ({
    v, y: scaleY(v), label: fmtM(v),
  }));

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}
        onMouseMove={(e) => {
          const rect = svgRef.current?.getBoundingClientRect();
          if (!rect) return;
          const x = (e.clientX - rect.left) * (W / rect.width);
          const idx = Math.round((x - PL) / cw);
          if (idx >= 0 && idx < data.length) {
            setTooltip({ x: PL + idx * cw, y: scaleY(data[idx].forecast), idx });
          }
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#6c63ff" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {yTicks.map((t) => (
          <g key={t.v}>
            <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            <text x={PL - 6} y={t.y + 4} textAnchor="end" fontSize="10" fill="#44445a">{t.label}</text>
          </g>
        ))}

        {data.map((d, i) => (
          i % Math.ceil(data.length / 8) === 0 && (
            <text key={i} x={PL + i * cw} y={H - PB + 16} textAnchor="middle" fontSize="10" fill="#44445a">
              {d.label}
            </text>
          )
        ))}

        <path d={areaPath} fill="url(#fg)"/>
        <path d={forecastPath} fill="none" stroke="#6c63ff" strokeWidth="1.5" strokeDasharray="4 3"/>
        <path d={budgetPath}   fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
        {actualPath && <path d={actualPath} fill="none" stroke="#6c63ff" strokeWidth="2"/>}

        {data.map((d, i) => d.actual !== undefined && (
          <circle key={i} cx={PL + i * cw} cy={scaleY(d.actual)} r="3" fill="#6c63ff"/>
        ))}

        {tooltip && (
          <g>
            <line x1={tooltip.x} y1={PT} x2={tooltip.x} y2={H - PB} stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
            <circle cx={tooltip.x} cy={tooltip.y} r="4" fill="#6c63ff" stroke="#0d0d12" strokeWidth="2"/>
            <rect x={tooltip.x + 8} y={tooltip.y - 36} width={110} height={40} rx="4" fill="#16161f" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
            <text x={tooltip.x + 14} y={tooltip.y - 20} fontSize="10" fill="#44445a">{data[tooltip.idx].label}</text>
            <text x={tooltip.x + 14} y={tooltip.y - 6} fontSize="11" fill="#6c63ff">● {fmtSEK(data[tooltip.idx].forecast)}</text>
            {data[tooltip.idx].actual !== undefined && (
              <text x={tooltip.x + 14} y={tooltip.y + 8} fontSize="11" fill="rgba(255,255,255,0.5)">● {fmtSEK(data[tooltip.idx].actual!)}</text>
            )}
          </g>
        )}
      </svg>

      <div className="fc-chart-legend">
        <span className="fc-legend-item"><span className="fc-legend-line solid"/>&nbsp;Budget</span>
        <span className="fc-legend-item"><span className="fc-legend-line dashed"/>&nbsp;Prognos</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function ForecastPage() {
  const pack        = getPack();
  const reportItems = getReportItems();

  const [range,    setRange]    = useState(12);
  const [category, setCategory] = useState("Intäkter & Utgifter");

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header reportCount={0} />
        <div className="ns-page">
          <div className="ns-hero-title">Forecast</div>
          <div className="ns-hero-sub" style={{ marginTop: 6 }}>Ingen analys laddad — gå till Connect först.</div>
        </div>
      </ProtectedLayout>
    );
  }

  const fc = buildForecast(pack);
  const momPct = Number(pack.kpi_summary?.[0]?.["MoM %"] ?? 0);

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <div className="ns-page fc-page">

        {/* ── Main ── */}
        <div className="fc-main">
          <div className="ns-hero-title">Forecast</div>

          {/* Filters */}
          <div className="fc-filters">
            <div className="fc-filter-select">
              <select className="ns-select" value={category} onChange={(e) => setCategory(e.target.value)}
                style={{ width: "auto", height: 32, fontSize: 12 }}>
                <option>Intäkter & Utgifter</option>
                <option>Kostnader</option>
                <option>Intäkter</option>
              </select>
            </div>
            <div className="fc-filter-select">
              <select className="ns-select" style={{ width: "auto", height: 32, fontSize: 12 }}>
                <option>Månad</option>
                <option>Kvartal</option>
              </select>
            </div>
            <button className="fc-filter-add">+ Lägg till filter</button>
          </div>

          {/* Chart header */}
          <div className="fc-chart-header">
            <div className="fc-chart-title">Prognos vs Utfallet</div>
            <div className="fc-range-tabs">
              {[3, 6, 12, 24].map((r) => (
                <button key={r} className={`fc-range-tab${range === r ? " active" : ""}`}
                  onClick={() => setRange(r)}>
                  {r === 24 ? "2Y" : r === 12 ? "1Y" : r === 6 ? "6M" : "3M"}
                </button>
              ))}
            </div>
          </div>

          {/* Hero numbers */}
          <div className="fc-hero-nums">
            <div className="fc-hero-num">
              <span className="fc-hero-arrow pos">▲</span>
              <span className="fc-hero-val">{fmtSEK(fc.inkomstPrognos)}</span>
              <span className="fc-hero-label">INKOMST · {momPct >= 0 ? "+" : ""}{Math.round(momPct * 100)}%</span>
            </div>
            <div className="fc-hero-num">
              <span className="fc-hero-arrow neg">▼</span>
              <span className="fc-hero-val">{fmtSEK(fc.kostnadPrognos)}</span>
              <span className="fc-hero-label">AVKDOS · −2%</span>
            </div>
          </div>

          {/* Line chart */}
          <div className="fc-chart-card">
            <LineChart months={fc.months} range={range + 12} />
          </div>

          {/* Income/costs table */}
          <div className="fc-section-label" style={{ marginTop: 28 }}>Inkomster och utgifter</div>
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>Utfall</th>
                  <th>Prognos</th>
                  <th>Avvikelse</th>
                  <th></th>
                  <th style={{ textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {fc.rows.map((row, i) => {
                  const pos = row.avvikPct >= 0;
                  const barW = Math.min(Math.abs(row.avvikPct) * 500, 100);
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
                          <div className="fc-bar-fill"
                            style={{
                              width: `${barW}%`,
                              background: pos ? "#6c63ff" : "#d4547a",
                            }}/>
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
          <div className="fc-panel-title">Forecals</div>

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
              <span className="fc-panel-neutral">0%</span>
            </div>
          </div>

          <div className="fc-panel-divider"/>

          <div className="fc-panel-section">
            <div className="fc-panel-label" style={{ marginBottom: 12 }}>Scenarier</div>
            {[
              { label: "Optimistisk",  val: fc.optimistic,  pct: "+7%",  color: "#6c63ff" },
              { label: "Bas",          val: fc.base,        pct: "+3%",  color: "#6c63ff" },
              { label: "Pessimistisk", val: fc.pessimistic, pct: "−1%",  color: "#d4547a" },
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
            <div style={{ marginBottom: 10 }}>
              {[
                { label: "Optimistisk", w: 80, color: "#6c63ff" },
                { label: "Bas",         w: 55, color: "#8b84ff" },
                { label: "Pessimistisk",w: 30, color: "#d4547a" },
              ].map((s) => (
                <div key={s.label} className="fc-bar-scenario">
                  <div className="fc-bar-scenario-fill" style={{ width: `${s.w}%`, background: s.color }}/>
                  <span className="fc-bar-scenario-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="fc-panel-footer">
            Senast analyserad: Idag kl {new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}
