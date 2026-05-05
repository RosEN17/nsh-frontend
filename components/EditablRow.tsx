"use client";

/**
 * EditableRow.tsx
 *
 * Wrapprar en rad i offerttabellen med en "Justera"-knapp
 * som öppnar RowFeedbackModal.
 *
 * Användning i din est-table:
 *
 *   <EditableRow
 *     row={row}
 *     category={cat.name}
 *     quoteNumber={quoteNumber}
 *     jobType={jobType}
 *     region={region}
 *     craftsmanName={craftsmanName}
 *     allEdits={edits}
 *     onSaved={(updated, newEdits) => { updateRow(updated); setEdits(newEdits); }}
 *   />
 */

import { useState } from "react";
import RowFeedbackModal, { QuoteRow, RowEdit } from "./RowFeedbackModal";

interface Props {
  row: QuoteRow;
  category: string;
  quoteNumber: string;
  jobType?: string;
  region?: string;
  craftsmanName?: string;
  allEdits: Record<string, RowEdit>;
  onSaved: (updatedRow: QuoteRow, updatedEdits: Record<string, RowEdit>) => void;
  /** Om true: visa "Justera"-knappen — t.ex. bara på sparade offerter */
  editable?: boolean;
}

function fmtKr(n: number) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " kr";
}

const TYPE_COLORS: Record<string, string> = {
  labor:         "rgba(106,129,147,0.15)",
  material:      "rgba(59,130,246,0.10)",
  subcontractor: "rgba(234,179,8,0.10)",
  equipment:     "rgba(168,85,247,0.10)",
  disposal:      "rgba(239,68,68,0.10)",
  overhead:      "rgba(34,197,94,0.08)",
};

const TYPE_LABELS: Record<string, string> = {
  labor:         "Arbete",
  material:      "Material",
  subcontractor: "UE",
  equipment:     "Utrustning",
  disposal:      "Sophantering",
  overhead:      "Overhead",
};

export default function EditableRow({
  row, category, quoteNumber, jobType, region, craftsmanName,
  allEdits, onSaved, editable = true,
}: Props) {
  const [open,        setOpen]        = useState(false);
  const [localRow,    setLocalRow]    = useState<QuoteRow>(row);
  const [localEdits,  setLocalEdits]  = useState(allEdits);
  const [hover,       setHover]       = useState(false);

  const editKey   = `${category}__${row.description}`;
  const isEdited  = !!localEdits[editKey];
  const typeColor = TYPE_COLORS[localRow.type] || "transparent";
  const typeLabel = TYPE_LABELS[localRow.type] || localRow.type;

  function handleSaved(updated: QuoteRow, newEdits: Record<string, RowEdit>) {
    setLocalRow(updated);
    setLocalEdits(newEdits);
    setOpen(false);
    onSaved(updated, newEdits);
  }

  return (
    <>
      <tr
        className="est-table-row"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ position: "relative" }}
      >
        {/* Beskrivning */}
        <td style={{ paddingLeft: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 11, padding: "1px 6px", borderRadius: 4,
              background: typeColor, color: "var(--text-secondary)",
              whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {typeLabel}
            </span>
            <span style={{ color: isEdited ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {localRow.description}
            </span>
            {localRow.note && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>— {localRow.note}</span>
            )}
            {isEdited && (
              <span style={{
                fontSize: 10, padding: "1px 6px", borderRadius: 10,
                background: "var(--accent-soft)", color: "var(--accent-text)",
                border: "0.5px solid var(--accent-border)", whiteSpace: "nowrap",
              }}>
                justerad
              </span>
            )}
          </div>
        </td>

        {/* Antal */}
        <td className="right" style={{ color: "var(--text-secondary)", fontFamily: "var(--mono)", fontSize: 12 }}>
          {localRow.quantity} {localRow.unit}
        </td>

        {/* À-pris */}
        <td className="right" style={{ color: "var(--text-secondary)", fontFamily: "var(--mono)", fontSize: 12 }}>
          {fmtKr(localRow.unit_price)}
        </td>

        {/* Summa */}
        <td className="right" style={{ color: "var(--text-primary)", fontFamily: "var(--mono)", fontSize: 13, fontWeight: 500 }}>
          {fmtKr(localRow.total)}
        </td>

        {/* Justera-knapp */}
        {editable && (
          <td style={{ width: 80, paddingRight: 8, textAlign: "right" }}>
            <button
              onClick={() => setOpen(true)}
              style={{
                opacity: hover || isEdited ? 1 : 0,
                transition: "opacity .15s",
                padding: "3px 10px", borderRadius: "var(--radius)",
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                border: "0.5px solid",
                borderColor: isEdited ? "var(--accent-border)" : "var(--border-strong)",
                background:  isEdited ? "var(--accent-soft)"   : "transparent",
                color:       isEdited ? "var(--accent-text)"   : "var(--text-muted)",
              }}
            >
              {isEdited ? "Redigera" : "Justera"}
            </button>
          </td>
        )}
      </tr>

      {/* Modal – monteras i samma container, ej fixed */}
      {open && (
        <tr>
          <td colSpan={editable ? 5 : 4} style={{ padding: 0, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, zIndex: 200 }}>
              <RowFeedbackModal
                quoteNumber={quoteNumber}
                row={localRow}
                category={category}
                jobType={jobType}
                region={region}
                craftsmanName={craftsmanName}
                allEdits={localEdits}
                onSave={handleSaved}
                onClose={() => setOpen(false)}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

