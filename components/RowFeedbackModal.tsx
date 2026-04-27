"use client";

import { useState } from "react";
import { saveFeedback } from "@/lib/api";

// ── Reason codes ─────────────────────────────────────────────────────────────
const REASON_OPTIONS = [
  { code: "difficult_access",  label: "Svår åtkomst" },
  { code: "hidden_damage",     label: "Dolda skador / fukt" },
  { code: "customer_request",  label: "Kundönskemål" },
  { code: "wrong_material",    label: "Fel material" },
  { code: "market_price",      label: "Marknadspriset stämmer inte" },
  { code: "scope_change",      label: "Bredare scope" },
  { code: "wrong_hours",       label: "Fel antal timmar" },
  { code: "other",             label: "Annat" },
] as const;

type ReasonCode = typeof REASON_OPTIONS[number]["code"];

// ── Typer ─────────────────────────────────────────────────────────────────────
export interface RowEdit {
  description: string;       // ex. "Rivningsarbeten"
  field: "quantity" | "unit_price" | "total";
  ai_value: number;
  final_value: number;
  reason_code: string;
  reason_text: string;
  category: string;
  row_type: string;          // labor | material | equipment
}

interface Props {
  quoteNumber: string;
  row: {
    description: string;
    note?: string;
    unit: string;
    quantity: number;
    unit_price: number;
    total: number;
    type: string;
  };
  category: string;
  jobType?: string;
  region?: string;
  craftsmanName?: string;
  allEdits: Record<string, RowEdit>;
  onSave: (updatedRow: typeof Props.prototype.row, updatedEdits: Record<string, RowEdit>) => void;
  onClose: () => void;
}

function fmtKr(n: number) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " kr";
}

export default function RowFeedbackModal({
  quoteNumber, row, category, jobType, region, craftsmanName, allEdits, onSave, onClose,
}: Props) {
  const [quantity, setQuantity]     = useState(String(row.quantity));
  const [unitPrice, setUnitPrice]   = useState(String(row.unit_price));
  const [reasonCode, setReasonCode] = useState<ReasonCode>("wrong_hours");
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  const newQty   = parseFloat(quantity)   || row.quantity;
  const newPrice = parseFloat(unitPrice)  || row.unit_price;
  const newTotal = Math.round(newQty * newPrice);

  const qtyChanged   = newQty   !== row.quantity;
  const priceChanged = newPrice !== row.unit_price;
  const anyChanged   = qtyChanged || priceChanged;

  const needsText = reasonCode === "other";

  async function handleSave() {
    if (!anyChanged) { onClose(); return; }
    if (needsText && !reasonText.trim()) {
      setError("Beskriv kort varför du ändrade värdet.");
      return;
    }

    setSaving(true);
    setError("");

    const reasonLabel = REASON_OPTIONS.find(r => r.code === reasonCode)?.label ?? reasonCode;
    const fullReason  = needsText ? `${reasonLabel}: ${reasonText.trim()}` : reasonLabel;

    // Bygg unik nyckel per rad: kategori + beskrivning
    const editKey = `${category}__${row.description}`;

    const rowEdit: RowEdit = {
      description: row.description,
      field:       qtyChanged && priceChanged ? "total" : qtyChanged ? "quantity" : "unit_price",
      ai_value:    qtyChanged ? row.quantity : row.unit_price,
      final_value: qtyChanged ? newQty       : newPrice,
      reason_code: reasonCode,
      reason_text: reasonText.trim(),
      category,
      row_type: row.type,
    };

    const updatedEdits = { ...allEdits, [editKey]: rowEdit };

    // Skicka till backend
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

      const updatedRow = {
        ...row,
        quantity:   newQty,
        unit_price: newPrice,
        total:      newTotal,
      };

      onSave(updatedRow, updatedEdits);
    } catch (e: any) {
      setError(e.message || "Kunde inte spara. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.55)" }} />

      {/* Modal */}
      <div style={{ position: "fixed", inset: 0, zIndex: 201, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, pointerEvents: "none" }}>
        <div style={{ pointerEvents: "all", background: "var(--bg-elevated)", border: "0.5px solid var(--border-strong)", borderRadius: "var(--radius-lg)", width: "100%", maxWidth: 440, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Justera rad
              </div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                {row.description}
                {row.note ? ` — ${row.note}` : ""}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 18, lineHeight: 1, padding: 2 }}>✕</button>
          </div>

          {/* Redigerbara fält */}
          <div style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Antal */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>Antal</span>
                <span style={{ fontSize: 11, color: "var(--text-faint)" }}>AI: {row.quantity} {row.unit}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  className="input"
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  style={{ width: 90, textAlign: "right", borderColor: qtyChanged ? "var(--accent)" : undefined, fontWeight: qtyChanged ? 600 : 400 }}
                />
                <span style={{ fontSize: 12, color: "var(--text-faint)", minWidth: 40 }}>{row.unit}</span>
              </div>
            </div>

            {/* À-pris */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>À-pris</span>
                <span style={{ fontSize: 11, color: "var(--text-faint)" }}>AI: {fmtKr(row.unit_price)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  className="input"
                  type="number"
                  value={unitPrice}
                  onChange={e => setUnitPrice(e.target.value)}
                  style={{ width: 90, textAlign: "right", borderColor: priceChanged ? "var(--accent)" : undefined, fontWeight: priceChanged ? 600 : 400 }}
                />
                <span style={{ fontSize: 12, color: "var(--text-faint)", minWidth: 40 }}>kr</span>
              </div>
            </div>

            {/* Ny summa */}
            <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Ny radsumma</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {anyChanged && (
                  <span style={{ fontSize: 12, color: "var(--text-faint)", textDecoration: "line-through" }}>{fmtKr(row.total)}</span>
                )}
                <span style={{ fontSize: 14, fontWeight: 600, color: anyChanged ? "var(--text-primary)" : "var(--text-secondary)" }}>
                  {fmtKr(newTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* Orsak — visas bara om något ändrats */}
          {anyChanged && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Varför ändrar du?
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {REASON_OPTIONS.map(r => (
                  <button
                    key={r.code}
                    onClick={() => setReasonCode(r.code)}
                    style={{
                      padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                      cursor: "pointer", border: "0.5px solid",
                      borderColor: reasonCode === r.code ? "var(--accent)" : "var(--border-strong)",
                      background:  reasonCode === r.code ? "var(--accent)" : "transparent",
                      color:       reasonCode === r.code ? "#fff" : "var(--text-secondary)",
                      transition: "all 0.1s",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <textarea
                className="input textarea"
                placeholder={needsText ? "Beskriv kortfattat varför… (obligatoriskt)" : "Valfri kommentar…"}
                value={reasonText}
                onChange={e => setReasonText(e.target.value)}
                rows={2}
                style={{ resize: "none", borderColor: needsText && !reasonText.trim() && error ? "var(--red)" : undefined }}
              />
            </div>
          )}

          {error && (
            <div style={{ fontSize: 12, color: "var(--red)", padding: "8px 12px", background: "rgba(220,50,50,0.08)", borderRadius: "var(--radius)" }}>
              {error}
            </div>
          )}

          {/* Knappar */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>Avbryt</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
              {saving ? "Sparar…" : anyChanged ? "Spara justering" : "Stäng"}
            </button>
          </div>

          {anyChanged && (
            <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", marginTop: -6 }}>
              Justeringen sparas och används för att förbättra AI:ns kalkyler framöver.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

