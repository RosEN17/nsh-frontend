"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getQuoteById, acceptQuote } from "@/lib/quotes";

function fmtKr(n: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "decimal", maximumFractionDigits: 0 }).format(n) + " kr";
}

function AcceptInner() {
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("id");

  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!quoteId) { setLoading(false); return; }
    getQuoteById(quoteId).then((q) => {
      setQuote(q);
      if (q?.status === "accepted") setAccepted(true);
      setLoading(false);
    });
  }, [quoteId]);

  async function handleAccept() {
    if (!quoteId) return;
    setAccepting(true);
    const result = await acceptQuote(quoteId);
    if (result.success) {
      setAccepted(true);
    } else {
      setError(result.error || "Något gick fel");
    }
    setAccepting(false);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
        <div style={{ color: "#94a3b8", fontSize: 14 }}>Laddar offert...</div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>📄</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Offerten hittades inte</div>
          <div style={{ fontSize: 14, color: "#64748b" }}>Länken kan vara felaktig eller offerten har tagits bort.</div>
        </div>
      </div>
    );
  }

  const settings = quote.settings_data || {};
  const data = quote.quote_data || {};
  const t = data.totals || {};

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Segoe UI', Arial, sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ background: "white", borderRadius: 12, padding: "32px 36px", marginBottom: 16, border: "0.5px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              {settings.logo_base64 ? (
                <img src={settings.logo_base64} style={{ maxHeight: 48, maxWidth: 180, marginBottom: 8 }} alt="Logo" />
              ) : (
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{settings.company_name || "Företag"}</div>
              )}
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                {settings.org_number && `Org.nr: ${settings.org_number}`}
                {settings.phone && ` · Tel: ${settings.phone}`}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 3, color: "#0f172a" }}>Offert</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                {new Date(quote.created_at).toLocaleDateString("sv-SE")}
              </div>
            </div>
          </div>

          <div style={{ height: 1.5, background: "#0f172a", marginBottom: 20 }} />

          <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{quote.title}</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>{quote.description}</div>
        </div>

        {/* Kalkylrader */}
        <div style={{ background: "white", borderRadius: 12, marginBottom: 16, border: "0.5px solid #e2e8f0", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
            <thead>
              <tr style={{ background: "#0f172a" }}>
                <th style={{ padding: "9px 16px", textAlign: "left" as const, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: 1, color: "#94a3b8", fontWeight: 500 }}>Post</th>
                <th style={{ padding: "9px 12px", textAlign: "center" as const, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: 1, color: "#94a3b8", fontWeight: 500 }}>Enhet</th>
                <th style={{ padding: "9px 12px", textAlign: "right" as const, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: 1, color: "#94a3b8", fontWeight: 500 }}>Antal</th>
                <th style={{ padding: "9px 12px", textAlign: "right" as const, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: 1, color: "#94a3b8", fontWeight: 500 }}>À-pris</th>
                <th style={{ padding: "9px 16px", textAlign: "right" as const, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: 1, color: "#94a3b8", fontWeight: 500 }}>Summa</th>
              </tr>
            </thead>
            <tbody>
              {(data.categories || []).map((cat: any, ci: number) => (
                <>
                  <tr key={`c${ci}`}><td colSpan={5} style={{ padding: "10px 16px", fontWeight: 600, fontSize: 11, textTransform: "uppercase" as const, letterSpacing: 1.5, color: "#64748b", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>{cat.name}</td></tr>
                  {(cat.rows || []).map((row: any, ri: number) => (
                    <tr key={`r${ci}${ri}`}>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#1e293b" }}>{row.description}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 12, color: "#94a3b8", textAlign: "center" as const }}>{row.unit}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 13, textAlign: "right" as const, color: "#334155" }}>{row.quantity}</td>
                      <td style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", fontSize: 13, textAlign: "right" as const, color: "#334155" }}>{fmtKr(row.unit_price)}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 13, textAlign: "right" as const, fontWeight: 600, color: "#0f172a" }}>{fmtKr(row.total)}</td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summering */}
        <div style={{ background: "white", borderRadius: 12, padding: "24px 36px", marginBottom: 16, border: "0.5px solid #e2e8f0" }}>
          <div style={{ maxWidth: 280, marginLeft: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#64748b" }}><span>Material</span><span style={{ color: "#334155" }}>{fmtKr(t.material_total || 0)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#64748b" }}><span>Arbete</span><span style={{ color: "#334155" }}>{fmtKr(t.labor_total || 0)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#64748b" }}><span>Moms 25%</span><span style={{ color: "#334155" }}>{fmtKr(t.vat || 0)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", fontSize: 18, fontWeight: 700, color: "#0f172a", borderTop: "1.5px solid #0f172a", marginTop: 6 }}><span>Totalt</span><span>{fmtKr(t.total_inc_vat || 0)}</span></div>
            {t.rot_deduction > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#16a34a" }}><span>ROT-avdrag</span><span>−{fmtKr(t.rot_deduction)}</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 18, fontWeight: 700, color: "#16a34a", borderTop: "1.5px solid #16a34a", marginTop: 4 }}><span>Att betala</span><span>{fmtKr(t.customer_pays || t.total_inc_vat || 0)}</span></div>
              </>
            )}
          </div>
        </div>

        {/* Accept-knapp */}
        <div style={{ background: "white", borderRadius: 12, padding: "32px 36px", border: "0.5px solid #e2e8f0", textAlign: "center" as const }}>
          {accepted ? (
            <div>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a", marginBottom: 8 }}>Offerten är godkänd!</div>
              <div style={{ fontSize: 14, color: "#64748b" }}>
                Tack för ditt godkännande. {settings.company_name || "Vi"} återkommer med nästa steg.
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Godkänn denna offert?</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
                Genom att klicka nedan godkänner du offerten och arbetet kan påbörjas.
              </div>
              {error && <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <button
                onClick={handleAccept}
                disabled={accepting}
                style={{ padding: "14px 40px", background: "#0f172a", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: accepting ? 0.5 : 1 }}
              >
                {accepting ? "Godkänner..." : "Godkänn offert"}
              </button>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 12 }}>
                Offert giltig t.o.m {new Date(Date.now() + (settings.quote_validity_days || 30) * 86400000).toLocaleDateString("sv-SE")}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center" as const, fontSize: 11, color: "#94a3b8", marginTop: 24 }}>
          {settings.company_name}{settings.org_number ? ` · Org.nr: ${settings.org_number}` : ""}{settings.f_skatt ? " · Godkänd för F-skatt" : ""}
        </div>
      </div>
    </div>
  );
}

export default function AcceptPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f8fafc" }} />}>
      <AcceptInner />
    </Suspense>
  );
}
