"use client";

/**
 * RowFeedbackModal.tsx
 *
 * Modal för att justera en rad i offerten och spara anledning till databasen.
 * Skickar till /api/feedback → sparas i feedback_events + craftsman_edits på quotes.
 *
 * VIKTIGT: Använder INTE position:fixed — fungerar korrekt i alla miljöer.
 * Wrappa med en portal eller lägg modalen sist i DOM:en för korrekt z-index.
 */

import { useState, useEffect, useCallback } from "react";
import { saveFeedback } from "@/lib/api";

// ── Orsakskoder — matchar VALID_REASON_CODES i main.py ──
const REASON_OPTIONS = [
  { code: "wrong_hours",      label: "Fel antal timmar",              icon: "⏱" },
  { code: "market_price",     label: "Marknadspriset stämmer inte",   icon: "💰" },
  { code: "wrong_material",   label: "Fel material / pris",           icon: "🪵" },
  { code: "scope_change",     label: "Bredare scope",                 icon: "📐" },
  { code: "difficult_access", label: "Svår åtkomst",                  icon: "🚧" },
  { code: "hidden_damage",    label: "Dolda skador / fukt",           icon: "🔍" },
  { code: "customer_request", label: "Kundönskemål",                  icon: "💬" },
  { code: "other",            label: "Annat",                         icon: "✏️" },
] as const;

type ReasonCode = typeof REASON_OPTIONS[number]["code"];

export interface RowEdit {
  description: string;
  field: "quantity" | "unit_price" | "total";
  ai_value: number;
  final_value: number;
  reason_code: string;
  reason_text: string;
  category: string;
  row_type: string;
}

export interface QuoteRow {
  description: string;
  note?: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total: number;
  type: string;
}

interface Props {
  quoteNumber: string;
  row: QuoteRow;
  category: string;
  jobType?: string;
  region?: string;
  craftsmanName?: string;
  allEdits: Record<string, RowEdit>;
  onSave: (updatedRow: QuoteRow, updatedEdits: Record<string, RowEdit>) => void;
  onClose: () => void;
}

function fmtKr(n: number) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " kr";
}

function DiffBadge({ original, updated }: { original: number; updated: number }) {
  if (original === 0 || updated === original) return null;
  const pct   = Math.round(Math.abs(updated - original) / original * 100);
  const up    = updated > original;
  const color = up ? "#ef4444" : "#22c55e";
  const bg    = up ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)";
  const sign  = up ? "+" : "−";
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 7px",
      borderRadius: 20, background: bg, color,
      border: `0.5px solid ${color}44`,
    }}>
      {sign}{pct}%
    </span>
  );
}

export default function RowFeedbackModal({
  quoteNumber, row, category, jobType, region, craftsmanName, allEdits, onSave, onClose,
}: Props) {
  const [quantity,   setQuantity]   = useState(String(row.quantity));
  const [unitPrice,  setUnitPrice]  = useState(String(row.unit_price));
  const [reasonCode, setReasonCode] = useState<ReasonCode>("wrong_hours");
  const [reasonText, setReasonText] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  const newQty    = parseFloat(quantity)  || row.quantity;
  const newPrice  = parseFloat(unitPrice) || row.unit_price;
  const newTotal  = Math.round(newQty * newPrice);

  const qtyChanged   = newQty   !== row.quantity;
  const priceChanged = newPrice !== row.unit_price;
  const anyChanged   = qtyChanged || priceChanged;
  const needsText    = reasonCode === "other";

  // Stäng på Escape
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);
  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  async function handleSave() {
    if (!anyChanged) { onClose(); return; }
    if (needsText && !reasonText.trim()) {
      setError("Beskriv kort varför du ändrade värdet.");
      return;
    }
    setSaving(true);
    setError("");

    const editKey  = `${category}__${row.description}`;
    const rowEdit: RowEdit = {
      description: row.description,
      field:       qtyChanged && priceChanged ? "total"
                 : qtyChanged                 ? "quantity"
                 :                              "unit_price",
      ai_value:    qtyChanged ? row.quantity : row.unit_price,
      final_value: qtyChanged ? newQty       : newPrice,
      reason_code: reasonCode,
      reason_text: reasonText.trim(),
      category,
      row_type: row.type,
    };

    const updatedEdits = { ...allEdits, [editKey]: rowEdit };

    try {
      await saveFeedback({
        quote_number:   quoteNumber,
        field_changed:  `${category} / ${row.description} / ${rowEdit.field}`,
        ai_value:       String(rowEdit.ai_value),
        final_value:    String(rowEdit.final_value),
        reason_code:    reasonCode,
        reason_text:    reasonText.trim(),
        craftsman_name: craftsmanName,
        job_type:       jobType,
        region:         region,
        all_edits:      updatedEdits as any,
      });

      onSave(
        { ...row, quantity: newQty, unit_price: newPrice, total: newTotal },
        updatedEdits,
      );
    } catch (e: any) {
      setError(e.message || "Kunde inte spara. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  // ── Overlay + centrering utan position:fixed ──
  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:   "var(--bg-elevated)",
          border:       "0.5px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)",
          width: "100%", maxWidth: 460,
          display: "flex", flexDirection: "column", gap: 0,
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: "18px 20px 16px",
          borderBottom: "0.5px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              Justera rad
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
              {row.description}{row.note ? <span style={{ color: "var(--text-muted)" }}> — {row.note}</span> : null}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              {category}
              {row.type === "labor"         && " · Arbete"}
              {row.type === "material"      && " · Material"}
              {row.type === "subcontractor" && " · Underentreprenör"}
              {row.type === "equipment"     && " · Utrustning"}
              {row.type === "disposal"      && " · Sophantering"}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", padding: "4px 6px",
              borderRadius: "var(--radius)", fontSize: 16, lineHeight: 1,
              transition: "color .15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            ✕
          </button>
        </div>

        {/* ── Värdefält ── */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{
            background: "var(--bg-surface)",
            border: "0.5px solid var(--border)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
          }}>
            {/* Antal / arbetstid */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 14px", borderBottom: "0.5px solid var(--border)",
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {row.type === "labor" ? "Arbetstid" : "Antal"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  AI: {row.quantity} {row.unit}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {qtyChanged && <DiffBadge original={row.quantity} updated={newQty} />}
                <input
                  className="input"
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  style={{
                    width: 90, textAlign: "right",
                    borderColor: qtyChanged ? "var(--accent)" : undefined,
                    fontWeight: qtyChanged ? 600 : 400,
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 36 }}>
                  {row.unit}
                </span>
              </div>
            </div>

            {/* À-pris / timpris */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 14px", borderBottom: "0.5px solid var(--border)",
            }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {row.type === "labor" ? "Timpris" : "À-pris"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  AI: {fmtKr(row.unit_price)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {priceChanged && <DiffBadge original={row.unit_price} updated={newPrice} />}
                <input
                  className="input"
                  type="number"
                  value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  style={{
                    width: 90, textAlign: "right",
                    borderColor: priceChanged ? "var(--accent)" : undefined,
                    fontWeight: priceChanged ? 600 : 400,
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 36 }}>kr</span>
              </div>
            </div>

            {/* Radsumma */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "12px 14px",
              background: anyChanged ? "rgba(106,129,147,0.05)" : undefined,
            }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Radsumma</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {anyChanged && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "line-through" }}>
                    {fmtKr(row.total)}
                  </span>
                )}
                <DiffBadge original={row.total} updated={newTotal} />
                <span style={{ fontSize: 15, fontWeight: 700, color: anyChanged ? "var(--text-primary)" : "var(--text-secondary)", fontFamily: "var(--mono)" }}>
                  {fmtKr(newTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Orsakspanel ── */}
          {anyChanged && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Varför ändrar du?
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {REASON_OPTIONS.map(r => {
                  const active = reasonCode === r.code;
                  return (
                    <button
                      key={r.code}
                      onClick={() => setReasonCode(r.code)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                        cursor: "pointer", border: "0.5px solid", transition: "all .1s",
                        borderColor: active ? "var(--accent)" : "var(--border-strong)",
                        background:  active ? "var(--accent-soft)" : "transparent",
                        color:       active ? "var(--accent-text)" : "var(--text-secondary)",
                      }}
                    >
                      <span style={{ fontSize: 12 }}>{r.icon}</span>
                      {r.label}
                    </button>
                  );
                })}
              </div>
              <textarea
                className="input textarea"
                placeholder={needsText
                  ? "Beskriv kortfattat varför… (obligatoriskt)"
                  : "Valfri kommentar till justeringen…"}
                value={reasonText}
                onChange={e => setReasonText(e.target.value)}
                rows={2}
                style={{
                  resize: "none",
                  borderColor: needsText && !reasonText.trim() && error
                    ? "var(--red)" : undefined,
                }}
              />
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 8, fontSize: 12, color: "var(--red)",
              padding: "8px 12px", background: "rgba(220,50,50,0.08)",
              borderRadius: "var(--radius)",
            }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: "14px 20px",
          borderTop: "0.5px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          background: "var(--bg-surface)",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {anyChanged
              ? "Sparas i feedback_events och förbättrar AI:ns kalkyler"
              : "Inga ändringar gjorda"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={saving}
            >
              Avbryt
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Sparar…" : anyChanged ? "Spara justering" : "Stäng"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
