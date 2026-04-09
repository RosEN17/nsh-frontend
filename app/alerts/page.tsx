"use client";

import { useState, useEffect } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack } from "@/lib/store";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

function fmt(n: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MSEK`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)} tkr`;
  return `${Math.round(n)} kr`;
}

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

type Check = {
  type: string;
  account: string;
  account_name: string;
  severity: "critical" | "warning" | "info";
  headline: string;
  explanation: string;
  suggestion: string;
  detail: Record<string, any>;
};

// ═══════════════════════════════════════════════════════════════════
// ICONS PER CHECK TYPE
// ═══════════════════════════════════════════════════════════════════

function CheckIcon({ type }: { type: string }) {
  const icons: Record<string, { icon: string; bg: string }> = {
    missing_period:   { icon: "◌", bg: "rgba(245,158,11,0.08)" },
    outlier:          { icon: "⚡", bg: "rgba(239,68,68,0.08)" },
    dormant_account:  { icon: "◇", bg: "rgba(108,99,255,0.08)" },
    budget_no_actual: { icon: "∅", bg: "rgba(239,68,68,0.08)" },
    empty_period:     { icon: "▫", bg: "rgba(245,158,11,0.08)" },
  };
  const cfg = icons[type] || { icon: "?", bg: "rgba(255,255,255,0.04)" };
  return (
    <div style={{
      width: 34, height: 34, borderRadius: 8,
      background: cfg.bg, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: 16, flexShrink: 0,
      color: "var(--text-secondary)",
    }}>
      {cfg.icon}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SEVERITY BADGE
// ═══════════════════════════════════════════════════════════════════

const SEV = {
  critical: { label: "Kritisk", bg: "rgba(239,68,68,0.08)", text: "#ef4444", border: "rgba(239,68,68,0.2)" },
  warning:  { label: "Varning", bg: "rgba(245,158,11,0.08)", text: "#f59e0b", border: "rgba(245,158,11,0.2)" },
  info:     { label: "Info",    bg: "rgba(108,99,255,0.08)", text: "#9b94ff", border: "rgba(108,99,255,0.2)" },
};

function SevBadge({ severity }: { severity: Check["severity"] }) {
  const c = SEV[severity];
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
// TYPE LABEL
// ═══════════════════════════════════════════════════════════════════

const TYPE_LABELS: Record<string, string> = {
  missing_period:   "Saknad period",
  outlier:          "Ovanligt belopp",
  dormant_account:  "Inaktivt konto",
  budget_no_actual: "Budget utan utfall",
  empty_period:     "Tom period",
};

// ═══════════════════════════════════════════════════════════════════
// DETAIL VIEW — varies by check type
// ═══════════════════════════════════════════════════════════════════

function DetailView({ check }: { check: Check }) {
  const d = check.detail || {};

  return (
    <div style={{
      marginTop: 12, padding: "12px 14px", borderRadius: 8,
      background: "var(--bg-surface)", border: "0.5px solid var(--border-mid)",
    }}>
      {check.type === "missing_period" && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12 }}>
          <div>
            <span style={{ color: "var(--text-faint)" }}>Saknade perioder: </span>
            <span style={{ color: "#f59e0b", fontWeight: 600 }}>
              {(d.missing_periods || []).join(", ")}
            </span>
          </div>
          <div>
            <span style={{ color: "var(--text-faint)" }}>Finns i: </span>
            <span style={{ color: "var(--text-secondary)" }}>
              {d.present_periods}/{d.expected_periods} perioder
            </span>
          </div>
          <div>
            <span style={{ color: "var(--text-faint)" }}>Snittbelopp: </span>
            <span style={{ color: "var(--text-secondary)" }}>{fmt(d.avg_value)}</span>
          </div>
        </div>
      )}

      {check.type === "outlier" && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12 }}>
          <div>
            <span style={{ color: "var(--text-faint)" }}>Period: </span>
            <span style={{ color: "var(--text-secondary)" }}>{d.period}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-faint)" }}>Belopp: </span>
            <span style={{ color: "#ef4444", fontWeight: 600 }}>{fmt(d.value)}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-faint)" }}>Median: </span>
            <span style={{ color: "var(--text-secondary)" }}>{fmt(d.median)}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-faint)" }}>Avvikelse: </span>
            <span style={{ color: "#ef4444" }}>{d.deviation_factor}x standardavvikelse</span>
          </div>
        </div>
      )}

      {check.type === "dormant_account" && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12 }}>
          <div>
            <span style={{ color: "var(--text-faint)" }}>Senast aktivt: </span>
            <span style={{ color: "var(--text-secondary)" }}>{d.last_active_period}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-faint)" }}>Snittbelopp när aktivt: </span>
            <span style={{ color: "var(--text-secondary)" }}>{fmt(d.avg_when_active)}</span>
          </div>
        </div>
      )}

      {check.type === "budget_no_actual" && (
        <div style={{ fontSize: 12 }}>
          <span style={{ color: "var(--text-faint)" }}>Budgeterat: </span>
          <span style={{ color: "#f59e0b", fontWeight: 600 }}>{fmt(d.budget)}</span>
          <span style={{ color: "var(--text-faint)" }}> — men 0 kr bokfört</span>
        </div>
      )}

      {check.type === "empty_period" && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12 }}>
          <div>
            <span style={{ color: "var(--text-faint)" }}>Period: </span>
            <span style={{ color: "#f59e0b", fontWeight: 600 }}>{d.period}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-faint)" }}>Bokfört: </span>
            <span style={{ color: "var(--text-secondary)" }}>{fmt(d.total)}</span>
          </div>
          <div>
            <span style={{ color: "var(--text-faint)" }}>Förväntat: </span>
            <span style={{ color: "var(--text-secondary)" }}>{fmt(d.expected)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CHECK CARD
// ═══════════════════════════════════════════════════════════════════

function CheckCard({ check, onDismiss }: { check: Check; onDismiss: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const c = SEV[check.severity];

  return (
    <div style={{
      background: "var(--bg-elevated)", border: `0.5px solid ${c.border}`,
      borderLeft: `3px solid ${c.text}`,
      borderRadius: 10, padding: "16px 20px", marginBottom: 6,
    }}>
      {/* Top row */}
      <div style={{
        display: "flex", alignItems: "start", gap: 12, cursor: "pointer",
      }} onClick={() => setExpanded(!expanded)}>
        <CheckIcon type={check.type} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
              {TYPE_LABELS[check.type] || check.type}
            </span>
            <SevBadge severity={check.severity} />
            {check.account && check.account !== "—" && (
              <span style={{ fontSize: 10, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                {check.account}
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>
            {check.headline}
          </div>
        </div>
        <span style={{
          fontSize: 11, color: "var(--text-faint)", flexShrink: 0,
          transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 0.15s",
        }}>
          ▶
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {/* AI explanation */}
          {check.explanation && (
            <div style={{
              padding: "10px 14px", borderRadius: 8,
              background: "rgba(108,99,255,0.04)", border: "0.5px solid rgba(108,99,255,0.1)",
              fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
              marginBottom: 10,
            }}>
              <span style={{ color: "#9b94ff", fontWeight: 600, marginRight: 6 }}>✦</span>
              {check.explanation}
            </div>
          )}

          {/* Suggestion */}
          {check.suggestion && (
            <div style={{
              fontSize: 12, color: "var(--text-muted)", marginBottom: 10,
              padding: "8px 12px", borderRadius: 6,
              background: "rgba(34,197,94,0.04)", border: "0.5px solid rgba(34,197,94,0.1)",
            }}>
              <span style={{ fontWeight: 600, color: "#22c55e", marginRight: 4 }}>Åtgärd:</span>
              {check.suggestion}
            </div>
          )}

          {/* Detail data */}
          <DetailView check={check} />

          {/* Actions */}
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

// ═══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════

export default function AlertsPage() {
  const pack = getPack();

  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<Check[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState("");
  const [totalFound, setTotalFound] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pack) { setLoading(false); return; }

    async function fetchQuality() {
      try {
        const res = await fetch(`${API_BASE}/api/data-quality`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pack }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setChecks(data.checks || []);
        setSummary(data.summary || "");
        setTotalFound(data.total_issues_found || 0);
      } catch (e: any) {
        setError(e.message || "Kunde inte köra datakvalitetsanalys.");
      } finally {
        setLoading(false);
      }
    }
    fetchQuality();
  }, []);

  const visible = checks.filter((_, i) => !dismissed.has(i));
  const critCount = visible.filter(c => c.severity === "critical").length;
  const warnCount = visible.filter(c => c.severity === "warning").length;

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header reportCount={0} />
        <div className="ns-page">
          <div className="ns-hero-title">Datakvalitet</div>
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
        @keyframes nsSpin { to { transform: rotate(360deg); } }
        @keyframes nsPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
      <Header reportCount={0} />
      <div className="ns-page">

        {/* ── HERO ── */}
        <div style={{ marginBottom: 20 }}>
          <div className="ns-hero-title">Datakvalitet</div>
          <div className="ns-hero-sub" style={{ marginTop: 4 }}>
            {loading ? (
              <span style={{ animation: "nsPulse 1.5s ease infinite" }}>
                AI granskar bokföringen...
              </span>
            ) : (
              <>
                {visible.length === 0 ? "Inga problem hittades" : `${visible.length} saker att kontrollera`}
                {totalFound > 0 && ` · ${totalFound} potentiella problem analyserade`}
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
            <div style={{ fontSize: 13 }}>Letar efter saknade perioder, outliers och luckor...</div>
          </div>
        )}

        {/* ── SUMMARY CARDS ── */}
        {!loading && visible.length > 0 && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
            marginBottom: 20,
          }}>
            <div style={{
              padding: "14px 16px", borderRadius: 10,
              background: critCount > 0 ? "rgba(239,68,68,0.05)" : "var(--bg-elevated)",
              border: `0.5px solid ${critCount > 0 ? "rgba(239,68,68,0.18)" : "var(--border)"}`,
            }}>
              <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
                Kritiska
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: critCount > 0 ? "#ef4444" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                {critCount}
              </div>
            </div>
            <div style={{
              padding: "14px 16px", borderRadius: 10,
              background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
            }}>
              <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
                Varningar
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: warnCount > 0 ? "#f59e0b" : "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                {warnCount}
              </div>
            </div>
            <div style={{
              padding: "14px 16px", borderRadius: 10,
              background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
            }}>
              <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
                Analyserade
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                {totalFound}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>potentiella problem</div>
            </div>
          </div>
        )}

        {/* ── AI SUMMARY ── */}
        {!loading && summary && (
          <div style={{
            padding: "10px 14px", borderRadius: 8, marginBottom: 20,
            background: "rgba(108,99,255,0.04)", border: "0.5px solid rgba(108,99,255,0.12)",
            fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
          }}>
            <span style={{ color: "#9b94ff", fontWeight: 600, marginRight: 6 }}>✦</span>
            {summary}
          </div>
        )}

        {/* ── ALL CLEAR ── */}
        {!loading && visible.length === 0 && !error && (
          <div style={{
            textAlign: "center", padding: "60px 20px", color: "var(--text-faint)",
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 4 }}>
              Bokföringen ser bra ut
            </div>
            <div style={{ fontSize: 12 }}>
              AI hittade inga datakvalitetsproblem som kräver åtgärd.
            </div>
          </div>
        )}

        {/* ── CHECKS ── */}
        {!loading && visible.map((check, i) => (
          <CheckCard
            key={`${check.type}-${check.account}-${i}`}
            check={check}
            onDismiss={() => setDismissed(prev => new Set([...prev, i]))}
          />
        ))}

        {/* ── TRANSPARENCY ── */}
        {!loading && totalFound > 0 && (
          <div style={{
            marginTop: 24, padding: "12px 16px", borderRadius: 8,
            background: "var(--bg-surface)", border: "0.5px solid var(--border-mid)",
            fontSize: 11, color: "var(--text-faint)", lineHeight: 1.7,
          }}>
            <span style={{ fontWeight: 600 }}>Så här fungerar det: </span>
            Systemet scannar alla konton och perioder efter saknade data, outliers, inaktiva konton,
            budget utan utfall och tomma perioder. {totalFound} potentiella problem hittades.
            AI bedömde {visible.length + dismissed.size} som väsentliga.
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
