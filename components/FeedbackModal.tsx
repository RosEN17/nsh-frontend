"use client";

import { useState } from "react";
import { saveFeedback } from "@/lib/api";

// ----------------------------------------------------------------
// Reason codes — matchar backend VALID_REASON_CODES exakt
// ----------------------------------------------------------------
const REASON_OPTIONS = [
  { code: "difficult_access",  label: "Svår åtkomst" },
  { code: "hidden_damage",     label: "Dolda skador / fukt" },
  { code: "customer_request",  label: "Kundönskemål" },
  { code: "wrong_material",    label: "Fel material valt av AI" },
  { code: "market_price",      label: "Marknadspriset stämmer inte" },
  { code: "scope_change",      label: "Scopet bredare än beskrivet" },
  { code: "other",             label: "Annat (ange nedan)" },
] as const;

type ReasonCode = typeof REASON_OPTIONS[number]["code"];

// ----------------------------------------------------------------
// Props
// ----------------------------------------------------------------
export interface FeedbackField {
  key: string;          // fältnamn, ex. "labor_cost"
  label: string;        // visningsnamn, ex. "Arbetskostnad"
  aiValue: string | number;
  unit?: string;        // ex. "kr", "timmar", "kvm"
}

interface Props {
  quoteNumber: string;
  field: FeedbackField;
  jobType?: string;
  region?: string;
  craftsmanName?: string;
  // Hela edits-objektet hittills — skickas med till backend för craftsman_edits
  allEdits: Record<string, { ai: string | number; final: string | number; reason: string }>;
  onSave: (
    finalValue: string | number,
    reasonCode: string,
    reasonText: string,
    updatedEdits: Record<string, { ai: string | number; final: string | number; reason: string }>
  ) => void;
  onClose: () => void;
}

// ----------------------------------------------------------------
// Komponent
// ----------------------------------------------------------------
export default function FeedbackModal({
  quoteNumber,
  field,
  jobType,
  region,
  craftsmanName,
  allEdits,
  onSave,
  onClose,
}: Props) {
  const [finalValue, setFinalValue] = useState<string>(String(field.aiValue));
  const [reasonCode, setReasonCode] = useState<ReasonCode>("difficult_access");
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const needsText = reasonCode === "other";
  const changed = finalValue !== String(field.aiValue);

  async function handleSave() {
    if (!changed) { onClose(); return; }
    if (needsText && !reasonText.trim()) {
      setError("Beskriv kort varför du ändrade värdet.");
      return;
    }

    setSaving(true);
    setError("");

    const reasonLabel =
      REASON_OPTIONS.find((r) => r.code === reasonCode)?.label ?? reasonCode;
    const fullReason = needsText ? `${reasonLabel}: ${reasonText.trim()}` : reasonLabel;

    const updatedEdits = {
      ...allEdits,
      [field.key]: {
        ai: field.aiValue,
        final: isNaN(Number(finalValue)) ? finalValue : Number(finalValue),
        reason: fullReason,
      },
    };

    try {
      await saveFeedback({
        quote_number: quoteNumber,
        field_changed: field.key,
        ai_value: String(field.aiValue),
        final_value: finalValue,
        reason_code: reasonCode,
        reason_text: reasonText.trim(),
        craftsman_name: craftsmanName,
        job_type: jobType,
        region: region,
        all_edits: updatedEdits,
      });

      onSave(
        isNaN(Number(finalValue)) ? finalValue : Number(finalValue),
        reasonCode,
        fullReason,
        updatedEdits
      );
    } catch (e: any) {
      setError(e.message || "Kunde inte spara. Försök igen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.55)",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 201,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, pointerEvents: "none",
      }}>
        <div style={{
          pointerEvents: "all",
          background: "var(--surface)",
          border: "0.5px solid var(--border-strong)",
          borderRadius: "var(--radius-lg)",
          width: "100%", maxWidth: 420,
          padding: 24,
          display: "flex", flexDirection: "column", gap: 18,
        }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                Justera: {field.label}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 3 }}>
                Offert {quoteNumber} · Ändringen sparas för AI-träning
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-faint)", fontSize: 18, lineHeight: 1, padding: 2,
              }}
            >✕</button>
          </div>

          {/* AI-värde vs nytt värde */}
          <div style={{
            background: "var(--surface-2)",
            border: "0.5px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "12px 14px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {/* AI föreslog */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>AI föreslog</span>
              <span style={{
                fontSize: 13, fontWeight: 500,
                color: "var(--text-secondary)",
                textDecoration: changed ? "line-through" : "none",
              }}>
                {typeof field.aiValue === "number"
                  ? field.aiValue.toLocaleString("sv-SE")
                  : field.aiValue}
                {field.unit ? ` ${field.unit}` : ""}
              </span>
            </div>

            {/* Nytt värde */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap" }}>Ditt värde</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  className="input"
                  value={finalValue}
                  onChange={(e) => setFinalValue(e.target.value)}
                  style={{
                    width: 120, textAlign: "right",
                    borderColor: changed ? "var(--accent)" : undefined,
                    fontWeight: changed ? 600 : 400,
                  }}
                  autoFocus
                />
                {field.unit && (
                  <span style={{ fontSize: 12, color: "var(--text-faint)", whiteSpace: "nowrap" }}>
                    {field.unit}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Orsak — visas bara om värdet ändrats */}
          {changed && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label className="label">Varför ändrar du?</label>

              {/* Reason pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {REASON_OPTIONS.map((r) => (
                  <button
                    key={r.code}
                    onClick={() => setReasonCode(r.code)}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      border: "0.5px solid",
                      borderColor: reasonCode === r.code ? "var(--accent)" : "var(--border-strong)",
                      background: reasonCode === r.code ? "var(--accent)" : "transparent",
                      color: reasonCode === r.code ? "#fff" : "var(--text-secondary)",
                      transition: "all 0.1s",
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Fritextfält — visas om "Annat" eller alltid som valfritt komplement */}
              <textarea
                className="input textarea"
                placeholder={needsText
                  ? "Beskriv kortfattat varför… (obligatoriskt)"
                  : "Valfri kommentar…"
                }
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                rows={2}
                style={{
                  resize: "none",
                  borderColor: needsText && !reasonText.trim() && error
                    ? "var(--red)"
                    : undefined,
                }}
              />
            </div>
          )}

          {/* Fel */}
          {error && (
            <div style={{
              fontSize: 12, color: "var(--red)",
              padding: "8px 12px",
              background: "rgba(220,50,50,0.08)",
              borderRadius: "var(--radius)",
            }}>
              {error}
            </div>
          )}

          {/* Knappar */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
              Avbryt
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Sparar…" : changed ? "Spara justering" : "Stäng"}
            </button>
          </div>

          {/* Info */}
          {changed && (
            <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", marginTop: -8 }}>
              Justeringen sparas anonymt och används för att förbättra AI:ns kalkyler.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

