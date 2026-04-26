"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getQuoteById, acceptQuote } from "@/lib/quotes";

function fmtKr(n: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "decimal", maximumFractionDigits: 0 }).format(n) + " kr";
}

// ── Delade defaults (samma som generateQuoteHTML) ────────────────────────────
const DEFAULT_PREREQS = [
  "Att fri framkomlighet finns och att störande arbete kan utföras dagtid 07.00–17.00",
  "Att ni fritt tillhandahåller el och vatten",
  "Att container/säckar för avfall ska kunna ställas i nära anslutning till respektive hus",
  "Att 2 meter grusad och plan mark finns runt grund för byggnation ställning",
];

const DEFAULT_RESERVATIONS = [
  "Byggström tillhandahålls av byggherren",
  "Anslutningsavgifter samt utsättning ingår ej",
  "Byggvatten ingår ej i denna offert, skall finnas minst 10 meter från respektive lgh under arbete",
  "Markarbeten ingår ej i denna offert",
  "Offert kan komma justeras efter mottagning bygghandlingar",
  "Uppställningsplats för mobilkran skall finnas vid respektive hus vid husresning",
  "Betongarbeten avser endast platsgjuten betong",
  "Vi förutsätter full framkomlighet för samtliga transporter",
  "Om vår offert bedöms som intressant förutsätter vi att dialog förs med oss innan avtal tecknas",
  "Markarbeten ingår EJ i detta anbud",
  "Sprängning ingår EJ i detta anbud",
];

// ── Sektion-rubrik ───────────────────────────────────────────────────────────
function SectionDivider({ title }: { title?: string }) {
  return (
    <div style={{ margin: "0 0 16px", borderTop: "1px solid #e2e8f0", paddingTop: 20 }}>
      {title && (
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>{title}</div>
      )}
    </div>
  );
}

// ── Rad i summarytabell ──────────────────────────────────────────────────────
function SumRow({ label, value, big, green }: { label: string; value: string; big?: boolean; green?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: big ? "10px 0" : "5px 0",
      borderTop: big ? `1.5px solid ${green ? "#16a34a" : "#0f172a"}` : undefined,
      marginTop: big ? 6 : 0,
      fontSize: big ? 16 : 13,
      fontWeight: big ? 700 : 400,
      color: green ? "#16a34a" : big ? "#0f172a" : "#64748b",
    }}>
      <span>{label}</span>
      <span style={{ fontFamily: "monospace" }}>{value}</span>
    </div>
  );
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
    if (!quoteId || !quote) return;
    setAccepting(true);
    const result = await acceptQuote(quoteId);
    if (result.success) {
      setAccepted(true);
      const settings = quote.settings_data || {};
      const companyEmail = settings.email;
      if (companyEmail) {
        try {
          const API = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";
          await fetch(`${API}/api/notify-acceptance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company_email: companyEmail,
              company_name: settings.company_name || "Företag",
              quote_title: quote.title,
              customer_name: quote.customer_name || "Ej angivet",
              customer_email: quote.customer_email || "Ej angivet",
              total_amount: fmtKr(quote.customer_pays || quote.total_inc_vat || 0),
              accepted_date: new Date().toLocaleDateString("sv-SE") + " kl " + new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }),
            }),
          });
        } catch (e) {
          console.error("Kunde inte skicka notifikation:", e);
        }
      }
    } else {
      setError(result.error || "Något gick fel");
    }
    setAccepting(false);
  }

  // ── Laddning ──────────────────────────────────────────────────────────────
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

  const settings  = quote.settings_data || {};
  const data      = quote.quote_data    || {};
  const t         = data.totals         || {};
  const hourlyRate = data.meta?.hourly_rate || settings.hourly_rate || 650;
  const validDays  = settings.quote_validity_days || 30;
  const validUntil = new Date(new Date(quote.created_at).getTime() + validDays * 86400000).toLocaleDateString("sv-SE");
  const companyName = settings.company_name || "Företag";

  const anbudsText = settings.quote_intro ||
    "Vi tackar för er förfrågan och erbjuder oss härmed att utföra arbeten på rubricerat projekt i enlighet med erhållet förfrågningsunderlag/platsbesök";

  const prereqLines: string[] = settings.quote_prerequisites
    ? settings.quote_prerequisites.split("\n").filter(Boolean)
    : DEFAULT_PREREQS;

  const reservationLines: string[] = settings.quote_reservations
    ? settings.quote_reservations.split("\n").filter(Boolean)
    : DEFAULT_RESERVATIONS;

  const companyInfoLines = [
    settings.address,
    settings.zip_city,
    settings.phone ? `Tel: ${settings.phone}` : "",
    settings.email,
    settings.website,
  ].filter(Boolean);

  // ── Stil-konstanter ────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: "white", borderRadius: 12, border: "0.5px solid #e2e8f0",
    marginBottom: 16, overflow: "hidden",
  };
  const cardPad: React.CSSProperties = { ...card, padding: "28px 32px" };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 4 };
  const bodyStyle: React.CSSProperties = { fontSize: 13, color: "#334155", lineHeight: 1.7 };
  const listStyle: React.CSSProperties = { margin: "6px 0 0 18px", padding: 0, fontSize: 13, color: "#334155", lineHeight: 1.9 };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Segoe UI', Arial, sans-serif", padding: "36px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* ── GODKÄNN-KNAPP UPPE ─────────────────────────────────────────── */}
        {!accepted && (
          <div style={{ ...cardPad, background: "#0f172a", border: "none", marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: "#94a3b8", marginBottom: 4 }}>
              Läs igenom offerten nedan och godkänn när du är redo
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "white", marginBottom: 16 }}>
              {fmtKr(t.customer_pays || t.total_inc_vat || 0)}
              {t.rot_deduction > 0 && (
                <span style={{ fontSize: 13, fontWeight: 400, color: "#94a3b8", marginLeft: 8 }}>inkl. ROT-avdrag</span>
              )}
            </div>
            <button
              onClick={handleAccept}
              disabled={accepting}
              style={{ padding: "13px 44px", background: "#6a8193", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: accepting ? 0.6 : 1 }}
            >
              {accepting ? "Godkänner..." : "Godkänn offert"}
            </button>
            {error && <div style={{ marginTop: 12, fontSize: 13, color: "#fca5a5" }}>{error}</div>}
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 10 }}>
              Giltig t.o.m {validUntil}
            </div>
          </div>
        )}

        {/* ── GODKÄND-BANNER ─────────────────────────────────────────────── */}
        {accepted && (
          <div style={{ ...cardPad, background: "#f0fdf4", border: "1px solid #bbf7d0", textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#16a34a", marginBottom: 6 }}>Offerten är godkänd!</div>
            <div style={{ fontSize: 14, color: "#64748b" }}>
              Tack för ditt godkännande. {companyName} har fått en notifikation och återkommer med nästa steg.
            </div>
          </div>
        )}

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div style={{ ...cardPad, borderBottom: "3px solid #6a8193" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              {settings.logo_base64 ? (
                <img src={settings.logo_base64} style={{ maxHeight: 52, maxWidth: 180, marginBottom: 6 }} alt="Logo" />
              ) : (
                <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{companyName}</div>
              )}
              {settings.org_number && (
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Org.nr: {settings.org_number}</div>
              )}
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.8, marginTop: 2 }}>
                {companyInfoLines.map((l, i) => <span key={i}>{l}<br /></span>)}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#6a8193", letterSpacing: 1 }}>OFFERT</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, lineHeight: 1.8 }}>
                <div>Datum: {new Date(quote.created_at).toLocaleDateString("sv-SE")}</div>
                <div>Giltig t.o.m: <strong>{validUntil}</strong></div>
                {settings.contact_name && (
                  <div style={{ marginTop: 4 }}>
                    Kontakt: {settings.contact_name}{settings.contact_title ? `, ${settings.contact_title}` : ""}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Avser */}
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ flex: 1, padding: "12px 14px", border: "1px dashed #cbd5e1", borderRadius: 6, fontSize: 12, color: "#94a3b8" }}>
              <div style={{ fontWeight: 700, color: "#64748b", marginBottom: 6 }}>KUND</div>
              {quote.customer_name && <div style={{ color: "#334155", fontWeight: 600, marginBottom: 2 }}>{quote.customer_name}</div>}
              {quote.customer_email && <div style={{ color: "#64748b" }}>{quote.customer_email}</div>}
              {!quote.customer_name && <>
                Namn: ______________________<br /><br />
                Telefon: ______________________
              </>}
            </div>
            <div style={{ flex: 1, padding: "12px 14px", background: "#f8fafc", borderRadius: 6, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: "#64748b", marginBottom: 6 }}>AVSER</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{quote.title}</div>
              <div style={{ color: "#64748b", lineHeight: 1.5 }}>{quote.description}</div>
            </div>
          </div>
        </div>

        {/* ── INLEDNING & FÖRUTSÄTTNINGAR ───────────────────────────────── */}
        <div style={cardPad}>
          <p style={{ margin: "0 0 14px", ...bodyStyle }}>{anbudsText}</p>
          <p style={{ ...labelStyle, marginBottom: 6 }}>Anbudssumma förutsätter:</p>
          <ul style={listStyle}>
            {prereqLines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>

        {/* ── KALKYLRADER ───────────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ padding: "18px 24px 10px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Specifikation</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0f172a" }}>
                <th style={{ padding: "8px 16px", textAlign: "left", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", fontWeight: 500 }}>Post</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", fontWeight: 500 }}>Enhet</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", fontWeight: 500 }}>Antal</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", fontWeight: 500 }}>À-pris</th>
                <th style={{ padding: "8px 16px", textAlign: "right", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", fontWeight: 500 }}>Summa</th>
              </tr>
            </thead>
            <tbody>
              {(data.categories || []).map((cat: any, ci: number) => (
                <> 
                  <tr key={`c${ci}`}>
                    <td colSpan={5} style={{ padding: "9px 16px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#64748b", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      {cat.name}
                    </td>
                  </tr>
                  {(cat.rows || []).map((row: any, ri: number) => (
                    <tr key={`r${ci}${ri}`}>
                      <td style={{ padding: "9px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 13, color: "#1e293b" }}>
                        {row.description}
                        {row.note && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{row.note}</div>}
                      </td>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 12, color: "#94a3b8", textAlign: "center" }}>{row.unit}</td>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 13, textAlign: "right", color: "#334155" }}>{row.quantity}</td>
                      <td style={{ padding: "9px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 13, textAlign: "right", color: "#334155", fontFamily: "monospace" }}>{fmtKr(row.unit_price)}</td>
                      <td style={{ padding: "9px 16px", borderBottom: "1px solid #f1f5f9", fontSize: 13, textAlign: "right", fontWeight: 600, color: "#0f172a", fontFamily: "monospace" }}>{fmtKr(row.total)}</td>
                    </tr>
                  ))}
                  <tr key={`sub${ci}`}>
                    <td colSpan={4} style={{ padding: "7px 16px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#64748b", borderBottom: "2px solid #e2e8f0", background: "#f8fafc" }}>Delsumma {cat.name}</td>
                    <td style={{ padding: "7px 16px", textAlign: "right", fontSize: 12, fontWeight: 700, color: "#0f172a", borderBottom: "2px solid #e2e8f0", background: "#f8fafc", fontFamily: "monospace" }}>{fmtKr(cat.subtotal)}</td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── SUMMERING ─────────────────────────────────────────────────── */}
        <div style={cardPad}>
          <div style={{ maxWidth: 320, marginLeft: "auto" }}>
            <SumRow label="Material"       value={fmtKr(t.material_total  || 0)} />
            <SumRow label="Arbete"         value={fmtKr(t.labor_total     || 0)} />
            {(t.equipment_total || 0) > 0 && <SumRow label="Utrustning" value={fmtKr(t.equipment_total)} />}
            {(t.margin_amount   || 0) > 0 && <SumRow label="Påslag"     value={fmtKr(t.margin_amount)} />}
            <SumRow label="Summa exkl. moms" value={fmtKr(t.total_ex_vat || 0)} />
            <SumRow label="Moms 25%"         value={fmtKr(t.vat          || 0)} />
            <SumRow label="Totalt inkl. moms" value={fmtKr(t.total_inc_vat || 0)} big />
            {(t.rot_deduction || 0) > 0 && (
              <>
                <SumRow label="ROT-avdrag (30% på arbete)" value={`−${fmtKr(t.rot_deduction)}`} green />
                <SumRow label="Att betala" value={fmtKr(t.customer_pays || t.total_inc_vat || 0)} big green />
              </>
            )}
          </div>
          {data.estimated_days && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: "#eff6ff", borderLeft: "3px solid #3b82f6", fontSize: 12, color: "#1e40af", borderRadius: "0 6px 6px 0" }}>
              Uppskattad tidsåtgång: ca {data.estimated_days} arbetsdagar
            </div>
          )}
        </div>

        {/* ── RESERVATIONER ─────────────────────────────────────────────── */}
        <div style={cardPad}>
          <p style={{ ...labelStyle, marginBottom: 8, fontSize: 13 }}>Reservationer:</p>
          <ul style={listStyle}>
            {reservationLines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>

        {/* ── FÖRUTSÄTTNINGAR & VILLKOR ─────────────────────────────────── */}
        <div style={cardPad}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>Förutsättningar & villkor</div>

          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Betalningsvillkor</div>
            <div style={bodyStyle}>{settings.payment_terms || "30 dagar."}</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Offertens giltighetstid</div>
            <div style={bodyStyle}>Offertens giltighetstid gäller {validDays} dagar från ovanstående datum.</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={labelStyle}>Tillkommande arbeten</div>
            <div style={bodyStyle}>
              Arbetad tid debiteras med {Number(hourlyRate).toLocaleString("sv-SE")},00 exkl. moms<br />
              Underentreprenörers arbeten debiteras mot redovisad kostnad +12%<br />
              Material debiteras mot redovisad kostnad +12%
            </div>
          </div>

          {settings.quote_footer && (
            <div style={{ marginBottom: 16 }}>
              <div style={labelStyle}>Övriga villkor</div>
              <div style={bodyStyle}>{settings.quote_footer.split("\n").map((l: string, i: number) => <span key={i}>{l}<br /></span>)}</div>
            </div>
          )}

          <div style={{ marginBottom: 0 }}>
            <div style={labelStyle}>Personuppgifter</div>
            <div style={{ ...bodyStyle, color: "#475569" }}>
              Vid godkännande av denna offert accepterar du att vi behandlar dina personuppgifter för att kunna fullfölja vårt åtagande gentemot dig som kund.
              Den information vi behandlar för er är information som berörs och är nödvändig för byggprojektets administration.
              Personuppgifterna lagras och hanteras med tekniska och organisatoriska säkerhetsåtgärder för att skydda hanteringen av personuppgifter
              och lever upp till de krav som ställs enligt EU:s dataskyddsförordning (GDPR).
              <br /><br />
              Vi kommer om ni begär det att radera eller anonymisera och oavsett anledning därtill, inklusive att radera samtliga kopior som inte enligt GDPR
              måste sparas. Vi kommer inte att överföra personuppgifter till land utanför EU/ESS.
            </div>
          </div>
        </div>

        {/* ── GODKÄNN-KNAPP NERE ─────────────────────────────────────────── */}
        <div style={{ ...cardPad, textAlign: "center" }}>
          {accepted ? (
            <div>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a", marginBottom: 6 }}>Offerten är godkänd!</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                {companyName} har fått en notifikation och återkommer med nästa steg.
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Godkänn denna offert?</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
                Genom att klicka nedan godkänner du offerten och arbetet kan påbörjas.
              </div>
              {error && (
                <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <button
                onClick={handleAccept}
                disabled={accepting}
                style={{ padding: "14px 44px", background: "#0f172a", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: accepting ? 0.5 : 1 }}
              >
                {accepting ? "Godkänner..." : "Godkänn offert"}
              </button>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 12 }}>
                Offert giltig t.o.m {validUntil}
              </div>
            </div>
          )}
        </div>

        {/* ── SIDFOT ───────────────────────────────────────────────────────── */}
        <div style={{ borderTop: "2px solid #6a8193", paddingTop: 14, marginTop: 8, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
          <div>
            <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 12, marginBottom: 2 }}>{companyName}</div>
            {settings.org_number && <div>Org.nr: {settings.org_number}</div>}
            {settings.f_skatt   && <div>Godkänd för F-skatt</div>}
            {settings.address   && <div>{settings.address}{settings.zip_city ? `, ${settings.zip_city}` : ""}</div>}
          </div>
          <div style={{ textAlign: "center" }}>
            {settings.phone   && <div>Tel: {settings.phone}</div>}
            {settings.email   && <div>{settings.email}</div>}
            {settings.website && <div>{settings.website}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            {settings.bankgiro && <div>Bankgiro: {settings.bankgiro}</div>}
            {settings.plusgiro && <div>Plusgiro: {settings.plusgiro}</div>}
            {settings.iban     && <div>IBAN: {settings.iban}</div>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function AcceptPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#f1f5f9" }} />}>
      <AcceptInner />
    </Suspense>
  );
}
