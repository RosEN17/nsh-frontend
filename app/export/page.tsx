"use client";

import { useState } from "react";
import { downloadExport } from "@/lib/api";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";

type Msg = { role: "user" | "ai"; text: string };

const REPORT_TYPES = [
  {
    id: "monthly",
    label: "Månadsrapport",
    sub: "Utfall, budget & avvikelser per månad",
    bullets: ["KPI-sammanfattning", "Budget vs utfall", "Avvikelseanalys", "MoM-trend", "Åtgärdspunkter"],
  },
  {
    id: "quarterly",
    label: "Kvartalsrapport",
    sub: "Kvartalsjämförelse & prognos",
    bullets: ["Q-för-Q analys", "Budget vs utfall", "Halvårsprognos", "Riskbedömning", "Strategiska åtgärder"],
  },
  {
    id: "annual",
    label: "Årsbokslut / Årsredovisning",
    sub: "Fullständig årsanalys",
    bullets: ["Helårsresultat", "Balansräkning", "Kassaflöde", "YoY-jämförelse", "Styrelsekommentar"],
  },
  {
    id: "forecast",
    label: "Prognos / Forecast",
    sub: "Helår eller rullande 12M",
    bullets: ["Run-rate & trend", "3 scenarier", "Månadsfördelning", "Känslighetsanalys", "Rekommendationer"],
  },
  {
    id: "kpi_dashboard",
    label: "KPI-rapport",
    sub: "Nyckeltal & dashboard",
    bullets: ["Top-5 KPI:er", "Trendindikator", "Budget-gap", "Avvikelseranking", "AI-kommentar"],
  },
] as const;

type ReportId = (typeof REPORT_TYPES)[number]["id"];

const TONE_OPTIONS = ["Professionell", "Enkel", "Analytisk"] as const;
const LANG_OPTIONS = ["Svenska", "English", "Norsk"] as const;

const ICON_BARS = (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
    <rect x="3" y="5" width="26" height="22" rx="3" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".35"/>
    <path d="M3 11h26" stroke="currentColor" strokeWidth="1.5" opacity=".35"/>
    <rect x="7" y="7" width="2" height="6" rx="1" fill="currentColor" opacity=".4"/>
    <rect x="23" y="7" width="2" height="6" rx="1" fill="currentColor" opacity=".4"/>
    <rect x="7" y="15" width="4" height="8" rx="1" fill="currentColor" opacity=".5"/>
    <rect x="13" y="13" width="4" height="10" rx="1" fill="currentColor" opacity=".75"/>
    <rect x="19" y="16" width="4" height="7" rx="1" fill="currentColor" opacity=".9"/>
    <rect x="25" y="14" width="2" height="9" rx="1" fill="currentColor"/>
  </svg>
);
const ICON_QUARTER = (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
    <rect x="4" y="20" width="5" height="8" rx="1" fill="currentColor" opacity=".4"/>
    <rect x="11" y="14" width="5" height="14" rx="1" fill="currentColor" opacity=".6"/>
    <rect x="18" y="9" width="5" height="19" rx="1" fill="currentColor" opacity=".8"/>
    <rect x="25" y="4" width="3" height="24" rx="1" fill="currentColor"/>
    <path d="M6 19L13 13L20 8L27 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity=".5"/>
  </svg>
);
const ICON_ANNUAL = (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
    <path d="M16 4L4 10v1.5h24V10L16 4z" fill="currentColor" opacity=".35"/>
    <rect x="5" y="13" width="4" height="14" rx="1" fill="currentColor" opacity=".4"/>
    <rect x="11" y="13" width="4" height="14" rx="1" fill="currentColor" opacity=".6"/>
    <rect x="17" y="13" width="4" height="14" rx="1" fill="currentColor" opacity=".8"/>
    <rect x="23" y="13" width="4" height="14" rx="1" fill="currentColor"/>
    <rect x="4" y="27" width="24" height="1.5" rx=".75" fill="currentColor" opacity=".35"/>
  </svg>
);
const ICON_FORECAST = (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
    <path d="M4 25L10 18L16 21L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity=".45"/>
    <path d="M22 12L27 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="3 2"/>
    <circle cx="27" cy="5" r="2.5" fill="currentColor"/>
    <path d="M4 28h24" stroke="currentColor" strokeWidth="1" opacity=".2"/>
  </svg>
);
const ICON_KPI = (
  <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
    <rect x="3" y="3" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".45"/>
    <rect x="18" y="3" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".45"/>
    <rect x="3" y="18" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" opacity=".45"/>
    <rect x="18" y="18" width="11" height="11" rx="2" fill="currentColor" opacity=".12"/>
    <path d="M21 25l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".65"/>
    <rect x="6" y="22" width="5" height="2.5" rx=".5" fill="currentColor" opacity=".45"/>
    <rect x="21" y="7" width="5" height="2.5" rx=".5" fill="currentColor" opacity=".45"/>
  </svg>
);

const ICONS: Record<string, React.ReactNode> = {
  monthly: ICON_BARS,
  quarterly: ICON_QUARTER,
  annual: ICON_ANNUAL,
  forecast: ICON_FORECAST,
  kpi_dashboard: ICON_KPI,
};

const CHAT_SUGGESTIONS: Record<string, string[]> = {
  monthly:      ["Fokusera på kostnadsdrivare", "Lyft fram personalkostand", "Förklara avvikelser enkelt"],
  quarterly:    ["Jämför mot förra kvartalet", "Gör den redo för ledningsgrupp", "Lyft fram riskfaktorer"],
  annual:       ["Gör den redo för styrelseomgång", "Inkludera en VD-kommentar", "Fokusera på helårstrend"],
  forecast:     ["Visa pessimistiskt scenario tydligt", "Inkludera säsongskorrigering", "Fokusera på kassaflöde"],
  kpi_dashboard: ["Markera avvikande KPI:er", "Jämför mot branschsnitt", "Lägg till trendpilar"],
};

export default function ExportPage() {
  const pack        = getPack();
  const reportItems = getReportItems();

  const [selectedType, setSelectedType] = useState<ReportId>("monthly");
  const [format,       setFormat]       = useState<"pptx" | "docx">("pptx");
  const [tone,         setTone]         = useState<string>("Professionell");
  const [lang,         setLang]         = useState<string>("Svenska");
  const [detail,       setDetail]       = useState(60);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [chatOpen,     setChatOpen]     = useState(true);
  const [messages,     setMessages]     = useState<Msg[]>([
    {
      role: "ai",
      text: "Hej! Välj rapporttyp till vänster och berätta gärna vad rapporten ska fokusera på — t.ex. ett specifikt kostnadsställe, en avvikelse eller målgrupp.",
    },
  ]);
  const [input, setInput] = useState("");

  const currentType = REPORT_TYPES.find((r) => r.id === selectedType)!;

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header reportCount={0} />
        <div className="ns-page">
          <div className="ns-hero-title">Export</div>
          <div className="ns-hero-sub" style={{ marginTop: 6 }}>
            Ingen analys laddad — gå till Connect och ladda upp en fil först.
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  async function handleExport() {
    setError("");
    setLoading(true);
    try {
      const context = messages
        .filter((m) => m.role === "user")
        .map((m) => m.text)
        .join(" ");

      await downloadExport(
        {
          fmt: format,
          pack,
          report_items: reportItems,
          spec: {
            title:       currentType.label,
            report_type: selectedType,
            tone:        tone.toLowerCase(),
            language:    lang.toLowerCase(),
            detail,
            context,
          },
          purpose:       "finance_report",
          business_type: "Övrigt",
        },
        `nordsheet_${selectedType}.${format}`
      );
    } catch (e: any) {
      setError(e.message || "Export misslyckades.");
    } finally {
      setLoading(false);
    }
  }

  function sendChat() {
    if (!input.trim()) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", text: input },
      { role: "ai",   text: "Noterat — jag anpassar rapporten efter det." },
    ]);
    setInput("");
  }

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <div className="ns-page export-page">

        {/* ── Main ─────────────────────────────────────────────────── */}
        <div className={`export-main${chatOpen ? " chat-open" : ""}`}>
          <div className="ns-hero-title">Export</div>
          <div className="ns-hero-sub" style={{ marginTop: 3, marginBottom: 24 }}>
            Välj rapporttyp, anpassa och generera
          </div>

          {error && (
            <div className="ns-error-banner" style={{ marginBottom: 14 }}>{error}</div>
          )}

          {/* ── Report type cards ──────────────────────────────────── */}
          <div className="export-section-label">Typ av rapport</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 10,
              marginBottom: 28,
            }}
          >
            {REPORT_TYPES.map((rt) => {
              const isActive = selectedType === rt.id;
              return (
                <button
                  key={rt.id}
                  className={`export-type-card${isActive ? " active" : ""}`}
                  onClick={() => setSelectedType(rt.id)}
                  style={{ alignItems: "flex-start" }}
                >
                  <div className="export-type-icon">{ICONS[rt.id]}</div>
                  <div className="export-type-label">{rt.label}</div>
                  <div className="export-type-sub">{rt.sub}</div>
                </button>
              );
            })}
          </div>

          {/* ── What's included ───────────────────────────────────── */}
          <div
            style={{
              background: "var(--bg-elevated)",
              border: "0.5px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: "14px 18px",
              marginBottom: 24,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {currentType.label} — innehåller
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {currentType.bullets.map((b) => (
                <span
                  key={b}
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: "var(--accent-soft)",
                    color: "var(--accent-text)",
                    border: "0.5px solid var(--accent-border)",
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* ── Settings ──────────────────────────────────────────── */}
          <div className="export-section-label">Inställningar</div>
          <div className="export-settings-grid">

            {/* Format */}
            <div className="export-setting-group">
              <div className="export-setting-label">Format</div>
              <div className="export-radio-row">
                {(["pptx", "docx"] as const).map((f) => (
                  <label key={f} className="export-radio">
                    <input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} />
                    <span className="export-radio-dot" />
                    {f === "pptx" ? "PowerPoint" : "Word / Docs"}
                  </label>
                ))}
              </div>
            </div>

            {/* Ton */}
            <div className="export-setting-group">
              <div className="export-setting-label">Ton</div>
              <div className="export-radio-row">
                {TONE_OPTIONS.map((t) => (
                  <label key={t} className="export-radio">
                    <input type="radio" name="tone" checked={tone === t} onChange={() => setTone(t)} />
                    <span className="export-radio-dot" />
                    {t}
                  </label>
                ))}
              </div>
            </div>

            {/* Språk */}
            <div className="export-setting-group">
              <div className="export-setting-label">Språk</div>
              <div className="export-select-wrap">
                <select className="export-select" value={lang} onChange={(e) => setLang(e.target.value)}>
                  {LANG_OPTIONS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Detaljnivå */}
            <div className="export-setting-group">
              <div className="export-setting-label">Detaljnivå</div>
              <div className="export-slider-row">
                <span className="export-slider-label">Översikt</span>
                <input
                  type="range" min={0} max={100} step={1} value={detail}
                  onChange={(e) => setDetail(Number(e.target.value))}
                  className="export-slider"
                />
                <span className="export-slider-label">Djupanalys</span>
              </div>
            </div>
          </div>

          {/* ── Export button ──────────────────────────────────────── */}
          <button className="export-btn" onClick={handleExport} disabled={loading}>
            {loading ? "Genererar rapport..." : `Generera & Exportera — ${currentType.label}`}
          </button>
        </div>

        {/* ── AI Chat panel ─────────────────────────────────────────── */}
        {chatOpen && (
          <div className="export-chat">
            <div className="export-chat-head">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="export-chat-icon">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z" fill="#9b94ff"/>
                  </svg>
                </div>
                <span className="export-chat-title">AI-Chat</span>
              </div>
              <button className="export-chat-close" onClick={() => setChatOpen(false)}>✕</button>
            </div>

            <div className="export-chat-subhead">Anpassa din rapport</div>

            <div className="export-chat-messages">
              {messages.map((m, i) => (
                <div key={i} className={`export-chat-msg ${m.role}`}>
                  {m.role === "ai" && (
                    <div className="export-chat-msg-icon">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z" fill="#9b94ff"/>
                      </svg>
                    </div>
                  )}
                  <div className="export-chat-msg-text">{m.text}</div>
                </div>
              ))}
            </div>

            <div className="export-chat-suggestions">
              {(CHAT_SUGGESTIONS[selectedType] ?? CHAT_SUGGESTIONS.monthly).map((s) => (
                <button key={s} className="export-chat-suggestion" onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>

            <div className="export-chat-input-wrap">
              <input
                className="export-chat-input"
                placeholder="Vad ska rapporten fokusera på?"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
              />
              <button className="export-chat-send" onClick={sendChat}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8L14 2L10 8L14 14L2 8Z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
