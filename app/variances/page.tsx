"use client";

import { useState, useCallback } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";
import { useTeam } from "@/lib/useTeam";
import { supabase } from "@/lib/supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

function clean(v: any): string {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "nan") return "—";
  return s;
}
function cleanNum(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function fmt(n: number | null): string {
  if (n === null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MSEK`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)} tkr`;
  return `${Math.round(n)}`;
}
function initials(name: string) {
  return (name || "?").split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

type Row = {
  id:          string;
  konto:       string;
  category:    string;
  description: string;
  actual:      number | null;
  budget:      number | null;
  impact:      number | null;
  impactPct:   number | null;
  status:      "Att hantera" | "Utredd" | "Godkänd" | "Skickad";
  owner_id:    string | null;
  ai_summary:  string | null;
};

function StatusBadge({ status }: { status: Row["status"] }) {
  const cls = status === "Att hantera" ? "badge badge-amber"
    : status === "Godkänd" ? "badge badge-green"
    : status === "Skickad" ? "badge badge-blue"
    : "badge badge-gray";
  return <span className={cls}><span className="badge-dot"/>{status}</span>;
}

function ImpactCell({ impact, pct }: { impact: number | null; pct: number | null }) {
  if (impact === null) return <span className="impact-neu">—</span>;
  const pos = impact >= 0;
  const barW = Math.min(Math.abs(pct ?? 0) * 400, 100);
  return (
    <div className="var-impact-wrap">
      <div className="var-impact-bar-track">
        <div className="var-impact-bar-fill"
          style={{ width: `${barW}%`, background: pos ? "#22c55e" : "#ef4444" }}/>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className={pos ? "impact-pos" : "impact-neg"}>
          {pos ? "+ " : "− "}{fmt(Math.abs(impact))}
        </span>
        {pct !== null && (
          <span style={{ fontSize: 10, color: pos ? "#22c55e" : "#ef4444", opacity: .65 }}>
            {pct >= 0 ? "+" : ""}{Math.round(pct * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ── Schedule button ───────────────────────────────────────────────
function ScheduleButton({ row, company, me }: { row: Row; company: any; me: any }) {
  const [open,   setOpen]   = useState(false);
  const [date,   setDate]   = useState("");
  const [note,   setNote]   = useState("");
  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState(false);

  async function save() {
    if (!date || !company?.id || !me?.id) return;
    setSaving(true);
    await supabase.from("calendar_items").insert({
      company_id:      company.id,
      variance_label:  row.description,
      variance_konto:  row.konto,
      variance_impact: row.impact,
      follow_up_date:  date,
      note:            note || null,
      status:          "Planerad",
      created_by:      me.id,
    });
    setSaving(false); setDone(true);
    setTimeout(() => { setDone(false); setOpen(false); }, 1500);
  }

  if (done) return <button className="var-action-secondary" disabled>✓ Schemalagd!</button>;
  return (
    <>
      <button className="var-action-secondary" onClick={() => setOpen(!open)}>
        Schemalägg uppföljning
      </button>
      {open && (
        <div className="var-schedule-panel">
          <div style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 6 }}>Välj datum</div>
          <input type="date" className="settings-input" value={date}
            onChange={e => setDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}/>
          <input className="settings-input" placeholder="Notering (valfritt)"
            value={note} onChange={e => setNote(e.target.value)} style={{ marginTop: 6 }}/>
          <button className="var-action-primary" onClick={save} disabled={!date || saving}
            style={{ marginTop: 8 }}>
            {saving ? "Sparar..." : "Spara uppföljning"}
          </button>
        </div>
      )}
    </>
  );
}

// ── More info panel ───────────────────────────────────────────────
function MoreInfoPanel({
  row, members, me, company, pack, onStatusChange, onAssign, onAddToReport, onClose,
}: {
  row: Row;
  members: any[];
  me: any;
  company: any;
  pack: any;
  onStatusChange: (status: Row["status"]) => void;
  onAssign: (uid: string) => void;
  onAddToReport: () => void;
  onClose: () => void;
}) {
  const [aiSummary, setAiSummary] = useState(row.ai_summary || "");
  const [aiLoading, setAiLoading] = useState(false);
  const [done,      setDone]      = useState(false);

  async function fetchAI() {
    setAiLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: `Analysera denna avvikelse kort och konkret på svenska (max 3 meningar): Konto ${row.konto} "${row.description}", utfall ${fmt(row.actual)}, budget ${fmt(row.budget)}, avvikelse ${fmt(row.impact)} (${row.impactPct !== null ? Math.round(row.impactPct*100) : "?"}%). Vad kan orsaken vara och vad bör controllern göra?`,
          pack: pack || {},
        }),
      });
      const data = await res.json();
      setAiSummary(data.answer || "");
    } catch {
      setAiSummary("Kunde inte hämta AI-analys.");
    } finally {
      setAiLoading(false);
    }
  }

  const owner = members.find((m) => m.id === row.owner_id);

  return (
    <tr className="var-info-row">
      <td colSpan={9}>
        <div className="var-info-panel">
          {/* Header */}
          <div className="var-info-header">
            <div>
              <div className="var-info-konto">{row.konto !== "—" ? row.konto : ""}</div>
              <div className="var-info-title">{row.description}</div>
            </div>
            <button className="var-info-close" onClick={onClose}>✕</button>
          </div>

          <div className="var-info-body">
            {/* Left: KPIs */}
            <div className="var-info-kpis">
              {[
                { label: "Utfall",    val: fmt(row.actual) },
                { label: "Budget",    val: fmt(row.budget) },
                { label: "Avvikelse", val: fmt(row.impact), color: (row.impact ?? 0) >= 0 ? "#22c55e" : "#ef4444" },
                { label: "Avv %",     val: row.impactPct !== null ? `${Math.round(row.impactPct*100)}%` : "—",
                  color: (row.impactPct ?? 0) >= 0 ? "#22c55e" : "#ef4444" },
              ].map((k) => (
                <div key={k.label} className="var-info-kpi">
                  <div className="var-info-kpi-label">{k.label}</div>
                  <div className="var-info-kpi-val" style={{ color: k.color }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* AI summary */}
            <div className="var-info-ai">
              <div className="var-info-ai-header">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z" fill="#9b94ff"/>
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>AI-analys</span>
                </div>
                {!aiSummary && (
                  <button className="var-ai-btn" onClick={fetchAI} disabled={aiLoading}>
                    {aiLoading ? "Analyserar..." : "Analysera"}
                  </button>
                )}
              </div>
              {aiSummary ? (
                <div className="var-info-ai-text">{aiSummary}</div>
              ) : (
                <div className="var-info-ai-empty">
                  Klicka "Analysera" för att få en AI-genererad insikt om denna avvikelse.
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="var-info-actions">
              <div className="var-info-section-label">Status</div>
              <div className="var-info-status-btns">
                {(["Att hantera", "Utredd", "Godkänd"] as const).map((s) => (
                  <button key={s}
                    className={`var-status-btn${row.status === s ? " active" : ""}`}
                    onClick={() => onStatusChange(s)}>
                    {s}
                  </button>
                ))}
              </div>

              <div className="var-info-section-label" style={{ marginTop: 12 }}>Tilldela</div>
              <div className="var-info-team-list">
                {members.map((m) => (
                  <button key={m.id}
                    className={`var-member-btn${row.owner_id === m.id ? " active" : ""}`}
                    onClick={() => onAssign(m.id)}>
                    <div className="var-member-av">{initials(m.full_name || "?")}</div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-primary)" }}>
                        {m.full_name}{m.id === me?.id ? " (du)" : ""}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{m.role}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
                <button className="var-action-primary" onClick={onAddToReport}>
                  + Lägg till i rapport
                </button>
                <button className="var-action-secondary"
                  onClick={() => { onStatusChange("Godkänd"); onClose(); }}>
                  Markera som klar
                </button>
                <button className="var-action-secondary"
                  onClick={() => { onStatusChange("Skickad"); onClose(); }}>
                  Skicka vidare
                </button>
                <ScheduleButton row={row} company={company} me={me} />
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function VariancesPage() {
  const pack        = getPack();
  const reportItems = getReportItems();
  const { me, members, company } = useTeam();

  const [filter,   setFilter]   = useState("Alla");
  const [search,   setSearch]   = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [rows,     setRows]     = useState<Row[]>(() => {
    if (!pack) return [];
    const budget = (pack.top_budget || []).map((x: any, i: number) => ({
      id:          `b-${i}`,
      konto:       clean(x.Konto),
      category:    clean(x.Label || x.Konto),
      description: clean(x.Label || x.Konto),
      actual:      cleanNum(x.Utfall),
      budget:      cleanNum(x.Budget),
      impact:      cleanNum(x["Vs budget diff"] ?? x.variance),
      impactPct:   cleanNum(x["Vs budget %"]),
      status:      "Att hantera" as const,
      owner_id:    null,
      ai_summary:  null,
    }));
    const mom = (pack.top_mom || []).map((x: any, i: number) => ({
      id:          `m-${i}`,
      konto:       clean(x.Konto),
      category:    clean(x.Label || x.Konto),
      description: clean(x.Label || x.Konto),
      actual:      cleanNum(x.Utfall),
      budget:      cleanNum(x.Budget),
      impact:      cleanNum(x["MoM diff"] ?? x["Vs budget diff"]),
      impactPct:   cleanNum(x["MoM %"] ?? x["Vs budget %"]),
      status:      "Utredd" as const,
      owner_id:    null,
      ai_summary:  null,
    }));
    return [...budget, ...mom];
  });

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header reportCount={0} />
        <div className="ns-page">
          <div className="ns-hero-title">Hantera avvikelser</div>
          <div className="ns-hero-sub" style={{ marginTop: 6 }}>
            Ingen analys laddad — gå till Connect först.
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }

  async function saveToSupabase(id: string, patch: Partial<Row>) {
    if (!company?.id) return;
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    await supabase.from("variance_items").upsert({
      company_id:  company.id,
      konto:       row.konto,
      label:       row.description,
      period:      pack.current_period,
      actual:      row.actual,
      budget:      row.budget,
      impact:      row.impact,
      impact_pct:  row.impactPct,
      ...patch,
    }, { onConflict: "company_id,konto,period" });
  }

  function handleStatusChange(id: string, status: Row["status"]) {
    updateRow(id, { status });
    saveToSupabase(id, { status } as any);
  }

  function handleAssign(id: string, owner_id: string) {
    updateRow(id, { owner_id });
    saveToSupabase(id, { owner_id } as any);
  }

  function handleAddToReport(row: Row) {
    const items = JSON.parse(localStorage.getItem("nordsheet_report_items") || "[]");
    items.push({
      id: row.id, title: row.description,
      text: `Avvikelse: ${fmt(row.impact)} | Utfall: ${fmt(row.actual)} | Budget: ${fmt(row.budget)}`,
      severity: (row.impact ?? 0) < 0 ? "high" : "low",
    });
    localStorage.setItem("nordsheet_report_items", JSON.stringify(items));
    alert("Tillagd i rapport!");
  }

  // Bulk actions
  function bulkSetStatus(status: Row["status"]) {
    selected.forEach((i) => {
      const row = visible[i];
      if (row) { updateRow(row.id, { status }); saveToSupabase(row.id, { status } as any); }
    });
    setSelected(new Set());
  }

  function bulkAssign(uid: string) {
    selected.forEach((i) => {
      const row = visible[i];
      if (row) { updateRow(row.id, { owner_id: uid }); saveToSupabase(row.id, { owner_id: uid } as any); }
    });
    setSelected(new Set());
  }

  const [assignOpen, setAssignOpen] = useState(false);

  let visible = rows;
  if (filter === "Att hantera") visible = rows.filter((r) => r.status === "Att hantera");
  if (filter === "Positiva")    visible = rows.filter((r) => (r.impact ?? 0) > 0);
  if (filter === "Störst")      visible = [...rows].sort((a, b) => Math.abs(b.impact ?? 0) - Math.abs(a.impact ?? 0));
  if (search) visible = visible.filter((r) =>
    r.description.toLowerCase().includes(search.toLowerCase()) ||
    r.konto.toLowerCase().includes(search.toLowerCase())
  );

  const negCount    = rows.filter((r) => (r.impact ?? 0) < 0).length;
  const posCount    = rows.filter((r) => (r.impact ?? 0) > 0).length;
  const totalImpact = rows.reduce((s, r) => s + (r.impact ?? 0), 0);

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <div className="ns-page">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <div className="ns-hero-title">Hantera avvikelser</div>
            <div className="ns-hero-sub" style={{ marginTop: 3 }}>
              {rows.length} avvikelser · Period {pack.current_period}
            </div>
          </div>
        </div>

        {/* Summary pills */}
        <div className="var-summary-row">
          <div className="var-summary-pill var-pill-neg">
            <span className="var-pill-num">{negCount}</span>
            <span className="var-pill-label">Negativa</span>
          </div>
          <div className="var-summary-pill var-pill-pos">
            <span className="var-pill-num">{posCount}</span>
            <span className="var-pill-label">Positiva</span>
          </div>
          <div className={`var-summary-pill ${totalImpact >= 0 ? "var-pill-pos" : "var-pill-neg"}`}>
            <span className="var-pill-num">{totalImpact >= 0 ? "+" : ""}{fmt(totalImpact)}</span>
            <span className="var-pill-label">Total avvikelse</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="ns-toolbar">
          {["Alla","Att hantera","Störst","Positiva"].map((f) => (
            <button key={f}
              className={`ns-toolbar-btn${filter === f ? " active" : ""}`}
              onClick={() => setFilter(f)}>{f}
            </button>
          ))}
          <div className="ns-search-wrap">
            <span className="ns-search-icon" style={{ fontSize: 13 }}>⌕</span>
            <input className="ns-search" placeholder="Sök konto eller beskrivning..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Table */}
        <div className="ns-table-card">
          <div className="ns-table-head">
            <div className="ns-table-icon">≡</div>
            <span className="ns-table-title">{visible.length} avvikelser</span>
            <span className="ns-table-badge">{filter === "Alla" ? "att hantera" : filter.toLowerCase()}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}/>
                <th>Status</th>
                <th>Konto</th>
                <th>Beskrivning</th>
                <th style={{ textAlign: "right" }}>Utfall</th>
                <th style={{ textAlign: "right" }}>Budget</th>
                <th>Avvikelse</th>
                <th>Ägare</th>
                <th/>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "var(--text-faint)" }}>
                  Inga avvikelser att visa
                </td></tr>
              ) : visible.map((row, i) => {
                const owner = members.find((m) => m.id === row.owner_id);
                return (
                  <>
                    <tr key={row.id}
                      className={selected.has(i) ? "row-selected" : ""}
                      style={{ cursor: "pointer" }}
                      onClick={() => setExpanded(expanded === i ? null : i)}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="row-cb"
                          checked={selected.has(i)}
                          onChange={() => {
                            setSelected((prev) => {
                              const n = new Set(prev);
                              n.has(i) ? n.delete(i) : n.add(i);
                              return n;
                            });
                          }}/>
                      </td>
                      <td><StatusBadge status={row.status}/></td>
                      <td>
                        <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "monospace" }}>
                          {row.konto !== "—" ? row.konto : ""}
                        </span>
                      </td>
                      <td style={{ maxWidth: 220, fontSize: 13, color: "var(--text-primary)" }}>
                        {row.description}
                      </td>
                      <td style={{ textAlign: "right", fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                        {fmt(row.actual)}
                      </td>
                      <td style={{ textAlign: "right", fontSize: 12, color: "var(--text-faint)", fontVariantNumeric: "tabular-nums" }}>
                        {fmt(row.budget)}
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <ImpactCell impact={row.impact} pct={row.impactPct}/>
                      </td>
                      <td>
                        {owner ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div className="var-member-av" style={{ width: 22, height: 22, fontSize: 9 }}>
                              {initials(owner.full_name || "?")}
                            </div>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                              {owner.full_name.split(" ")[0]}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Okänd</span>
                        )}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button className="action-btn"
                          onClick={() => setExpanded(expanded === i ? null : i)}>
                          {expanded === i ? "Stäng" : "Mer info"}
                        </button>
                      </td>
                    </tr>
                    {expanded === i && (
                      <MoreInfoPanel
                        row={row}
                        members={members}
                        me={me}
                        company={company}
                        pack={pack}
                        onStatusChange={(s) => handleStatusChange(row.id, s)}
                        onAssign={(uid) => handleAssign(row.id, uid)}
                        onAddToReport={() => handleAddToReport(row)}
                        onClose={() => setExpanded(null)}
                      />
                    )}
                  </>
                );
              })}
            </tbody>
          </table>

          {/* Footer */}
          <div className="ns-table-footer">
            <div className="ns-table-footer-left">
              <input type="checkbox" className="row-cb"
                checked={selected.size > 0}
                onChange={() => setSelected(new Set())}/>
              {selected.size > 0 ? `${selected.size} markerade` : "Välj rader"}
            </div>
            <div className="ns-table-footer-right">
              <button className="fbtn" onClick={() => bulkSetStatus("Utredd")}
                disabled={selected.size === 0}>Markera åtgärd</button>

              <div style={{ position: "relative" }}>
                <button className="fbtn" disabled={selected.size === 0}
                  onClick={() => setAssignOpen(!assignOpen)}>
                  Tilldela ▾
                </button>
                {assignOpen && selected.size > 0 && (
                  <div className="var-assign-dropdown">
                    {members.map((m) => (
                      <button key={m.id} className="var-assign-option"
                        onClick={() => { bulkAssign(m.id); setAssignOpen(false); }}>
                        <div className="var-member-av" style={{ width: 22, height: 22, fontSize: 9 }}>
                          {initials(m.full_name || "?")}
                        </div>
                        <div>
                          <div style={{ fontSize: 12 }}>{m.full_name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{m.role}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button className="fbtn" onClick={() => bulkSetStatus("Godkänd")}
                disabled={selected.size === 0}>Godkänn</button>
              <button className="fbtn fbtn-primary" onClick={() => bulkSetStatus("Skickad")}
                disabled={selected.size === 0}>Skicka</button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
