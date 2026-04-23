"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getUserQuotes, QuoteRecord, getQuoteById } from "@/lib/quotes";
import { getEstimates, deleteEstimate, renameEstimate, SavedEstimate } from "@/lib/store";

function fmtKr(n: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "decimal", maximumFractionDigits: 0 }).format(n) + " kr";
}

function fmtKr2(n: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "decimal", maximumFractionDigits: 0 }).format(n) + " kr";
}

type Tab = "draft" | "sent" | "accepted";

// ── Offertvisningsmodal ────────────────────────────────────
function QuoteViewModal({ quote, onClose }: { quote: QuoteRecord; onClose: () => void }) {
  const t = quote.quote_data?.totals || {};
  const result = quote.quote_data || {};
  const settings = quote.settings_data || {};

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
            {statusBadge(quote.status)}
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "4px 8px" }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", maxHeight: "70vh", overflowY: "auto" }}>
          {/* Sammanfattning */}
          {result.job_summary && (
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, padding: "12px 16px", background: "var(--bg-surface)", borderRadius: "var(--radius)", borderLeft: "3px solid var(--accent)" }}>
              {result.job_summary}
            </div>
          )}

          {/* Tabell */}
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

          {/* Summering */}
          <div style={{ maxWidth: 320, marginLeft: "auto", fontSize: 13 }}>
            {[
              { label: "Material", val: t.material_total },
              { label: "Arbete", val: t.labor_total },
              { label: "Utrustning", val: t.equipment_total },
              { label: `Påslag (${result.meta?.margin_pct || 15}%)`, val: t.margin_amount },
              { label: "Summa exkl. moms", val: t.total_ex_vat },
              { label: "Moms (25%)", val: t.vat },
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

          {/* Accepterad info */}
          {quote.status === "accepted" && quote.accepted_at && (
            <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.3)", borderRadius: "var(--radius)", fontSize: 12, color: "#22c55e" }}>
              ✅ Godkänd av kund den {fmtDate(quote.accepted_at)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "0.5px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Stäng</button>
        </div>
      </div>
    </div>
  );
}

function statusBadge(status: string) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    draft: { bg: "rgba(148,163,184,0.15)", color: "#94a3b8", label: "Utkast" },
    sent: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", label: "Skickad" },
    accepted: { bg: "rgba(34,197,94,0.15)", color: "#22c55e", label: "Godkänd" },
  };
  const s = styles[status] || styles.draft;
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function EstimatesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("draft");
  const [drafts, setDrafts] = useState<SavedEstimate[]>([]);
  const [sentQuotes, setSentQuotes] = useState<QuoteRecord[]>([]);
  const [acceptedQuotes, setAcceptedQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [viewingQuote, setViewingQuote] = useState<QuoteRecord | null>(null);

  useEffect(() => {
    setDrafts(getEstimates());
    getUserQuotes().then((quotes) => {
      setSentQuotes(quotes.filter((q) => q.status === "sent"));
      setAcceptedQuotes(quotes.filter((q) => q.status === "accepted"));
      setLoading(false);
    });
  }, []);

  function handleDelete(id: string, name: string) {
    if (!confirm(`Ta bort "${name}"?`)) return;
    deleteEstimate(id);
    setDrafts(getEstimates());
  }

  function handleViewDraft(est: SavedEstimate) {
    router.push("/estimate?view=" + est.id);
  }

  function handleViewQuote(q: QuoteRecord) {
    setViewingQuote(q);
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
    { id: "draft", label: "Utkast", count: drafts.length },
    { id: "sent", label: "Skickade", count: sentQuotes.length },
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
              {tab === "draft" && "Inga utkast"}
              {tab === "sent" && "Inga skickade offerter"}
              {tab === "accepted" && "Inga godkända offerter"}
            </div>
            <div className="empty-desc">
              {tab === "draft" && "Kalkyler du sparar som utkast visas här."}
              {tab === "sent" && "Offerter du skickat till kunder visas här."}
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

          {/* ── SKICKADE ── */}
          {tab === "sent" && sentQuotes.map((q) => (
            <div key={q.id} className="est-list-item" style={{ cursor: "pointer" }} onClick={() => handleViewQuote(q)}>
              <div className="est-list-icon">📤</div>
              <div className="est-list-info" style={{ flex: 1, minWidth: 0 }}>
                <div className="est-list-title">{q.title}</div>
                <div className="est-list-meta">
                  {new Date(q.created_at).toLocaleDateString("sv-SE")}
                  {q.customer_name && ` · ${q.customer_name}`}
                  {q.customer_email && ` · ${q.customer_email}`}
                </div>
              </div>
              <div style={{ marginRight: 8 }}>{statusBadge("sent")}</div>
              <div className="est-list-amount" style={{ marginRight: 8 }}>{fmtKr(q.customer_pays || q.total_inc_vat || 0)}</div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={e => { e.stopPropagation(); handleViewQuote(q); }}
                style={{ fontSize: 12, padding: "5px 12px" }}
              >
                Se offert
              </button>
            </div>
          ))}

          {/* ── GODKÄNDA ── */}
          {tab === "accepted" && acceptedQuotes.map((q) => (
            <div key={q.id} className="est-list-item" style={{ cursor: "pointer" }} onClick={() => handleViewQuote(q)}>
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
                onClick={e => { e.stopPropagation(); handleViewQuote(q); }}
                style={{ fontSize: 12, padding: "5px 12px" }}
              >
                Se offert
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Offertvisningsmodal */}
      {viewingQuote && (
        <QuoteViewModal
          quote={viewingQuote}
          onClose={() => setViewingQuote(null)}
        />
      )}
    </ProtectedLayout>
  );
}
