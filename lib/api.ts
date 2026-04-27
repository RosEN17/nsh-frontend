"use client";

/**
 * EditableRow — En rad i offertkalkylen med inbyggd redigeringsknapp.
 * 
 * Användning i din befintliga offertsida:
 * 
 *   <EditableRow
 *     quoteNumber="D1849-3"
 *     fieldKey="labor_cost"
 *     label="Arbetskostnad"
 *     aiValue={151000}
 *     unit="kr"
 *     jobType="badrum"
 *     region="Stockholm"
 *     craftsmanName="Jim Ruthström"
 *     allEdits={allEdits}
 *     onUpdated={(newVal, updatedEdits) => {
 *       setLaborCost(newVal as number);
 *       setAllEdits(updatedEdits);
 *     }}
 *   />
 */

import { useState } from "react";
import FeedbackModal, { FeedbackField } from "@/components/FeedbackModal";

interface Props {
  quoteNumber: string;
  fieldKey: string;
  label: string;
  aiValue: string | number;
  displayValue?: string;       // om du vill visa formaterat värde (ex. "151 000 kr")
  unit?: string;
  jobType?: string;
  region?: string;
  craftsmanName?: string;
  allEdits: Record<string, { ai: string | number; final: string | number; reason: string }>;
  onUpdated: (
    newValue: string | number,
    updatedEdits: Record<string, { ai: string | number; final: string | number; reason: string }>
  ) => void;
  // Styling
  highlight?: boolean;         // gul bakgrund om AI är osäker
  indent?: boolean;            // indenterad underrad
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M11 2l3 3-8 8H3v-3l8-8z" strokeLinejoin="round" />
    </svg>
  );
}

function EditedBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600,
      padding: "1px 6px",
      borderRadius: 10,
      background: "rgba(99,179,130,0.15)",
      color: "#3d9e6a",
      border: "0.5px solid rgba(99,179,130,0.3)",
      whiteSpace: "nowrap",
    }}>
      justerad
    </span>
  );
}

export default function EditableRow({
  quoteNumber, fieldKey, label, aiValue, displayValue,
  unit, jobType, region, craftsmanName,
  allEdits, onUpdated, highlight, indent,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentValue, setCurrentValue] = useState<string | number>(aiValue);
  const [isEdited, setIsEdited] = useState(false);

  const field: FeedbackField = {
    key: fieldKey,
    label,
    aiValue: currentValue,
    unit,
  };

  function handleSave(
    finalValue: string | number,
    _reasonCode: string,
    _reasonText: string,
    updatedEdits: Record<string, { ai: string | number; final: string | number; reason: string }>
  ) {
    setCurrentValue(finalValue);
    setIsEdited(true);
    setModalOpen(false);
    onUpdated(finalValue, updatedEdits);
  }

  const formattedValue = displayValue
    ?? (typeof currentValue === "number"
      ? currentValue.toLocaleString("sv-SE") + (unit ? ` ${unit}` : "")
      : String(currentValue) + (unit ? ` ${unit}` : ""));

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          paddingLeft: indent ? 24 : 12,
          borderRadius: "var(--radius)",
          background: highlight
            ? "rgba(250,200,50,0.07)"
            : isEdited
            ? "rgba(99,179,130,0.05)"
            : "transparent",
          border: highlight
            ? "0.5px solid rgba(250,200,50,0.25)"
            : "0.5px solid transparent",
          transition: "background 0.15s",
          gap: 12,
        }}
      >
        {/* Label */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <span style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {label}
          </span>
          {highlight && (
            <span style={{
              fontSize: 10, color: "#c9952a",
              background: "rgba(250,200,50,0.12)",
              border: "0.5px solid rgba(250,200,50,0.3)",
              padding: "1px 6px", borderRadius: 10, whiteSpace: "nowrap",
            }}>
              kontrollera
            </span>
          )}
          {isEdited && <EditedBadge />}
        </div>

        {/* Värde + knapp */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{
            fontSize: 13,
            fontWeight: isEdited ? 600 : 400,
            color: isEdited ? "var(--text-primary)" : "var(--text-secondary)",
          }}>
            {formattedValue}
          </span>

          {/* Redigera-knapp */}
          <button
            onClick={() => setModalOpen(true)}
            title="Justera värde"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 9px",
              borderRadius: "var(--radius)",
              border: "0.5px solid var(--border-strong)",
              background: "transparent",
              color: "var(--text-faint)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 500,
              transition: "all 0.1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-faint)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)";
            }}
          >
            <PencilIcon />
            <span>Justera</span>
          </button>
        </div>
      </div>

      {/* Modal öppnas när snickaren klickar Justera */}
      {modalOpen && (
        <FeedbackModal
          quoteNumber={quoteNumber}
          field={field}
          jobType={jobType}
          region={region}
          craftsmanName={craftsmanName}
          allEdits={allEdits}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
