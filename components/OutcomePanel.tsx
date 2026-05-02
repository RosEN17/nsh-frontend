"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const API = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

const LOST_REASONS = [
  { code: "too_expensive",   label: "För dyrt" },
  { code: "lost_to_competitor", label: "Förlorade mot konkurrent" },
  { code: "customer_changed_mind", label: "Kunden ångrade sig" },
  { code: "scope_changed",   label: "Scopet ändrades" },
  { code: "other",           label: "Annat" },
];

interface Props {
  quoteId: string;
  quoteNumber: string;
  currentOutcome: string | null;
  totalIncVat: number;
  onUpdated: () => void;
}

function fmtKr(n: number) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " kr";
}

export default function OutcomePanel({
  quoteId, quoteNumber, currentOutcome, totalIncVat, onUpdated,
}: Props) {
  const [outcome, setOutcome]           = useState<string>(currentOutcome || "pending");
  const [actualPrice, setActualPrice]   = useState("");
  const [lostReason, setLostReason]     = useState("too_expensive");
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [error, setError]               = useState("");

  const diffPct = actualPrice
    ? Math.round(Math.abs(parseFloat(actualPrice) - totalIncVat) / totalIncVat * 100)
    : null;

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token || "";

      const body: any = { quote_id: quoteId, outcome };
      if (outcome === "won" && actualPrice)
        body.actual_final_price = parseFloat(actualPrice);
      if (outcome === "lost")
        body.lost_reason = lostReason;

      const res = await fetch(`${API}/api/quotes/${quoteId}/outcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Kunde inte spara");
      setSaved(true);
      onUpdated();
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Något gick fel");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      background: "var(--bg-elevated)",
      border: "0.5px solid var(--border-strong)",
      borderRadius: "var(--radius-lg)",
      padding: 20,
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
        Utfall — Offert {quoteNumber}
      </div>

      {/* Outcome-knappar */}
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { val: "won",     label: "Vunnen",  color: "#16a34a" },
          { val: "lost",    label: "Förlorad", color: "var(--red)" },
          { val: "pending", label: "Inväntar", color: "var(--text-faint)" },
        ].map(o => (
          <button
            key={o.val}
            onClick={() => setOutcome(o.val)}
            style={{
              flex: 1, padding: "8px 0", borderRadius: "var(--radius)",
              border: "0.5px solid",
              borderColor: outcome === o.val ? o.color : "var(--border)",
              background: outcome === o.val ? o.color + "18" : "transparent",
              color: outcome === o.val ? o.color : "var(--text-secondary)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Om vunnen: faktiskt pris */}
      {outcome === "won" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Faktiskt slutpris (ink. moms)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              className="input"
              type="number"
              placeholder={String(Math.round(totalIncVat))}
              value={actualPrice}
              onChange={e => setActualPrice(e.target.value)}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>kr</span>
          </div>
          {diffPct !== null && actualPrice && (
            <div style={{
              fontSize: 12, padding: "6px 10px", borderRadius: "var(--radius)",
              background: diffPct <= 5 ? "rgba(22,163,74,0.1)" : diffPct <= 15 ? "rgba(234,179,8,0.1)" : "rgba(220,50,50,0.1)",
              color: diffPct <= 5 ? "#16a34a" : diffPct <= 15 ? "#a16207" : "var(--red)",
            }}>
              {diffPct <= 5
                ? `Träffsäkerhet: ${100 - diffPct}% — utmärkt kalkyl`
                : diffPct <= 15
                ? `Avvikelse: ${diffPct}% — bra men kan förbättras`
                : `Avvikelse: ${diffPct}% — AI:n lär sig av detta`}
              {" "}(AI offerterade {fmtKr(totalIncVat)})
            </div>
          )}
        </div>
      )}

      {/* Om förlorad: anledning */}
      {outcome === "lost" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Varför förlorades jobbet?
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {LOST_REASONS.map(r => (
              <button
                key={r.code}
                onClick={() => setLostReason(r.code)}
                style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 12,
                  fontWeight: 500, cursor: "pointer", border: "0.5px solid",
                  borderColor: lostReason === r.code ? "var(--accent)" : "var(--border-strong)",
                  background: lostReason === r.code ? "var(--accent)" : "transparent",
                  color: lostReason === r.code ? "#fff" : "var(--text-secondary)",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: "var(--red)" }}>{error}</div>
      )}

      <button
        className="btn btn-primary btn-sm"
        onClick={handleSave}
        disabled={saving}
        style={{ alignSelf: "flex-end" }}
      >
        {saving ? "Sparar…" : saved ? "Sparat!" : "Spara utfall"}
      </button>

      <div style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center", marginTop: -6 }}>
        Utfallet används för att kalibrera AI:ns pristräffsäkerhet.
      </div>
    </div>
  );
}
