"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getUserQuotes, QuoteRecord, updateOutcome } from "@/lib/quotes";
import { getEstimates, deleteEstimate, renameEstimate, SavedEstimate } from "@/lib/store";

function fmtKr(n: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "decimal", maximumFractionDigits: 0 }).format(n) + " kr";
}

type Tab = "draft" | "sent" | "accepted";

// ── Outcome-knappar ───────────────────────────────────────────────────────────
function OutcomeButtons({
  quote,
  onUpdated,
}: {
  quote: QuoteRecord;
  onUpdated: (id: string, outcome: "won" | "lost", lostReason?: string) => void;
}) {
  const [saving, setSaving]               = useState(false);
  const [showLostInput, setShowLostInput] = useState(false);
  const [showPriceInput, setShowPriceInput] = useState(false);
  const [lostReason, setLostReason]       = useState(quote.lost_reason || "");
  const [actualPrice, setActualPrice]     = useState("");
  const current = quote.outcome;

  const diffPct = actualPrice
    ? Math.round(Math.abs(parseFloat(actualPrice) - quote.total_inc_vat) / quote.total_inc_vat * 100)
    : null;

  async function handleWon() {
    if (!showPriceInput) {
      setShowLostInput(false);
      setShowPriceInput(true);
      return;
    }
    setSaving(true);
    const { success } = await updateOutcome(quote.id, "won");
    if (success) {
      if (actualPrice.trim()) {
        try {
          const { data } = await (await import("@/lib/supabase")).supabase.auth.getSession();
          const token = data.session?.access_token || "";
          const API = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";
          await fetch(`${API}/api/quotes/${quote.id}/outcome`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              quote_id: quote.id,
              outcome: "won",
              actual_final_price: parseFloat(actualPrice),
            }),
          });
        } catch {}
      }
      onUpdated(quote.id, "won");
    }
    setShowPriceInput(false);
    setSaving(false);
  }

  async function handleLost() {
    if (!showLostInput) {
      setShowPriceInput(false);
      setShowLostInput(true);
      return;
    }
    setSaving(true);
    const { success } = await updateOutcome(quote.id, "lost", lostReason.trim() || undefined);
    if (success) onUpdated(quote.id, "lost", lostReason.trim() || undefined);
    setShowLostInput(false);
    setSaving(false);
  }

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}
    >
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {/* Vann-knapp */}
        <button
          onClick={handleWon}
          disabled={saving}
          style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            cursor: saving ? "default" : "pointer", border: "0.5px solid",
            borderColor:  current === "won" ? "rgba(34,197,94,0.6)"  : showPriceInput ? "rgba(34,197,94,0.5)" : "var(--border-strong)",
            background:   current === "won" ? "rgba(34,197,94,0.15)" : showPriceInput ? "rgba(34,197,94,0.08)" : "transparent",
            color:        current === "won" || showPriceInput ? "#22c55e" : "var(--text-faint)",
            transition:   "all 0.1s",
          }}
        >
          {current === "won" ? "✓ Vann" : showPriceInput ? "Spara →" : "Vann"}
        </button>

        {/* Förlorade-knapp */}
        <button
          onClick={handleLost}
          disabled={saving}
          style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            cursor: saving ? "default" : "pointer", border: "0.5px solid",
            borderColor:  current === "lost" ? "rgba(239,68,68,0.6)"  : showLostInput ? "rgba(239,68,68,0.5)" : "var(--border-strong)",
            background:   current === "lost" ? "rgba(239,68,68,0.12)" : showLostInput ? "rgba(239,68,68,0.08)" : "transparent",
            color:        current === "lost" || showLostInput ? "#f87171" : "var(--text-faint)",
            transition:   "all 0.1s",
          }}
        >
          {current === "lost" ? "✗ Förlorade" : showLostInput ? "Spara orsak →" : "Förlorade"}
        </button>
      </div>

      {/* Prisinput — visas när snickaren klickar Vann */}
      {showPriceInput && current !== "won" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              className="input"
              autoFocus
              type="number"
              value={actualPrice}
              onChange={e => setActualPrice(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") handleWon();
                if (e.key === "Escape") setShowPriceInput(false);
              }}
              placeholder={`Faktiskt slutpris (AI: ${Math.round(quote.total_inc_vat).toLocaleString("sv-SE")} kr)`}
              style={{ fontSize: 12, padding: "5px 10px", flex: 1 }}
            />
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>kr</span>
            <button
              onClick={() => setShowPriceInput(false)}
              style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}
            >✕</button>
          </div>
          {diffPct !== null && actualPrice && (
            <div style={{
              fontSize: 11, padding: "4px 8px", borderRadius: "var(--radius)",
              background: diffPct <= 5 ? "rgba(34,197,94,0.08)" : diffPct <= 15 ? "rgba(234,179,8,0.08)" : "rgba(239,68,68,0.08)",
              color: diffPct <= 5 ? "#22c55e" : diffPct <= 15 ? "#a16207" : "#f87171",
              textAlign: "right",
            }}>
              {diffPct <= 5
                ? `Träffsäkerhet: ${100 - diffPct}% — utmärkt`
                : `Avvikelse: ${diffPct}% — AI:n lär sig`}
            </div>
          )}
          <div style={{ fontSize: 10, color: "var(--text-faint)", textAlign: "right" }}>
            Tryck Enter för att spara · Esc för att avbryta
          </div>
        </div>
      )}

      {/* Fritext för förlorandeorsak */}
      {showLostInput && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", width: "100%" }}>
          <input
            className="input"
            autoFocus
            value={lostReason}
            onChange={e => setLostReason(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") handleLost();
              if (e.key === "Escape") setShowLostInput(false);
            }}
            placeholder="Varför? (valfritt — t.ex. för dyr, valde annan firma)"
            style={{ fontSize: 12, padding: "5px 10px", flex: 1 }}
          />
          <button
            onClick={() => setShowLostInput(false)}
            style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}
          >✕</button>
        </div>
      )}

      {/* Visa befintlig orsak om offerten redan är förlorad */}
      {current === "lost" && quote.lost_reason && (
        <div style={{ fontSize: 11, color: "var(--text-faint)", fontStyle: "italic", maxWidth: 220, textAlign: "right" }}>
          {quote.lost_reason}
        </div>
      )}
    </div>
  );
}

// ── Offertvisningsmodal ───────────────────────────────────────────────────────
function QuoteViewModal({ quote, onClose }: { quote: QuoteRecord; onClose: () => void }) {
  const t      = quote.quote_data?.totals || {};
  const result = quote.quote_data || {};

  function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("sv-SE");
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "32px 16px" }}>
      <div style={{ background: "var(--bg-elevated)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", width: 720, maxWidth: "100%", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "0.5px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{quote.title}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Skapad {fmtDate(quote.created_at)}
              {quote.customer_name && ` · ${quote.customer_name}`}
              {quote.customer_email && ` · ${quote.customer_email}`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {statusBadge(quote.status, quote.outcome)}
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "4px 8px" }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", maxHeight: "70vh", overflowY: "auto" }}>
          {result.job_summary && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, padding: "12px 16px", background: "var(--bg-surface)", borderRadius: "var(--radius)", borderLeft: "3px solid var(--accent)" }}>
              {result.job_summary}
            </div>
          )}

          {(result.categories || []).length > 0 && (
            <div style={{ marginBottom: 20, border: "0.5px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--bg-surface)" }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Post</th>
                    <th style={{ padding: "10px 12px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Enhet</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Antal</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>À-pris</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", color: "var(--text-muted)", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Summa</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.categories || []).map((cat: any, ci: number) => (
                    <>
                      <tr key={`cat-${ci}`} style={{ background: "rgba(106,129,147,0.07)" }}>
                        <td colSpan={5} style={{ padding: "8px 12px", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--text-secondary)", borderBottom: "0.5px solid var(--border)" }}>{cat.name}</td>
                      </tr>
                      {(cat.rows || []).map((row: any, ri: number) => (
                        <tr key={`row-${ci}-${ri}`} style={{ borderBottom: "0.5px solid var(--border-faint)" }}>
                          <td style={{ padding: "8px 12px", color: "var(--text-primary)" }}>
                            {row.description}
                            {row.note && <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 1 }}>{row.note}</div>}
                          </td>
                          <td style={{ padding: "8px 12px", color: "var(--text-faint)", textAlign: "center" }}>{row.unit}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--mono)", color: "var(--text-secondary)" }}>{row.quantity}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--mono)", color: "var(--text-secondary)" }}>{fmtKr(row.unit_price)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 600, color: "var(--text-primary)" }}>{fmtKr(row.total)}</td>
                        </tr>
                      ))}
                      <tr key={`sub-${ci}`} style={{ background: "var(--bg-surface)", borderBottom: "0.5px solid var(--border)" }}>
                        <td colSpan={4} style={{ padding: "8px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Delsumma {cat.name}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "var(--mono)", fontWeight: 700, color: "var(--text-primary)" }}>{fmtKr(cat.subtotal)}</td>
                      </tr>
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ maxWidth: 320, marginLeft: "auto", fontSize: 13 }}>
            {[
              { label: "Material",                                      val: t.material_total },
              { label: "Arbete",                                        val: t.labor_total },
              { label: "Utrustning",                                    val: t.equipment_total },
              { label: `Påslag (${result.meta?.margin_pct || 15}%)`,   val: t.margin_amount },
              { label: "Summa exkl. moms",                              val: t.total_ex_vat },
              { label: "Moms (25%)",                                    val: t.vat },
            ].filter(r => r.val).map(r => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "var(--text-muted)" }}>
                <span>{r.label}</span>
                <span style={{ fontFamily: "var(--mono)" }}>{fmtKr(r.val)}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 8px", borderTop: "1px solid var(--border)", marginTop: 8, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              <span>Totalt inkl. moms</span>
              <span style={{ fontFamily: "var(--mono)" }}>{fmtKr(t.total_inc_vat || 0)}</span>
            </div>
            {t.rot_deduction > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "var(--green)", fontSize: 12 }}>
                  <span>ROT-avdrag</span>
                  <span style={{ fontFamily: "var(--mono)" }}>−{fmtKr(t.rot_deduction)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 15, fontWeight: 700, color: "var(--green)" }}>
                  <span>Kunden betalar</span>
                  <span style={{ fontFamily: "var(--mono)" }}>{fmtKr(t.customer_pays || t.total_inc_vat || 0)}</span>
                </div>
              </>
            )}
          </div>

          {/* Visa faktiskt slutpris om det finns */}
          {(quote as any).actual_final_price && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(106,129,147,0.06)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span>Faktiskt slutpris</span>
                <span style={{ fontFamily: "var(--mono)", fontWeight: 600, color: "var(--text-primary)" }}>
                  {fmtKr((quote as any).actual_final_price)}
                </span>
              </div>
              {(quote as any).price_accuracy_pct && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ color: "var(--text-faint)" }}>AI:ns träffsäkerhet</span>
                  <span style={{
                    fontWeight: 600,
                    color: (quote as any).price_accuracy_pct >= 95 ? "#22c55e"
                          : (quote as any).price_accuracy_pct >= 85 ? "#a16207"
                          : "#f87171",
                  }}>
                    {(quote as any).price_accuracy_pct}%
                  </span>
                </div>
              )}
            </div>
          )}

          {quote.status === "accepted" && quote.accepted_at && (
            <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.3)", borderRadius: "var(--radius)", fontSize: 12, color: "#22c55e" }}>
              Godkänd av kund den {new Date(quote.accepted_at).toLocaleDateString("sv-SE")}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 24px", borderTop: "0.5px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Stäng</button>
        </div>
      </div>
    </div>
  );
}

// ── Statusbadge ───────────────────────────────────────────────────────────────
function statusBadge(status: string, outcome?: string | null) {
  if (outcome === "won") {
    return (
      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
        Vann
      </span>
    );
  }
  if (outcome === "lost") {
    return (
      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "rgba(239,68,68,0.12)", color: "#f87171" }}>
        Förlorade
      </span>
    );
  }
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    draft:    { bg: "rgba(148,163,184,0.15)", color: "#94a3b8", label: "Utkast" },
    sent:     { bg: "rgba(59,130,246,0.15)",  color: "#60a5fa", label: "Skickad" },
    accepted: { bg: "rgba(34,197,94,0.15)",   color: "#22c55e", label: "Godkänd" },
  };
  const s = styles[status] || styles.draft;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Huvudkomponent ────────────────────────────────────────────────────────────
export default function EstimatesPage() {
  const router = useRouter();
  const [tab, setTab]                       = useState<Tab>("draft");
  const [drafts, setDrafts]                 = useState<SavedEstimate[]>([]);
  const [sentQuotes, setSentQuotes]         = useState<QuoteRecord[]>([]);
  const [acceptedQuotes, setAcceptedQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading]               = useState(true);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [editName, setEditName]             = useState("");
  const [viewingQuote, setViewingQuote]     = useState<QuoteRecord | null>(null);

  useEffect(() => {
    setDrafts(getEstimates());
    getUserQuotes().then((quotes) => {
      setSentQuotes(quotes.filter((q) => q.status === "sent"));
      setAcceptedQuotes(quotes.filter((q) => q.status === "accepted"));
      setLoading(false);
    });
  }, []);

  function handleOutcomeUpdated(id: string, outcome: "won" | "lost", lostReason?: string) {
    setSentQuotes(prev =>
      prev.map(q =>
        q.id === id
          ? { ...q, outcome, lost_reason: lostReason || q.lost_reason || null }
          : q
      )
    );
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Ta bort "${name}"?`)) return;
    deleteEstimate(id);
    setDrafts(getEstimates());
  }

  function handleViewDraft(est: SavedEstimate) {
    router.push("/estimate?view=" + est.id);
  }

  function startRename(est: SavedEstimate) {
    setEditingId(est.id);
    setEditName(est.description);
  }

  function saveRename(id: string) {
    if (editName.trim()) {
      renameEstimate(id, editName.trim());
      setDrafts(getEstimates());
    }
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === "Enter") saveRename(id);
    if (e.key === "Escape") setEditingId(null);
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "draft",    label: "Utkast",   count: drafts.length },
    { id: "sent",     label: "Skickade", count: sentQuotes.length },
    { id: "accepted", label: "Godkända", count: acceptedQuotes.length },
  ];

  const currentList = tab === "draft" ? drafts : tab === "sent" ? sentQuotes : acceptedQuotes;

  return (
    <ProtectedLayout>
      <Header title="Mina offerter" subtitle="Hantera utkast, skickade och godkända offerter" />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-surface)", padding: 4, borderRadius: "var(--radius)" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: "10px 16px", borderRadius: "calc(var(--radius) - 2px)",
              border: "none", cursor: "pointer", fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              background: tab === t.id ? "var(--bg-elevated)" : "transparent",
              color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)",
              transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {t.label}
            <span style={{
              fontSize: 11, padding: "1px 7px", borderRadius: 10,
              background: tab === t.id ? "var(--accent-soft)" : "rgba(148,163,184,0.1)",
              color: tab === t.id ? "var(--accent-text)" : "var(--text-faint)",
              fontWeight: 600,
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Lathund för skickade-fliken */}
      {tab === "sent" && sentQuotes.length > 0 && (
        <div style={{ marginBottom: 12, padding: "8px 14px", background: "rgba(106,129,147,0.06)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--text-faint)" }}>
          Markera varje offert som Vann eller Förlorade när du vet utfallet — det förbättrar AI:ns kalkyler.
        </div>
      )}

      {/* Content */}
      {loading && tab !== "draft" ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          Laddar offerter...
        </div>
      ) : currentList.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">{tab === "draft" ? "📝" : tab === "sent" ? "📤" : "✅"}</div>
            <div className="empty-title">
              {tab === "draft"    && "Inga utkast"}
              {tab === "sent"     && "Inga skickade offerter"}
              {tab === "accepted" && "Inga godkända offerter"}
            </div>
            <div className="empty-desc">
              {tab === "draft"    && "Kalkyler du sparar som utkast visas här."}
              {tab === "sent"     && "Offerter du skickat till kunder visas här."}
              {tab === "accepted" && "Offerter som kunder godkänt visas här."}
            </div>
            <button className="btn btn-primary" onClick={() => router.push("/estimate")}>
              Skapa ny kalkyl
            </button>
          </div>
        </div>
      ) : (
        <div>

          {/* ── UTKAST ── */}
          {tab === "draft" && drafts.map((est) => (
            <div key={est.id} className="est-list-item" style={{ position: "relative" }}>
              <div className="est-list-icon" onClick={() => handleViewDraft(est)} style={{ cursor: "pointer" }}>📐</div>
              <div className="est-list-info" style={{ flex: 1, minWidth: 0 }}>
                {editingId === est.id ? (
                  <input
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => saveRename(est.id)}
                    onKeyDown={(e) => handleKeyDown(e, est.id)}
                    autoFocus
                    style={{ padding: "4px 8px", fontSize: 14, fontWeight: 600 }}
                  />
                ) : (
                  <div className="est-list-title" onClick={() => handleViewDraft(est)} style={{ cursor: "pointer" }}>
                    {est.description}
                  </div>
                )}
                <div className="est-list-meta">
                  {new Date(est.created).toLocaleDateString("sv-SE")}
                  {est.job_type && ` · ${est.job_type}`}
                  {est.supabase_id && <span style={{ color: "var(--accent-text)", marginLeft: 6 }}>☁ Sparat</span>}
                </div>
              </div>
              <div style={{ marginRight: 8 }}>{statusBadge("draft")}</div>
              <div className="est-list-amount" style={{ marginRight: 8 }}>{fmtKr(est.customer_pays)}</div>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => startRename(est)} title="Döp om" style={{ color: "var(--text-faint)", fontSize: 14, padding: "6px 8px" }}>✏️</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(est.id, est.description)} title="Ta bort" style={{ color: "var(--text-faint)", fontSize: 14, padding: "6px 8px" }}>🗑️</button>
              </div>
            </div>
          ))}

          {/* ── SKICKADE — med Vann/Förlorade-knappar ── */}
          {tab === "sent" && sentQuotes.map((q) => (
            <div
              key={q.id}
              className="est-list-item"
              style={{
                cursor: "pointer",
                alignItems: "flex-start",
                paddingTop: 14,
                paddingBottom: 14,
                borderLeft: q.outcome === "won"
                  ? "3px solid rgba(34,197,94,0.5)"
                  : q.outcome === "lost"
                  ? "3px solid rgba(239,68,68,0.4)"
                  : "3px solid transparent",
              }}
              onClick={() => setViewingQuote(q)}
            >
              <div className="est-list-icon" style={{ marginTop: 2 }}>
                {q.outcome === "won" ? "🏆" : q.outcome === "lost" ? "❌" : "📤"}
              </div>

              <div className="est-list-info" style={{ flex: 1, minWidth: 0 }}>
                <div className="est-list-title">{q.title}</div>
                <div className="est-list-meta">
                  {new Date(q.created_at).toLocaleDateString("sv-SE")}
                  {q.customer_name && ` · ${q.customer_name}`}
                  {q.customer_email && ` · ${q.customer_email}`}
                </div>
                {/* Visa träffsäkerhet om faktiskt pris finns */}
                {(q as any).price_accuracy_pct && (
                  <div style={{ fontSize: 11, marginTop: 3, color: (q as any).price_accuracy_pct >= 95 ? "#22c55e" : (q as any).price_accuracy_pct >= 85 ? "#a16207" : "#f87171" }}>
                    AI-träffsäkerhet: {(q as any).price_accuracy_pct}%
                  </div>
                )}
              </div>

              <div
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="est-list-amount">{fmtKr(q.customer_pays || q.total_inc_vat || 0)}</div>
                  {statusBadge("sent", q.outcome)}
                </div>
                <OutcomeButtons quote={q} onUpdated={handleOutcomeUpdated} />
              </div>
            </div>
          ))}

          {/* ── GODKÄNDA ── */}
          {tab === "accepted" && acceptedQuotes.map((q) => (
            <div key={q.id} className="est-list-item" style={{ cursor: "pointer" }} onClick={() => setViewingQuote(q)}>
              <div className="est-list-icon">✅</div>
              <div className="est-list-info" style={{ flex: 1, minWidth: 0 }}>
                <div className="est-list-title">{q.title}</div>
                <div className="est-list-meta">
                  {q.accepted_at && `Godkänd ${new Date(q.accepted_at).toLocaleDateString("sv-SE")}`}
                  {q.customer_name && ` · ${q.customer_name}`}
                  {q.customer_email && ` · ${q.customer_email}`}
                </div>
              </div>
              <div style={{ marginRight: 8 }}>{statusBadge("accepted")}</div>
              <div className="est-list-amount" style={{ marginRight: 8 }}>{fmtKr(q.customer_pays || q.total_inc_vat || 0)}</div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={e => { e.stopPropagation(); setViewingQuote(q); }}
                style={{ fontSize: 12, padding: "5px 12px" }}
              >
                Se offert
              </button>
            </div>
          ))}
        </div>
      )}

      {viewingQuote && (
        <QuoteViewModal
          quote={viewingQuote}
          onClose={() => setViewingQuote(null)}
        />
      )}
    </ProtectedLayout>
  );
}
