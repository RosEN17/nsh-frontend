"use client";

import { useState } from "react";
import { downloadExport } from "@/lib/api";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";

// ── Report types ──────────────────────────────────────────────────
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
    bullets: ["Helårsresultat", "Kassaflöde", "YoY-jämförelse", "Styrelsekommentar", "Rekommendationer"],
  },
  {
    id: "forecast",
    label: "Prognos / Forecast",
    sub: "Helår eller rullande 12M",
    bullets: ["Run-rate & trend", "3 scenarier", "Månadsfördelning", "Känslighetsanalys", "Rekommendationer"],
  },
  {
    id: "kpi_dashboard",
    label: "KPI-/nyckeltalsrapport",
    sub: "Dashboard med nyckeltal",
    bullets: ["Top-5 KPI:er", "Trendindikator", "Budget-gap", "Avvikelseranking", "AI-kommentar"],
  },
] as const;

const toneOptions  = ["Professionell", "Enkel", "Analytisk"];
const langOptions  = ["Svenska", "English", "Norsk"];

// ── Chat message ──────────────────────────────────────────────────
type Msg = { role: "user" | "ai"; text: string };

export default function ExportPage() {
  const pack        = getPack();
  const reportItems = getReportItems();

  const [selectedType, setSelectedType] = useState("income_statement");
  const [format,       setFormat]       = useState<"pptx" | "docx">("pptx");
  const [tone,         setTone]         = useState("Professionell");
  const [lang,         setLang]         = useState("Svenska");
  const [detail,       setDetail]       = useState(50);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [chatOpen,     setChatOpen]     = useState(true);
  const [messages,     setMessages]     = useState<Msg[]>([
    {
      role: "ai",
      text: "Hej! Lägg till eventuella kommentarer eller detaljer du vill inkludera i rapporten här, så ser jag till att övriga skuggiga dokument skräddarsys efter dina behov.",
    },
  ]);
  const [input, setInput] = useState("");

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header reportCount={0} />
        <div className="ns-page">
          <div className="ns-hero-title">Export</div>
          <div className="ns-hero-sub" style={{ marginTop: 6 }}>
            Ingen analys laddad — gå till Connect först.
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
            title:       "NordSheet Export",
            report_type: selectedType,
            tone:        tone.toLowerCase(),
            language:    lang.toLowerCase(),
            detail:      detail,
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
      { role: "ai",   text: "Noterat — jag inkluderar det i rapporten." },
    ]);
    setInput("");
  }

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <div className="ns-page export-page">

        {/* ── Main content ── */}
        <div className={`export-main${chatOpen ? " chat-open" : ""}`}>
          <div className="ns-hero-title">Export</div>
          <div className="ns-hero-sub" style={{ marginTop: 3, marginBottom: 20 }}>
            Välj rapporttyp, anpassa och generera
          </div>

          {error && <div className="ns-error-banner" style={{ marginBottom: 14 }}>{error}</div>}

          {/* Report type cards */}
          <div className="export-section-label">Exportera rapport</div>
          <div className="export-type-grid">
            {reportTypes.map((rt) => (
              <button
                key={rt.id}
                className={`export-type-card${selectedType === rt.id ? " active" : ""}`}
                onClick={() => setSelectedType(rt.id)}
              >
                <div className="export-type-icon">{rt.icon}</div>
                <div className="export-type-label">{rt.label}</div>
                {rt.sub && <div className="export-type-sub">{rt.sub}</div>}
              </button>
            ))}
          </div>

          {/* Settings */}
          <div className="export-section-label" style={{ marginTop: 28 }}>Inställningar</div>
          <div className="export-settings-grid">
            {/* Format */}
            <div className="export-setting-group">
              <div className="export-setting-label">Format</div>
              <div className="export-radio-row">
                {(["pptx", "docx"] as const).map((f) => (
                  <label key={f} className="export-radio">
                    <input
                      type="radio"
                      name="format"
                      checked={format === f}
                      onChange={() => setFormat(f)}
                    />
                    <span className="export-radio-dot" />
                    {f === "pptx" ? "PowerPoint" : "Google Docs"}
                  </label>
                ))}
              </div>
            </div>

            {/* Ton */}
            <div className="export-setting-group">
              <div className="export-setting-label">Ton</div>
              <div className="export-radio-row">
                {toneOptions.map((t) => (
                  <label key={t} className="export-radio">
                    <input
                      type="radio"
                      name="tone"
                      checked={tone === t}
                      onChange={() => setTone(t)}
                    />
                    <span className="export-radio-dot" />
                    {t}
                  </label>
                ))}
              </div>
            </div>

            {/* Språk */}
            <div className="export-setting-group">
              <div className="export-setting-label">Lang</div>
              <div className="export-select-wrap">
                <select
                  className="export-select"
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                >
                  {langOptions.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Detaljnivå */}
            <div className="export-setting-group">
              <div className="export-setting-label">Detaljnivå</div>
              <div className="export-slider-row">
                <span className="export-slider-label">Kort</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={detail}
                  onChange={(e) => setDetail(Number(e.target.value))}
                  className="export-slider"
                />
                <span className="export-slider-label">Djup analys</span>
              </div>
            </div>
          </div>

          {/* Export button */}
          <button
            className="export-btn"
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? "Genererar..." : "Generera & Exportera"}
          </button>
        </div>

        {/* ── AI Chat panel ── */}
        {chatOpen && (
          <div className="export-chat">
            <div className="export-chat-head">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="export-chat-icon">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
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
              {["Fokusera på kostnadshings", "Förklara avvikelser enkelt", "Gör den redo för styrelsemöte"].map((s) => (
                <button key={s} className="export-chat-suggestion" onClick={() => setInput(s)}>
                  {s}
                </button>
              ))}
            </div>

            <div className="export-chat-input-wrap">
              <input
                className="export-chat-input"
                placeholder="Lägg till kommentarer eller vad rapporten ska fokusera på..."
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
