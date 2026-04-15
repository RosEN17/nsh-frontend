"use client";

import { useState, useEffect } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, saveReportItems, getReportItems } from "@/lib/store";
import type { ReportItem } from "@/lib/store";

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

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════
   MINI CHART — account trend over time (used in expanded view)
   ═══════════════════════════════════════════════════════════════════ */

function MiniChart({ drilldown }: { drilldown: Alert["drilldown"] }) {
  if (!drilldown || drilldown.length < 2) return null;

  const W = 280;
  const H = 90;
  const padX = 32;
  const padTop = 8;
  const padBot = 20;
  const chartW = W - padX * 2;
  const chartH = H - padTop - padBot;

  const allVals = drilldown.flatMap((d: { actual: number; budget: number }) => [d.actual, d.budget].filter((v: number) => v !== 0));
  const minV = Math.min(...allVals, 0);
  const maxV = Math.max(...allVals, 1);
  const range = maxV - minV || 1;

  function x(i: number): number { return padX + (i / (drilldown.length - 1)) * chartW; }
  function y(v: number): number { return padTop + chartH - ((v - minV) / range) * chartH; }

  const actualPts = drilldown.map((d: { actual: number }, i: number) => `${x(i)},${y(d.actual)}`).join(" ");
  const budgetPts = drilldown.map((d: { budget: number }, i: number) => `${x(i)},${y(d.budget)}`).join(" ");

  // Area fill under actual line
  const areaD = `M${drilldown.map((d: { actual: number }, i: number) => `${x(i)},${y(d.actual)}`).join(" L")} L${x(drilldown.length - 1)},${H - padBot} L${x(0)},${H - padBot} Z`;

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6c63ff" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#6c63ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Budget line (dashed) */}
      <polyline points={budgetPts} fill="none" stroke="rgba(255,255,255,0.15)"
        strokeWidth="1" strokeDasharray="3 3" />
      {/* Actual area + line */}
      <path d={areaD} fill="url(#areaFill)" />
      <polyline points={actualPts} fill="none" stroke="#6c63ff"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots on actual */}
      {drilldown.map((d: { actual: number }, i: number) => (
        <circle key={i} cx={x(i)} cy={y(d.actual)} r={i === drilldown.length - 1 ? 3 : 2}
          fill={i === drilldown.length - 1 ? "#6c63ff" : "var(--bg-elevated)"}
          stroke="#6c63ff" strokeWidth="1.5" />
      ))}
      {/* Period labels */}
      {drilldown.map((d: { period: string }, i: number) => {
        // Show first, last, and middle
        if (i !== 0 && i !== drilldown.length - 1 && i !== Math.floor(drilldown.length / 2)) return null;
        return (
          <text key={i} x={x(i)} y={H - 4} textAnchor="middle"
            style={{ fontSize: 9, fill: "var(--text-faint)" }}>
            {d.period.slice(-5)}
          </text>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SPARKLINE — small inline trend indicator
   ═══════════════════════════════════════════════════════════════════ */

function Sparkline({ values, w = 72, h = 26 }: { values: number[]; w?: number; h?: number }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v: number, i: number) => {
    const px = (i / (values.length - 1)) * w;
    const py = h - ((v - min) / range) * (h - 6) - 3;
    return `${px},${py}`;
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

/* ═══════════════════════════════════════════════════════════════════
   SEVERITY
   ═══════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════
   ALERT CARD — expandable with comment field and mini chart
   ═══════════════════════════════════════════════════════════════════ */

function AlertCard({ alert, expanded, onToggle, comment, onComment, onDismiss }: {
  alert: Alert;
  expanded: boolean;
  onToggle: () => void;
  comment: string;
  onComment: (text: string) => void;
  onDismiss: () => void;
}) {
  const c = SEV_COLORS[alert.severity];

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: `0.5px solid ${expanded ? c.border : "var(--border)"}`,
      borderLeft: `3px solid ${c.dot}`,
      borderRadius: 10, marginBottom: 8,
      transition: "border-color 0.15s",
    }}>
      {/* ── Collapsed row (always visible) ── */}
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 18px", cursor: "pointer",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
              {alert.account}
            </span>
            <SevBadge severity={alert.severity} />
            {alert.streak_months >= 2 && (
              <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
                {alert.streak_months} mån
              </span>
            )}
            {alert.acceleration > 0 && (
              <span style={{ fontSize: 10, color: "#ef4444" }}>↗ Eskalerar</span>
            )}
            {alert.acceleration < 0 && (
              <span style={{ fontSize: 10, color: "#22c55e" }}>↘ Avtar</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
            {alert.headline}
          </div>
        </div>

        <Sparkline values={alert.sparkline} w={64} h={24} />

        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums",
            color: alert.variance >= 0 ? "#22c55e" : "#ef4444",
          }}>
            {fmt(alert.variance)}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-faint)" }}>
            {pct(alert.variance_pct)}
          </div>
        </div>

        {comment && (
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: "#6c63ff",
            flexShrink: 0, marginLeft: 4,
          }} title="Har kommentar" />
        )}

        <span style={{
          fontSize: 11, color: "var(--text-faint)", flexShrink: 0,
          transform: expanded ? "rotate(180deg)" : "none",
          transition: "transform 0.15s",
        }}>▼</span>
      </div>

      {/* ── Expanded view ── */}
      {expanded && (
        <div style={{
          padding: "0 18px 18px",
          borderTop: "0.5px solid var(--border-mid)",
        }}>
          {/* AI reasoning */}
          <div style={{
            padding: "10px 14px", borderRadius: 8, marginTop: 14,
            background: "rgba(108,99,255,0.04)", border: "0.5px solid rgba(108,99,255,0.12)",
            fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
          }}>
            <span style={{ color: "#9b94ff", fontWeight: 600, marginRight: 6 }}>✦</span>
            {alert.reasoning}
          </div>

          {/* KPI row + mini chart side by side */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 280px",
            gap: 12, marginTop: 14,
          }}>
            <div style={{
              padding: "10px 14px", borderRadius: 8,
              background: "var(--bg-surface)", border: "0.5px solid var(--border-mid)",
            }}>
              <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 3 }}>
                Pågått
              </div>
              <div style={{
                fontSize: 16, fontWeight: 600,
                color: alert.streak_months >= 3 ? "#f59e0b" : "var(--text-secondary)",
              }}>
                {alert.streak_months} månader
              </div>
            </div>
            <div style={{
              padding: "10px 14px", borderRadius: 8,
              background: "var(--bg-surface)", border: "0.5px solid var(--border-mid)",
            }}>
              <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 3 }}>
                Trend
              </div>
              <div style={{
                fontSize: 16, fontWeight: 600,
                color: alert.acceleration > 0 ? "#ef4444" : alert.acceleration < 0 ? "#22c55e" : "var(--text-secondary)",
              }}>
                {alert.acceleration > 0 ? "↗ Eskalerar" : alert.acceleration < 0 ? "↘ Avtar" : "→ Stabil"}
              </div>
            </div>

            {/* Mini chart */}
            <div style={{
              padding: "8px 12px", borderRadius: 8,
              background: "var(--bg-surface)", border: "0.5px solid var(--border-mid)",
              display: "flex", flexDirection: "column", alignItems: "center",
            }}>
              <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 4, alignSelf: "flex-start" }}>
                Utfall vs budget
              </div>
              <MiniChart drilldown={alert.drilldown} />
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: 9, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 2, background: "#6c63ff", borderRadius: 1 }} /> Utfall
                </span>
                <span style={{ fontSize: 9, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 2, background: "rgba(255,255,255,0.15)", borderRadius: 1, borderTop: "1px dashed rgba(255,255,255,0.3)" }} /> Budget
                </span>
              </div>
            </div>
          </div>

          {/* ── Comment field ── */}
          <div style={{ marginTop: 14 }}>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase",
              color: "var(--text-faint)", marginBottom: 6,
            }}>
              Din bedömning
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 6, color: "var(--text-faint)", opacity: 0.7 }}>
                — följer med i exporten
              </span>
            </div>
            <textarea
              value={comment}
              onChange={(e) => onComment(e.target.value)}
              placeholder='T.ex. "Engångskostnad pga kontorsflytt, normaliseras i feb" eller "Eskalerar — ta upp med säljchef"'
              rows={2}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 8,
                border: comment
                  ? "0.5px solid rgba(108,99,255,0.3)"
                  : "0.5px solid var(--border-strong)",
                background: comment
                  ? "rgba(108,99,255,0.04)"
                  : "var(--bg-surface)",
                color: "var(--text-secondary)", fontSize: 12, fontFamily: "inherit",
                lineHeight: 1.5, resize: "vertical", outline: "none",
                transition: "border-color 0.15s, background 0.15s",
              }}
            />
            {comment && (
              <div style={{ fontSize: 10, color: "#22c55e", marginTop: 4 }}>
                ✓ Sparad — inkluderas i nästa rapport
              </div>
            )}
          </div>

          {/* ── Bottom actions ── */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={onDismiss} style={{
              height: 30, padding: "0 12px", borderRadius: 6, fontSize: 11,
              border: "0.5px solid var(--border)", background: "transparent",
              color: "var(--text-faint)", cursor: "pointer", fontFamily: "inherit",
            }}>
              Avfärda
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMMENTS PERSISTENCE
   ═══════════════════════════════════════════════════════════════════ */

type VarianceComments = Record<string, string>; // account -> comment

function loadComments(): VarianceComments {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem("nordsheet_variance_comments");
  return raw ? JSON.parse(raw) : {};
}

function persistComments(comments: VarianceComments) {
  if (typeof window === "undefined") return;
  localStorage.setItem("nordsheet_variance_comments", JSON.stringify(comments));

  // Also sync to report_items so they're included in export
  const items: ReportItem[] = Object.entries(comments)
    .filter(([_, text]) => text.trim())
    .map(([account, text]) => ({
      id: `variance-${account}`,
      title: `Avvikelse ${account}`,
      text: text.trim(),
      severity: "warning",
      status: "commented",
    }));
  saveReportItems(items);
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function VariancesPage() {
  const pack = getPack();

  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comments, setComments] = useState<VarianceComments>({});
  const [meta, setMeta] = useState<{
    summary: string;
    dismissed_reason: string;
    total_accounts_analyzed: number;
    candidates_evaluated: number;
    materiality_threshold: number;
  } | null>(null);
  const [error, setError] = useState("");

  // Load saved comments
  useEffect(() => { setComments(loadComments()); }, []);

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

  function handleComment(account: string, text: string) {
    const updated = { ...comments, [account]: text };
    setComments(updated);
    persistComments(updated);
  }

  const visibleAlerts = alerts.filter((a: Alert) => !dismissed.has(a.account));
  const criticalCount = visibleAlerts.filter((a: Alert) => a.severity === "critical").length;
  const warningCount = visibleAlerts.filter((a: Alert) => a.severity === "warning").length;
  const commentedCount = visibleAlerts.filter((a: Alert) => comments[a.account]?.trim()).length;

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header />
        <div className="ns-page">
          <div className="ns-hero-title">Avvikelser</div>
          <div className="ns-hero-sub" style={{ marginTop: 6 }}>
            Ingen data laddad — gå till <a href="/data" style={{ color: "var(--accent-text)" }}>Data</a> och koppla Fortnox eller ladda upp en fil.
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  return (
    <ProtectedLayout>
      <style>{`
        @keyframes nsPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes nsSpin { to { transform: rotate(360deg); } }
      `}</style>
      <Header />
      <div className="ns-page">

        {/* ── HERO ── */}
        <div style={{ marginBottom: 20 }}>
          <div className="ns-hero-title">
            {loading ? "Analyserar..." : `${visibleAlerts.length} avvikelser`}
          </div>
          <div className="ns-hero-sub" style={{ marginTop: 4 }}>
            {loading ? (
              <span style={{ animation: "nsPulse 1.5s ease infinite" }}>
                AI granskar {meta?.total_accounts_analyzed || "alla"} konton...
              </span>
            ) : (
              <>
                Period {pack.current_period} · {meta?.total_accounts_analyzed || 0} konton analyserade
                {commentedCount > 0 && (
                  <span style={{ color: "var(--accent-text)", marginLeft: 8 }}>
                    · {commentedCount} kommenterade
                  </span>
                )}
              </>
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
                Kritiska
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
                Varningar
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: warningCount > 0 ? "#f59e0b" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                {warningCount}
              </div>
            </div>
            <div style={{
              padding: "14px 16px", borderRadius: 10,
              background: commentedCount > 0 ? "rgba(108,99,255,0.04)" : "var(--bg-elevated)",
              border: `0.5px solid ${commentedCount > 0 ? "rgba(108,99,255,0.15)" : "var(--border)"}`,
            }}>
              <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
                Kommenterade
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: commentedCount > 0 ? "#9b94ff" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                {commentedCount} / {visibleAlerts.length}
              </div>
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

        {!loading && visibleAlerts.map((alert: Alert) => (
          <AlertCard
            key={alert.account}
            alert={alert}
            expanded={expanded === alert.account}
            onToggle={() => setExpanded(expanded === alert.account ? null : alert.account)}
            comment={comments[alert.account] || ""}
            onComment={(text: string) => handleComment(alert.account, text)}
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
            {meta.total_accounts_analyzed} konton analyserade →{" "}
            {meta.candidates_evaluated} passerade materialitetsgränsen ({fmt(meta.materiality_threshold)}) →{" "}
            {visibleAlerts.length} flaggade som väsentliga.
            {meta.dismissed_reason && <> {meta.dismissed_reason}</>}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
