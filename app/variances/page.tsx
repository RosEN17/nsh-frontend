"use client";

import { useState, useMemo } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";
import { useTeam } from "@/lib/useTeam";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

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
// INTELLIGENT SCORING ENGINE
// ═══════════════════════════════════════════════════════════════════

// Kontotyp-vikt: konton som controllers bryr sig om mest
function accountWeight(accountNr: string): number {
  const nr = parseInt(accountNr, 10);
  if (isNaN(nr)) return 1;
  // 3xxx = Intäkter — alltid viktigt
  if (nr >= 3000 && nr < 4000) return 2.5;
  // 4xxx = Varuinköp/direkta kostnader
  if (nr >= 4000 && nr < 5000) return 2.0;
  // 5xxx = Lokalkostnader, hyror
  if (nr >= 5000 && nr < 6000) return 1.5;
  // 6xxx = Övriga kostnader — ofta brus
  if (nr >= 6000 && nr < 7000) return 0.8;
  // 7xxx = Personal — alltid viktigast
  if (nr >= 7000 && nr < 8000) return 3.0;
  // 8xxx = Finansiella poster
  if (nr >= 8000 && nr < 9000) return 1.2;
  return 1;
}

// Beräkna persistence: hur många perioder i rad har kontot avvikit?
function calcPersistence(accountNr: string, periodSeries: any[], accountRows: any[]): {
  streakMonths: number;
  direction: "neg" | "pos" | "mixed";
  values: number[];
} {
  // Bygg tidsserier per konto
  const sorted = [...(periodSeries || [])].sort((a, b) =>
    String(a.period || "").localeCompare(String(b.period || ""))
  );
  const periods = sorted.map(p => String(p.period || ""));

  // Hitta avvikelse per period för detta konto
  const values: number[] = [];
  for (const period of periods) {
    const row = (accountRows || []).find(
      (r: any) => String(r.account || r.Konto || "") === accountNr &&
                   String(r.period || "") === period
    );
    if (row) {
      const actual = Number(row.actual || 0);
      const budget = Number(row.budget || 0);
      values.push(actual - budget);
    }
  }

  // Räkna streak bakifrån
  let streak = 0;
  let dir: "neg" | "pos" | "mixed" = "mixed";
  if (values.length > 0) {
    const lastSign = values[values.length - 1] >= 0 ? "pos" : "neg";
    dir = lastSign;
    for (let i = values.length - 1; i >= 0; i--) {
      const sign = values[i] >= 0 ? "pos" : "neg";
      if (sign === lastSign) streak++;
      else break;
    }
  }
  return { streakMonths: streak, direction: dir, values };
}

// Acceleration: ökar avvikelsen?
function calcAcceleration(values: number[]): number {
  if (values.length < 3) return 0;
  const recent = values.slice(-3);
  const diffs = [
    Math.abs(recent[1]) - Math.abs(recent[0]),
    Math.abs(recent[2]) - Math.abs(recent[1]),
  ];
  // Positivt = eskalerande, negativt = avtagande
  return diffs.reduce((s, d) => s + d, 0) / 2;
}

// Helårsprognos: om trenden fortsätter
function annualForecast(monthlyVariance: number, remainingMonths: number): number {
  return monthlyVariance * remainingMonths;
}

type Severity = "critical" | "warning" | "info" | "noise";
type AlertType = {
  id: string;
  konto: string;
  label: string;
  severity: Severity;
  score: number;              // 0-100 composite score
  actual: number;
  budget: number;
  variance: number;
  variancePct: number;
  streakMonths: number;
  acceleration: number;
  yearEndImpact: number;
  accountWeight: number;
  insight: string;            // AI-genererad en-liner
  sparkline: number[];
  status: "open" | "reviewed" | "dismissed";
  owner_id: string | null;
  note: string;
};

function buildAlerts(pack: any): AlertType[] {
  if (!pack) return [];

  const topBudget = pack.top_budget || [];
  const topMom = pack.top_mom || [];
  const periodSeries = pack.period_series || [];
  const accountRows = pack.account_rows || [];
  const totalActual = pack.total_actual || 1;

  // Deduplicate
  const seen = new Set<string>();
  const allItems = [...topBudget, ...topMom].filter(x => {
    const k = String(x.Konto || x.account || "");
    if (seen.has(k) || k === "—") return false;
    seen.add(k);
    return true;
  });

  // Beräkna current month index → remaining months in year
  const currentPeriod = pack.current_period || "";
  const monthMatch = currentPeriod.match(/(\d{2})$/);
  const currentMonth = monthMatch ? parseInt(monthMatch[1], 10) : 6;
  const remainingMonths = Math.max(12 - currentMonth, 1);

  const alerts: AlertType[] = allItems.map((item, i) => {
    const konto = String(item.Konto || item.account || "");
    const label = String(item.Label || item.account_name || konto);
    const actual = Number(item.Utfall || item.actual || 0);
    const budget = Number(item.Budget || item.budget || 0);
    const variance = actual - budget;
    const variancePct = budget !== 0 ? variance / Math.abs(budget) : 0;

    const persistence = calcPersistence(konto, periodSeries, accountRows);
    const acceleration = calcAcceleration(persistence.values);
    const weight = accountWeight(konto);
    const yearEnd = annualForecast(variance, remainingMonths);

    // ── COMPOSITE SCORE (0–100) ──
    // Materialitet: andel av total
    const materialityScore = Math.min((Math.abs(variance) / Math.abs(totalActual)) * 500, 30);
    // Procent-avvikelse
    const pctScore = Math.min(Math.abs(variancePct) * 40, 20);
    // Persistence: hur länge
    const persistenceScore = Math.min(persistence.streakMonths * 5, 20);
    // Acceleration
    const accelScore = acceleration > 0 ? Math.min(acceleration / 1000, 15) : 0;
    // Kontotyp-vikt
    const weightScore = weight * 5;

    const score = Math.round(materialityScore + pctScore + persistenceScore + accelScore + weightScore);

    // ── SEVERITY CLASSIFICATION ──
    let severity: Severity = "noise";
    if (score >= 55) severity = "critical";
    else if (score >= 35) severity = "warning";
    else if (score >= 18) severity = "info";

    // ── INSIGHT ──
    let insight = "";
    if (persistence.streakMonths >= 3 && acceleration > 0) {
      insight = `Eskalerande trend — ${persistence.streakMonths} mån i rad, ökar. Helårspåverkan: ${fmt(yearEnd)}.`;
    } else if (persistence.streakMonths >= 3) {
      insight = `Stabilt avvikande i ${persistence.streakMonths} månader. Strukturellt problem — inte timing.`;
    } else if (Math.abs(variancePct) > 0.25) {
      insight = `Stor procentuell avvikelse (${pct(variancePct)}), men kan vara engångshändelse. Bevaka nästa period.`;
    } else if (weight >= 2.5) {
      insight = `Prioriterat konto (${label.split(" ")[0]}). Även liten avvikelse bör följas upp.`;
    } else {
      insight = `Mindre avvikelse. Inget akut.`;
    }

    return {
      id: `alert-${i}`,
      konto, label, severity, score,
      actual, budget, variance, variancePct,
      streakMonths: persistence.streakMonths,
      acceleration,
      yearEndImpact: yearEnd,
      accountWeight: weight,
      insight,
      sparkline: persistence.values.slice(-6),
      status: "open",
      owner_id: null,
      note: "",
    };
  });

  // Sortera: score descending
  return alerts.sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════════════════════════════
// SPARKLINE
// ═══════════════════════════════════════════════════════════════════

function Sparkline({ values, width = 80, height = 28 }: {
  values: number[]; width?: number; height?: number;
}) {
  if (values.length < 2) return <span style={{ color: "var(--text-faint)", fontSize: 10 }}>—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const lastVal = values[values.length - 1];
  const color = lastVal < 0 ? "#ef4444" : lastVal > 0 ? "#22c55e" : "#6c63ff";
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle
        cx={pts.split(" ").at(-1)!.split(",")[0]}
        cy={pts.split(" ").at(-1)!.split(",")[1]}
        r="2.5" fill={color} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SEVERITY INDICATOR
// ═══════════════════════════════════════════════════════════════════

function SeverityDot({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = {
    critical: "#ef4444",
    warning: "#f59e0b",
    info: "#6c63ff",
    noise: "#44445a",
  };
  return (
    <span style={{
      width: 8, height: 8, borderRadius: "50%",
      background: colors[severity],
      display: "inline-block", flexShrink: 0,
      boxShadow: severity === "critical" ? `0 0 6px ${colors.critical}40` : "none",
    }} />
  );
}

function SeverityLabel({ severity }: { severity: Severity }) {
  const labels: Record<Severity, string> = {
    critical: "Kritisk",
    warning: "Varning",
    info: "Bevaka",
    noise: "Brus",
  };
  const colors: Record<Severity, { bg: string; text: string; border: string }> = {
    critical: { bg: "rgba(239,68,68,0.08)", text: "#ef4444", border: "rgba(239,68,68,0.2)" },
    warning:  { bg: "rgba(245,158,11,0.08)", text: "#f59e0b", border: "rgba(245,158,11,0.2)" },
    info:     { bg: "rgba(108,99,255,0.08)", text: "#9b94ff", border: "rgba(108,99,255,0.2)" },
    noise:    { bg: "rgba(68,68,90,0.08)", text: "#666680", border: "rgba(68,68,90,0.2)" },
  };
  const c = colors[severity];
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
      background: c.bg, color: c.text, border: `0.5px solid ${c.border}`,
      letterSpacing: ".03em",
    }}>
      {labels[severity]}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SCORE BAR
// ═══════════════════════════════════════════════════════════════════

function ScoreBar({ score, severity }: { score: number; severity: Severity }) {
  const colors: Record<Severity, string> = {
    critical: "#ef4444", warning: "#f59e0b", info: "#6c63ff", noise: "#44445a",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 40, height: 4, borderRadius: 2,
        background: "rgba(255,255,255,0.06)",
      }}>
        <div style={{
          width: `${Math.min(score, 100)}%`, height: "100%", borderRadius: 2,
          background: colors[severity],
          transition: "width 0.3s ease",
        }} />
      </div>
      <span style={{ fontSize: 10, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
        {score}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EXPANDED ALERT PANEL
// ═══════════════════════════════════════════════════════════════════

function AlertDetail({ alert, onClose, onStatusChange, onDismiss }: {
  alert: AlertType;
  onClose: () => void;
  onStatusChange: (s: "open" | "reviewed" | "dismissed") => void;
  onDismiss: () => void;
}) {
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  async function fetchDeepAnalysis() {
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Du är en senior controller. Analysera denna avvikelse. Var kort och konkret — max 4 punkter.

KONTO: ${alert.konto} "${alert.label}"
AVVIKELSE: ${fmt(alert.variance)} (${pct(alert.variancePct)})
UTFALL: ${fmt(alert.actual)} | BUDGET: ${fmt(alert.budget)}
TREND: ${alert.streakMonths} månader i rad åt samma håll
ACCELERATION: ${alert.acceleration > 0 ? "Eskalerande" : alert.acceleration < 0 ? "Avtagande" : "Stabil"}
HELÅRSPROGNOS: ${fmt(alert.yearEndImpact)} om trenden fortsätter
KONTOTYP: Vikt ${alert.accountWeight} (3=personal/intäkt, 1=övrigt)

Svara med exakt denna struktur:
ORSAK: [en mening]
RISK: [hög/medel/låg + en mening]
ÅTGÄRD: [en konkret handling]
PROGNOS: [en mening om helårspåverkan]`,
          pack: { current_period: "", total_actual: 0, total_budget: 0 },
        }),
      });
      const data = await res.json();
      setAiAnalysis(data.answer || "Kunde inte analysera.");
    } catch {
      setAiAnalysis("AI-analys misslyckades.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div style={{
      background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
      borderRadius: 12, padding: "20px 24px", marginTop: 4, marginBottom: 12,
      borderLeft: `3px solid ${alert.severity === "critical" ? "#ef4444" : alert.severity === "warning" ? "#f59e0b" : "#6c63ff"}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>{alert.konto}</span>
            <SeverityLabel severity={alert.severity} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{alert.label}</div>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--text-faint)",
          fontSize: 16, cursor: "pointer", padding: 4,
        }}>✕</button>
      </div>

      {/* KPI Grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12,
        marginBottom: 18, padding: "14px 16px",
        background: "var(--bg-surface)", borderRadius: 8,
        border: "0.5px solid var(--border-mid)",
      }}>
        {[
          { label: "Avvikelse", value: fmt(alert.variance), color: alert.variance >= 0 ? "#22c55e" : "#ef4444" },
          { label: "Avvikelse %", value: pct(alert.variancePct), color: alert.variancePct >= 0 ? "#22c55e" : "#ef4444" },
          { label: "Pågått", value: `${alert.streakMonths} mån`, color: alert.streakMonths >= 3 ? "#f59e0b" : "var(--text-secondary)" },
          { label: "Trend", value: alert.acceleration > 0 ? "↗ Eskalerar" : alert.acceleration < 0 ? "↘ Avtar" : "→ Stabil", color: alert.acceleration > 0 ? "#ef4444" : alert.acceleration < 0 ? "#22c55e" : "var(--text-secondary)" },
          { label: "Helårsprognos", value: fmt(alert.yearEndImpact), color: alert.yearEndImpact >= 0 ? "#22c55e" : "#ef4444" },
        ].map(k => (
          <div key={k.label}>
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginBottom: 4, letterSpacing: ".04em", textTransform: "uppercase" }}>{k.label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: k.color, fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Insight */}
      <div style={{
        padding: "10px 14px", borderRadius: 8,
        background: "rgba(108,99,255,0.05)", border: "0.5px solid rgba(108,99,255,0.15)",
        fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
        marginBottom: 16,
      }}>
        <span style={{ color: "#9b94ff", fontWeight: 600, marginRight: 6 }}>✦</span>
        {alert.insight}
      </div>

      {/* AI Deep Analysis */}
      <div style={{ marginBottom: 16 }}>
        {!aiAnalysis && !aiLoading && (
          <button onClick={fetchDeepAnalysis} style={{
            height: 34, padding: "0 16px", borderRadius: 6,
            border: "0.5px solid rgba(108,99,255,0.3)", background: "rgba(108,99,255,0.06)",
            color: "#9b94ff", fontSize: 12, fontWeight: 500, cursor: "pointer",
            fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontSize: 13 }}>✦</span> Djupanalys med AI
          </button>
        )}
        {aiLoading && (
          <div style={{ fontSize: 12, color: "var(--text-faint)", padding: "8px 0" }}>
            Analyserar...
          </div>
        )}
        {aiAnalysis && (
          <div style={{
            padding: "12px 16px", borderRadius: 8,
            background: "var(--bg-surface)", border: "0.5px solid var(--border-mid)",
            fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7,
            whiteSpace: "pre-line",
          }}>
            {aiAnalysis}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onStatusChange("reviewed")} style={{
          height: 32, padding: "0 14px", borderRadius: 6,
          border: "none", background: "#22c55e", color: "#fff",
          fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
        }}>
          ✓ Hanterad
        </button>
        <button onClick={onDismiss} style={{
          height: 32, padding: "0 14px", borderRadius: 6,
          border: "0.5px solid var(--border-strong)", background: "transparent",
          color: "var(--text-faint)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
        }}>
          Avfärda — brus
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════

export default function VariancesPage() {
  const pack = getPack();
  const reportItems = getReportItems();
  const { me, members, company } = useTeam();

  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [alerts, setAlerts] = useState<AlertType[]>(() => buildAlerts(pack));

  // Computed
  const filtered = useMemo(() => {
    let result = alerts.filter(a => a.status !== "dismissed");
    if (filter === "critical") result = result.filter(a => a.severity === "critical");
    if (filter === "warning") result = result.filter(a => a.severity === "warning");
    if (filter === "info") result = result.filter(a => a.severity === "info" || a.severity === "noise");
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.label.toLowerCase().includes(q) || a.konto.includes(q)
      );
    }
    return result;
  }, [alerts, filter, search]);

  const criticalCount = alerts.filter(a => a.severity === "critical" && a.status === "open").length;
  const warningCount = alerts.filter(a => a.severity === "warning" && a.status === "open").length;
  const totalExposure = alerts
    .filter(a => (a.severity === "critical" || a.severity === "warning") && a.status === "open")
    .reduce((s, a) => s + a.yearEndImpact, 0);

  function updateAlert(id: string, patch: Partial<AlertType>) {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
    if (patch.status === "reviewed" || patch.status === "dismissed") {
      setExpandedId(null);
    }
  }

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header reportCount={0} />
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
      <Header reportCount={reportItems.length} />
      <div className="ns-page">

        {/* ── HERO ── */}
        <div style={{ marginBottom: 24 }}>
          <div className="ns-hero-title">Avvikelser som spelar roll</div>
          <div className="ns-hero-sub" style={{ marginTop: 4 }}>
            Period {pack.current_period} · {alerts.filter(a => a.status === "open").length} aktiva
          </div>
        </div>

        {/* ── TOP SUMMARY ── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
          marginBottom: 24,
        }}>
          {/* Critical */}
          <div style={{
            padding: "16px 18px", borderRadius: 10,
            background: criticalCount > 0 ? "rgba(239,68,68,0.06)" : "var(--bg-elevated)",
            border: `0.5px solid ${criticalCount > 0 ? "rgba(239,68,68,0.2)" : "var(--border)"}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <SeverityDot severity="critical" />
              <span style={{ fontSize: 11, color: "var(--text-faint)", letterSpacing: ".04em", textTransform: "uppercase", fontWeight: 600 }}>Kräver åtgärd</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: criticalCount > 0 ? "#ef4444" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
              {criticalCount}
            </div>
          </div>

          {/* Warnings */}
          <div style={{
            padding: "16px 18px", borderRadius: 10,
            background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <SeverityDot severity="warning" />
              <span style={{ fontSize: 11, color: "var(--text-faint)", letterSpacing: ".04em", textTransform: "uppercase", fontWeight: 600 }}>Bevaka</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: warningCount > 0 ? "#f59e0b" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
              {warningCount}
            </div>
          </div>

          {/* Exposure */}
          <div style={{
            padding: "16px 18px", borderRadius: 10,
            background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
          }}>
            <div style={{ fontSize: 11, color: "var(--text-faint)", letterSpacing: ".04em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
              Helårsexponering
            </div>
            <div style={{
              fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              color: totalExposure >= 0 ? "#22c55e" : "#ef4444",
            }}>
              {fmt(totalExposure)}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>
              Om inget åtgärdas
            </div>
          </div>
        </div>

        {/* ── FILTER BAR ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
        }}>
          {([
            { key: "all", label: "Alla" },
            { key: "critical", label: "Kritiska" },
            { key: "warning", label: "Varningar" },
            { key: "info", label: "Informativa" },
          ] as const).map(f => (
            <button key={f.key}
              onClick={() => setFilter(f.key)}
              className={`ns-toolbar-btn${filter === f.key ? " active" : ""}`}>
              {f.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div className="ns-search-wrap">
            <span className="ns-search-icon" style={{ fontSize: 13 }}>⌕</span>
            <input className="ns-search" placeholder="Sök konto..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* ── ALERT LIST ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.length === 0 && (
            <div style={{
              textAlign: "center", padding: 48, color: "var(--text-faint)", fontSize: 13,
            }}>
              {filter === "all" ? "Inga avvikelser att visa" : "Inga avvikelser i denna kategori"}
            </div>
          )}

          {filtered.map(alert => (
            <div key={alert.id}>
              {/* Alert row */}
              <div
                onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "10px 1fr 100px 90px 90px 80px 60px",
                  alignItems: "center",
                  gap: 14,
                  padding: "12px 16px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: expandedId === alert.id ? "var(--bg-elevated)" : "transparent",
                  border: expandedId === alert.id ? "0.5px solid var(--border)" : "0.5px solid transparent",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => {
                  if (expandedId !== alert.id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)";
                }}
                onMouseLeave={e => {
                  if (expandedId !== alert.id) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {/* Severity dot */}
                <SeverityDot severity={alert.severity} />

                {/* Label + insight */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                      {alert.konto}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {alert.label}
                    </span>
                    {alert.status === "reviewed" && (
                      <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 600 }}>✓</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, color: "var(--text-faint)", marginTop: 2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {alert.insight}
                  </div>
                </div>

                {/* Variance amount */}
                <div style={{
                  textAlign: "right", fontSize: 13, fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  color: alert.variance >= 0 ? "#22c55e" : "#ef4444",
                }}>
                  {fmt(alert.variance)}
                </div>

                {/* Variance % */}
                <div style={{
                  textAlign: "right", fontSize: 12,
                  color: alert.variancePct >= 0 ? "#22c55e" : "#ef4444",
                  opacity: 0.7,
                }}>
                  {pct(alert.variancePct)}
                </div>

                {/* Streak */}
                <div style={{ textAlign: "center" }}>
                  {alert.streakMonths >= 2 ? (
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 10,
                      background: alert.streakMonths >= 3 ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.04)",
                      color: alert.streakMonths >= 3 ? "#f59e0b" : "var(--text-faint)",
                      border: `0.5px solid ${alert.streakMonths >= 3 ? "rgba(245,158,11,0.2)" : "transparent"}`,
                    }}>
                      {alert.streakMonths} mån
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: "var(--text-faint)" }}>—</span>
                  )}
                </div>

                {/* Sparkline */}
                <Sparkline values={alert.sparkline} width={70} height={24} />

                {/* Score */}
                <ScoreBar score={alert.score} severity={alert.severity} />
              </div>

              {/* Expanded detail */}
              {expandedId === alert.id && (
                <AlertDetail
                  alert={alert}
                  onClose={() => setExpandedId(null)}
                  onStatusChange={s => updateAlert(alert.id, { status: s })}
                  onDismiss={() => updateAlert(alert.id, { status: "dismissed" })}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Dismissed count ── */}
        {alerts.filter(a => a.status === "dismissed").length > 0 && (
          <div style={{
            textAlign: "center", padding: "20px 0", fontSize: 11, color: "var(--text-faint)",
          }}>
            {alerts.filter(a => a.status === "dismissed").length} avvikelser avfärdade som brus
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
