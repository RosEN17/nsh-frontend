"use client";

import { useState, useEffect } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";
import { useTeam } from "@/lib/useTeam";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

function fmt(n: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MSEK`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)} tkr`;
  return `${Math.round(n)} kr`;
}
function pct(n: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;
}
function initials(name: string) {
  return (name || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

type Alert = {
  account: string;
  account_name: string;
  account_type: string;
  severity: "critical" | "warning" | "info";
  headline: string;
  reasoning: string;
  action: string;
  year_end_risk: string;
  actual: number;
  budget: number;
  variance: number;
  variance_pct: number;
  streak_months: number;
  acceleration: number;
  year_end_impact: number;
  sparkline: number[];
  drilldown: { period: string; actual: number; budget: number; variance: number }[];
};

type AlertsResponse = {
  alerts: Alert[];
  summary: string;
  dismissed_reason: string;
  total_accounts_analyzed: number;
  candidates_evaluated: number;
  materiality_threshold: number;
};

// ═══════════════════════════════════════════════════════════════════
// SPARKLINE
// ═══════════════════════════════════════════════════════════════════

function Sparkline({ values, w = 72, h = 26 }: { values: number[]; w?: number; h?: number }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x},${y}`;
  }).join(" ");
  const lastVal = values[values.length - 1];
  const color = lastVal < 0 ? "#ef4444" : "#22c55e";
  return (
    <svg width={w} height={h} style={{ overflow: "visible", flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <circle cx={pts.split(" ").at(-1)!.split(",")[0]}
        cy={pts.split(" ").at(-1)!.split(",")[1]}
        r="2" fill={color} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SEVERITY
// ═══════════════════════════════════════════════════════════════════

const SEV_COLORS = {
  critical: { dot: "#ef4444", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.18)", text: "#ef4444", label: "Kritisk" },
  warning:  { dot: "#f59e0b", bg: "rgba(245,158,11,0.05)", border: "rgba(245,158,11,0.15)", text: "#f59e0b", label: "Varning" },
  info:     { dot: "#6c63ff", bg: "rgba(108,99,255,0.05)", border: "rgba(108,99,255,0.15)", text: "#9b94ff", label: "Bevaka" },
};

function SevBadge({ severity }: { severity: Alert["severity"] }) {
  const c = SEV_COLORS[severity];
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
      background: c.bg, color: c.text, border: `0.5px solid ${c.border}`,
    }}>
      {c.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DRILLDOWN TABLE — trace back to original data
// ═══════════════════════════════════════════════════════════════════

function DrilldownTable({ data }: { data: Alert["drilldown"] }) {
  if (!data || data.length === 0) return null;
  return (
    <div style={{
      marginTop: 14, borderRadius: 8, overflow: "hidden",
      border: "0.5px solid var(--border-mid)",
    }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase",
        color: "var(--text-faint)", padding: "8px 14px",
        background: "var(--bg-surface)", borderBottom: "0.5px solid var(--border-mid)",
      }}>
        Underliggande data per period
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "0.5px solid var(--border-mid)" }}>
            {["Period", "Utfall", "Budget", "Avvikelse"].map(h => (
              <th key={h} style={{
                fontSize: 10, fontWeight: 600, color: "var(--text-faint)",
                padding: "6px 14px", textAlign: h === "Period" ? "left" : "right",
                letterSpacing: ".04em", textTransform: "uppercase",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const v = row.variance;
            return (
              <tr key={i} style={{
                borderBottom: i < data.length - 1 ? "0.5px solid rgba(255,255,255,0.03)" : "none",
              }}>
                <td style={{ padding: "7px 14px", fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                  {row.period}
                </td>
                <td style={{ padding: "7px 14px", fontSize: 12, color: "var(--text-secondary)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(row.actual)}
                </td>
                <td style={{ padding: "7px 14px", fontSize: 12, color: "var(--text-faint)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {fmt(row.budget)}
                </td>
                <td style={{
                  padding: "7px 14px", fontSize: 12, textAlign: "right", fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  color: v >= 0 ? "#22c55e" : "#ef4444",
                }}>
                  {fmt(v)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ALERT CARD — expanded view
// ═══════════════════════════════════════════════════════════════════

function AlertCard({ alert, members, onAssign, onSchedule, onDismiss }: {
  alert: Alert;
  members: any[];
  onAssign: (userId: string) => void;
  onSchedule: () => void;
  onDismiss: () => void;
}) {
  const [showDrilldown, setShowDrilldown] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const c = SEV_COLORS[alert.severity];

  return (
    <div style={{
      background: "var(--bg-elevated)", border: `0.5px solid ${c.border}`,
      borderLeft: `3px solid ${c.dot}`,
      borderRadius: 10, padding: "18px 22px", marginBottom: 8,
    }}>
      {/* Top: headline + severity */}
      <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>{alert.account}</span>
            <SevBadge severity={alert.severity} />
            <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{alert.account_type}</span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
            {alert.headline}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 20 }}>
          <div style={{
            fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums",
            color: alert.variance >= 0 ? "#22c55e" : "#ef4444",
          }}>
            {fmt(alert.variance)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
            {pct(alert.variance_pct)}
          </div>
        </div>
      </div>

      {/* AI reasoning */}
      <div style={{
        padding: "10px 14px", borderRadius: 8,
        background: "rgba(108,99,255,0.04)", border: "0.5px solid rgba(108,99,255,0.12)",
        fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
        marginBottom: 14,
      }}>
        <span style={{ color: "#9b94ff", fontWeight: 600, marginRight: 6 }}>✦</span>
        {alert.reasoning}
      </div>

      {/* KPI row */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 80px", gap: 10,
        marginBottom: 14, padding: "10px 14px",
        background: "var(--bg-surface)", borderRadius: 8,
        border: "0.5px solid var(--border-mid)",
      }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 3 }}>Pågått</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: alert.streak_months >= 3 ? "#f59e0b" : "var(--text-secondary)" }}>
            {alert.streak_months} mån
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 3 }}>Trend</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: alert.acceleration > 0 ? "#ef4444" : alert.acceleration < 0 ? "#22c55e" : "var(--text-secondary)" }}>
            {alert.acceleration > 0 ? "↗ Eskalerar" : alert.acceleration < 0 ? "↘ Avtar" : "→ Stabil"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 3 }}>Helårsprognos</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: alert.year_end_impact >= 0 ? "#22c55e" : "#ef4444" }}>
            {fmt(alert.year_end_impact)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 3 }}>Åtgärd</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
            {alert.action}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkline values={alert.sparkline} w={70} h={28} />
        </div>
      </div>

      {/* Year-end risk */}
      {alert.year_end_risk && (
        <div style={{
          fontSize: 12, color: "var(--text-faint)", marginBottom: 14,
          padding: "6px 12px", borderRadius: 6,
          background: "rgba(239,68,68,0.03)", border: "0.5px solid rgba(239,68,68,0.08)",
        }}>
          <span style={{ fontWeight: 600, color: "#ef4444", marginRight: 4 }}>Helårsrisk:</span>
          {alert.year_end_risk}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setShowDrilldown(!showDrilldown)} style={{
          height: 32, padding: "0 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
          border: "0.5px solid var(--border-strong)", background: showDrilldown ? "rgba(108,99,255,0.08)" : "transparent",
          color: showDrilldown ? "#9b94ff" : "var(--text-muted)", cursor: "pointer", fontFamily: "inherit",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <span style={{ fontSize: 11 }}>{showDrilldown ? "▼" : "▶"}</span>
          Visa originaldata
        </button>

        <div style={{ position: "relative" }}>
          <button onClick={() => setAssignOpen(!assignOpen)} style={{
            height: 32, padding: "0 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
            border: "0.5px solid var(--border-strong)", background: "transparent",
            color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit",
          }}>
            Tilldela kollega
          </button>
          {assignOpen && members.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 20,
              background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
              borderRadius: 8, padding: 4, minWidth: 180,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}>
              {members.map(m => (
                <button key={m.id} onClick={() => { onAssign(m.id); setAssignOpen(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    padding: "6px 10px", border: "none", background: "transparent",
                    borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", background: "var(--accent-soft)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 600, color: "var(--accent-text)",
                  }}>{initials(m.full_name || "?")}</div>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{m.full_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={onSchedule} style={{
          height: 32, padding: "0 14px", borderRadius: 6, fontSize: 12, fontWeight: 500,
          border: "0.5px solid var(--border-strong)", background: "transparent",
          color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit",
        }}>
          Schemalägg uppföljning
        </button>

        <div style={{ flex: 1 }} />

        <button onClick={onDismiss} style={{
          height: 32, padding: "0 12px", borderRadius: 6, fontSize: 11,
          border: "0.5px solid var(--border)", background: "transparent",
          color: "var(--text-faint)", cursor: "pointer", fontFamily: "inherit",
        }}>
          Avfärda
        </button>
      </div>

      {/* Drilldown */}
      {showDrilldown && <DrilldownTable data={alert.drilldown} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════

export default function VariancesPage() {
  const pack = getPack();
  const reportItems = getReportItems();
  const { me, members } = useTeam();

  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [meta, setMeta] = useState<{
    summary: string;
    dismissed_reason: string;
    total_accounts_analyzed: number;
    candidates_evaluated: number;
    materiality_threshold: number;
  } | null>(null);
  const [error, setError] = useState("");

  // Fetch alerts from backend AI
  useEffect(() => {
    if (!pack) { setLoading(false); return; }

    async function fetchAlerts() {
      try {
        const res = await fetch(`${API_BASE}/api/intelligent-alerts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pack }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: AlertsResponse = await res.json();
        setAlerts(data.alerts || []);
        setMeta({
          summary: data.summary,
          dismissed_reason: data.dismissed_reason,
          total_accounts_analyzed: data.total_accounts_analyzed,
          candidates_evaluated: data.candidates_evaluated,
          materiality_threshold: data.materiality_threshold,
        });
      } catch (e: any) {
        setError(e.message || "Kunde inte hämta AI-analys.");
      } finally {
        setLoading(false);
      }
    }
    fetchAlerts();
  }, []);

  const visibleAlerts = alerts.filter(a => !dismissed.has(a.account));
  const criticalCount = visibleAlerts.filter(a => a.severity === "critical").length;
  const warningCount = visibleAlerts.filter(a => a.severity === "warning").length;
  const totalExposure = visibleAlerts.reduce((s, a) => s + a.year_end_impact, 0);

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header />
        <div className="ns-page">
          <div className="ns-hero-title">Avvikelser</div>
          <div className="ns-hero-sub" style={{ marginTop: 6 }}>
            Ingen data laddad — importera från Fortnox eller ladda upp en fil.
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <style>{`
        @keyframes nsPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
      <Header />
      <div className="ns-page">

        {/* ── HERO ── */}
        <div style={{ marginBottom: 20 }}>
          <div className="ns-hero-title">
            {loading ? "Analyserar..." : `${visibleAlerts.length} avvikelser kräver uppmärksamhet`}
          </div>
          <div className="ns-hero-sub" style={{ marginTop: 4 }}>
            {loading ? (
              <span style={{ animation: "nsPulse 1.5s ease infinite" }}>
                AI granskar {meta?.total_accounts_analyzed || "alla"} konton...
              </span>
            ) : (
              <>Period {pack.current_period} · {meta?.total_accounts_analyzed || 0} konton analyserade · {(meta?.total_accounts_analyzed || 0) - visibleAlerts.length} avfärdade som brus</>
            )}
          </div>
        </div>

        {/* ── ERROR ── */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, marginBottom: 16,
            background: "rgba(239,68,68,0.06)", border: "0.5px solid rgba(239,68,68,0.2)",
            color: "#ef4444", fontSize: 12,
          }}>
            {error}
          </div>
        )}

        {/* ── LOADING ── */}
        {loading && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 12, padding: "60px 0", color: "var(--text-faint)",
          }}>
            <div style={{
              width: 32, height: 32, border: "2px solid rgba(108,99,255,0.2)",
              borderTopColor: "#6c63ff", borderRadius: "50%",
              animation: "nsSpin .7s linear infinite",
            }} />
            <div style={{ fontSize: 13 }}>AI analyserar kontoplanen och söker mönster...</div>
          </div>
        )}

        {/* ── SUMMARY CARDS ── */}
        {!loading && visibleAlerts.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
            marginBottom: 20,
          }}>
            <div style={{
              padding: "14px 16px", borderRadius: 10,
              background: criticalCount > 0 ? "rgba(239,68,68,0.05)" : "var(--bg-elevated)",
              border: `0.5px solid ${criticalCount > 0 ? "rgba(239,68,68,0.18)" : "var(--border)"}`,
            }}>
              <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
                Kräver åtgärd
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: criticalCount > 0 ? "#ef4444" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                {criticalCount}
              </div>
            </div>
            <div style={{
              padding: "14px 16px", borderRadius: 10,
              background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
            }}>
              <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
                Bevaka
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: warningCount > 0 ? "#f59e0b" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                {warningCount}
              </div>
            </div>
            <div style={{
              padding: "14px 16px", borderRadius: 10,
              background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
            }}>
              <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
                Helårsexponering
              </div>
              <div style={{
                fontSize: 26, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                color: totalExposure >= 0 ? "#22c55e" : "#ef4444",
              }}>
                {fmt(totalExposure)}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>om inget åtgärdas</div>
            </div>
          </div>
        )}

        {/* ── AI SUMMARY ── */}
        {!loading && meta?.summary && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, marginBottom: 20,
            background: "rgba(108,99,255,0.04)", border: "0.5px solid rgba(108,99,255,0.12)",
            fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
          }}>
            <span style={{ color: "#9b94ff", fontWeight: 600, marginRight: 6 }}>✦</span>
            {meta.summary}
          </div>
        )}

        {/* ── ALERTS ── */}
        {!loading && visibleAlerts.length === 0 && !error && (
          <div style={{
            textAlign: "center", padding: "60px 20px", color: "var(--text-faint)",
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
              Allt ser bra ut
            </div>
            <div style={{ fontSize: 12 }}>
              AI hittade inga avvikelser som kräver uppmärksamhet denna period.
            </div>
          </div>
        )}

        {!loading && visibleAlerts.map(alert => (
          <AlertCard
            key={alert.account}
            alert={alert}
            members={members}
            onAssign={(uid) => {
              // TODO: Persist to Supabase
              console.log("Assign", alert.account, "to", uid);
            }}
            onSchedule={() => {
              // TODO: Open calendar scheduling
              console.log("Schedule follow-up for", alert.account);
            }}
            onDismiss={() => setDismissed(prev => new Set([...prev, alert.account]))}
          />
        ))}

        {/* ── TRANSPARENCY ── */}
        {!loading && meta && (
          <div style={{
            marginTop: 24, padding: "12px 16px", borderRadius: 8,
            background: "var(--bg-surface)", border: "0.5px solid var(--border-mid)",
            fontSize: 11, color: "var(--text-faint)", lineHeight: 1.7,
          }}>
            <span style={{ fontWeight: 600 }}>Så här tänkte AI:n: </span>
            {meta.total_accounts_analyzed} konton analyserade →
            {meta.candidates_evaluated} passerade materialitetsgränsen ({fmt(meta.materiality_threshold)}) →
            {visibleAlerts.length} flaggade som väsentliga.
            {meta.dismissed_reason && <> {meta.dismissed_reason}</>}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
