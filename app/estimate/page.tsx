"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { createEstimate } from "@/lib/api";
import { saveEstimate, getEstimates } from "@/lib/store";

const JOB_TYPES = [
  { id: "badrum", label: "Badrum", icon: "🚿" },
  { id: "kok", label: "Kök", icon: "🍳" },
  { id: "tak", label: "Tak", icon: "🏠" },
  { id: "fasad", label: "Fasad", icon: "🧱" },
  { id: "golv", label: "Golv", icon: "🪵" },
  { id: "malning", label: "Målning", icon: "🎨" },
  { id: "el", label: "El", icon: "⚡" },
  { id: "vvs", label: "VVS", icon: "🔧" },
  { id: "tillbyggnad", label: "Tillbyggnad", icon: "🏗️" },
  { id: "ovrigt", label: "Övrigt", icon: "📋" },
];

function fmtKr(n: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "decimal", maximumFractionDigits: 0 }).format(n) + " kr";
}

function getSettings() {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("byggkalk_settings") || "{}"); } catch { return {}; }
}

function generateQuoteHTML(result: any, settings: any) {
  const t = result.totals || {};
  const today = new Date().toLocaleDateString("sv-SE");
  const validUntil = new Date(Date.now() + 30 * 86400000).toLocaleDateString("sv-SE");

  let rowsHTML = "";
  for (const cat of result.categories || []) {
    rowsHTML += `<tr style="background:#f8f8f8"><td colspan="5" style="padding:10px 12px;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e5e5">${cat.name}</td></tr>`;
    for (const row of cat.rows || []) {
      const source = row.type === "labor" ? "Egen timpris" : "Uppskattat marknadspris";
      rowsHTML += `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px">${row.description}${row.note ? `<br><span style="font-size:11px;color:#999">${row.note}</span>` : ""}<br><span style="font-size:10px;color:#aaa;font-style:italic">Källa: ${source}</span></td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;color:#888;text-align:center">${row.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;font-family:monospace">${row.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;font-family:monospace">${fmtKr(row.unit_price)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;font-family:monospace;font-weight:600">${fmtKr(row.total)}</td>
      </tr>`;
    }
    rowsHTML += `<tr><td colspan="4" style="padding:8px 12px;text-align:right;font-weight:600;font-size:12px;border-bottom:2px solid #ddd">Delsumma ${cat.name}</td><td style="padding:8px 12px;text-align:right;font-weight:700;font-size:13px;font-family:monospace;border-bottom:2px solid #ddd">${fmtKr(cat.subtotal)}</td></tr>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offert - ${result.job_title}</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#222;font-size:14px;line-height:1.5}
@media print{body{padding:20px}}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #f59e0b">
  <div>
    <div style="font-size:24px;font-weight:800;color:#1a1a1a">${settings.company_name || "Företagsnamn"}</div>
    <div style="font-size:12px;color:#888;margin-top:4px">
      ${settings.org_number ? `Org.nr: ${settings.org_number}` : ""}
      ${settings.phone ? ` · Tel: ${settings.phone}` : ""}
      ${settings.email ? ` · ${settings.email}` : ""}
      ${settings.address ? `<br>${settings.address}` : ""}
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:20px;font-weight:700;color:#f59e0b">OFFERT</div>
    <div style="font-size:12px;color:#888;margin-top:4px">Datum: ${today}</div>
    <div style="font-size:12px;color:#888">Giltig t.o.m: ${validUntil}</div>
  </div>
</div>

<div style="margin-bottom:24px">
  <div style="font-size:18px;font-weight:700;margin-bottom:6px">${result.job_title || "Kalkyl"}</div>
  <div style="font-size:13px;color:#666">${result.job_summary || ""}</div>
</div>

<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
<thead><tr style="background:#1a1a1a;color:white">
  <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.5px">Post</th>
  <th style="padding:10px 12px;text-align:center;font-size:11px;text-transform:uppercase">Enhet</th>
  <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase">Antal</th>
  <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase">À-pris</th>
  <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase">Summa</th>
</tr></thead>
<tbody>${rowsHTML}</tbody>
</table>

<div style="max-width:350px;margin-left:auto">
  <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#666"><span>Material</span><span style="font-family:monospace">${fmtKr(t.material_total || 0)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#666"><span>Arbete</span><span style="font-family:monospace">${fmtKr(t.labor_total || 0)}</span></div>
  ${t.margin_amount ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#666"><span>Påslag (${result.meta?.margin_pct || 15}%)</span><span style="font-family:monospace">${fmtKr(t.margin_amount)}</span></div>` : ""}
  <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#666"><span>Moms (25%)</span><span style="font-family:monospace">${fmtKr(t.vat || 0)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:18px;font-weight:800;border-top:2px solid #1a1a1a;margin-top:8px"><span>Totalt inkl. moms</span><span style="font-family:monospace">${fmtKr(t.total_inc_vat || 0)}</span></div>
  ${t.rot_deduction ? `
  <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#16a34a"><span>ROT-avdrag (30% på arbete)</span><span style="font-family:monospace">−${fmtKr(t.rot_deduction)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:18px;font-weight:800;color:#16a34a;border-top:2px solid #16a34a;margin-top:4px"><span>Att betala</span><span style="font-family:monospace">${fmtKr(t.customer_pays || t.total_inc_vat || 0)}</span></div>
  ` : ""}
</div>

${result.estimated_days ? `<div style="margin-top:20px;padding:12px 16px;background:#f0f9ff;border-left:3px solid #3b82f6;font-size:13px;color:#1e40af">Uppskattad tidsåtgång: ca ${result.estimated_days} arbetsdagar</div>` : ""}

${(result.warnings || []).length > 0 ? `<div style="margin-top:16px;padding:12px 16px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:12px;color:#92400e"><strong>Observera:</strong><ul style="margin:6px 0 0 16px">${result.warnings.map((w: string) => `<li>${w}</li>`).join("")}</ul></div>` : ""}

<div style="margin-top:40px;padding-top:20px;border-top:1px solid #eee">
  <div style="font-size:11px;color:#aaa;text-align:center">
    Prisuppgifter baseras på uppskattade marknadspriser och kan variera. Slutligt pris kan justeras vid oförutsedda förhållanden.
    <br>Offerten är giltig i 30 dagar från ovanstående datum.
    ${settings.company_name ? `<br><br>${settings.company_name}${settings.org_number ? ` · Org.nr: ${settings.org_number}` : ""}` : ""}
  </div>
</div>
</body></html>`;
}

export default function EstimatePage() {
  const searchParams = useSearchParams();
  const viewId = searchParams.get("view");

  const [step, setStep] = useState<"input" | "loading" | "result">("input");
  const [jobType, setJobType] = useState("");
  const [description, setDescription] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [location, setLocation] = useState("");
  const [hourlyRate, setHourlyRate] = useState("650");
  const [marginPct, setMarginPct] = useState("15");
  const [includeRot, setIncludeRot] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [saved, setSaved] = useState(false);
  const [showSources, setShowSources] = useState(false);

  // Load saved estimate if viewing
  useEffect(() => {
    if (viewId) {
      const estimates = getEstimates();
      const found = estimates.find(e => e.id === viewId);
      if (found) {
        setResult(found.data);
        setDescription(found.description);
        setJobType(found.job_type || "");
        setSaved(true);
        setStep("result");
      }
    }
  }, [viewId]);

  // Load default settings
  useEffect(() => {
    const s = getSettings();
    if (s.hourly_rate) setHourlyRate(String(s.hourly_rate));
    if (s.margin_pct !== undefined) setMarginPct(String(s.margin_pct));
    if (s.include_rot !== undefined) setIncludeRot(s.include_rot);
  }, []);

  const loadingMessages = [
    "Analyserar jobbeskrivningen...",
    "Beräknar materialåtgång...",
    "Hämtar aktuella priser...",
    "Bygger din kalkyl...",
  ];

  async function handleGenerate() {
    if (!description.trim()) { setError("Beskriv jobbet först."); return; }
    setError("");
    setStep("loading");
    setSaved(false);

    let msgIdx = 0;
    setLoadingMsg(loadingMessages[0]);
    const interval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, loadingMessages.length - 1);
      setLoadingMsg(loadingMessages[msgIdx]);
    }, 2000);

    try {
      const data = await createEstimate({
        description: description.trim(),
        job_type: jobType || undefined,
        area_sqm: areaSqm ? parseFloat(areaSqm) : undefined,
        location: location || undefined,
        hourly_rate: parseFloat(hourlyRate) || 650,
        margin_pct: parseFloat(marginPct) || 15,
        include_rot: includeRot,
      });
      clearInterval(interval);
      setResult(data);
      setStep("result");
    } catch (e: any) {
      clearInterval(interval);
      setError(e.message || "Något gick fel.");
      setStep("input");
    }
  }

  function handleSave() {
    if (!result) return;
    saveEstimate({
      id: crypto.randomUUID(),
      created: new Date().toISOString(),
      description: result.job_title || description,
      job_type: jobType,
      total_inc_vat: result.totals?.total_inc_vat || 0,
      customer_pays: result.totals?.customer_pays || result.totals?.total_inc_vat || 0,
      data: result,
    });
    setSaved(true);
  }

  function handleDownloadQuote() {
    if (!result) return;
    const settings = getSettings();
    const html = generateQuoteHTML(result, settings);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) {
      w.onload = () => {
        setTimeout(() => { w.print(); }, 500);
      };
    }
  }

  function handleReset() {
    setStep("input");
    setResult(null);
    setDescription("");
    setJobType("");
    setAreaSqm("");
    setSaved(false);
    setShowSources(false);
    window.history.replaceState(null, "", "/estimate");
  }

  function getSourceLabel(row: any): string {
    if (row.type === "labor") return "Baserat på ditt timpris (" + (result?.meta?.hourly_rate || 650) + " kr/h)";
    if (row.type === "equipment") return "Uppskattat pris för maskin-/utrustningshyra";
    return "Uppskattat marknadspris (svenska byggvaruhandeln 2025–2026)";
  }

  // ── INPUT STEP ──
  if (step === "input") {
    return (
      <ProtectedLayout>
        <Header title="Ny kalkyl" subtitle="Beskriv jobbet — AI:n räknar ut resten" />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Jobbtyp (valfritt)</div>
          <div className="job-types">
            {JOB_TYPES.map((jt) => (
              <button key={jt.id} className={`job-type-btn${jobType === jt.id ? " active" : ""}`} onClick={() => setJobType(jobType === jt.id ? "" : jt.id)}>
                <span className="icon">{jt.icon}</span>
                <span className="name">{jt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Beskriv jobbet</div>
          <textarea
            className="input textarea"
            placeholder="T.ex: Badrumsrenovering 8 kvm. Riva befintligt kakel golv och väggar. Nytt tätskikt, klinker på golv (60x60), kakel på väggar (30x60). Ny dusch med glasvägg, ny toalett och handfat. Befintlig golvvärme behålls."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
          {error && <div className="login-error" style={{ marginTop: 10 }}>{error}</div>}
        </div>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="card card-sm">
            <label className="label">Yta (kvm)</label>
            <input className="input" type="number" placeholder="T.ex. 8" value={areaSqm} onChange={(e) => setAreaSqm(e.target.value)} />
          </div>
          <div className="card card-sm">
            <label className="label">Plats</label>
            <input className="input" placeholder="Stad eller postnr" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>

        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="card card-sm">
            <label className="label">Timpris (kr/h)</label>
            <input className="input" type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
          </div>
          <div className="card card-sm">
            <label className="label">Påslag (%)</label>
            <input className="input" type="number" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
          </div>
          <div className="card card-sm" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={includeRot} onChange={(e) => setIncludeRot(e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>ROT-avdrag</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>30% på arbete</div>
            </div>
          </div>
        </div>

        <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={handleGenerate}>
          Generera kalkyl med AI
        </button>
      </ProtectedLayout>
    );
  }

  // ── LOADING STEP ──
  if (step === "loading") {
    return (
      <ProtectedLayout>
        <div className="loading-overlay">
          <svg width="48" height="48" viewBox="0 0 100 100" fill="none">
            <rect x="8" y="40" width="20" height="52" rx="3" fill="#f59e0b" opacity="0.6"/>
            <rect x="34" y="24" width="20" height="68" rx="3" fill="#fbbf24"/>
            <rect x="60" y="8" width="20" height="84" rx="3" fill="#f59e0b" opacity="0.6"/>
          </svg>
          <div className="loading-text">{loadingMsg}</div>
          <div className="loading-bar"><div className="loading-bar-fill" /></div>
        </div>
      </ProtectedLayout>
    );
  }

  // ── RESULT STEP ──
  if (!result) return null;
  const t = result.totals || {};

  return (
    <ProtectedLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div className="page-title">{result.job_title || "Kalkyl"}</div>
          <div className="page-subtitle">{result.job_summary || description}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>Ny kalkyl</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSources(!showSources)}>
            {showSources ? "Dölj källor" : "Visa priskällor"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadQuote}>Ladda ner offert</button>
          <button className={`btn btn-sm ${saved ? "btn-secondary" : "btn-primary"}`} onClick={handleSave} disabled={saved}>
            {saved ? "✓ Sparad" : "Spara"}
          </button>
        </div>
      </div>

      {/* Price source disclaimer */}
      {showSources && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          <strong>Om priskällor:</strong> Materialpriser är uppskattade baserat på svenska marknadspriser 2025–2026 (byggvaruhandel som Beijer, Bauhaus, Byggmax). 
          Arbetskostnad baseras på ditt angivna timpris ({result.meta?.hourly_rate || 650} kr/h). 
          Priserna är uppskattningar och kan variera beroende på leverantör, region och tillgänglighet. 
          Verifiera alltid mot faktiska grossistpriser innan offert skickas till kund.
        </div>
      )}

      {/* Estimate table */}
      <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
        <table className="est-table">
          <thead>
            <tr>
              <th style={{ width: showSources ? "35%" : "40%" }}>Post</th>
              <th>Enhet</th>
              <th className="right">Antal</th>
              <th className="right">À-pris</th>
              <th className="right">Summa</th>
              {showSources && <th style={{ width: "20%" }}>Priskälla</th>}
            </tr>
          </thead>
          <tbody>
            {(result.categories || []).map((cat: any, ci: number) => (
              <>
                <tr key={`cat-${ci}`} className="est-cat-row">
                  <td colSpan={showSources ? 6 : 5}>{cat.name}</td>
                </tr>
                {(cat.rows || []).map((row: any, ri: number) => (
                  <tr key={`row-${ci}-${ri}`}>
                    <td>
                      <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{row.description}</div>
                      {row.note && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{row.note}</div>}
                    </td>
                    <td style={{ color: "var(--text-faint)" }}>{row.unit}</td>
                    <td className="right" style={{ fontFamily: "var(--mono)" }}>{row.quantity}</td>
                    <td className="right" style={{ fontFamily: "var(--mono)" }}>{fmtKr(row.unit_price)}</td>
                    <td className="right" style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{fmtKr(row.total)}</td>
                    {showSources && (
                      <td style={{ fontSize: 11, color: "var(--text-faint)", fontStyle: "italic" }}>
                        {getSourceLabel(row)}
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="est-subtotal">
                  <td colSpan={showSources ? 5 : 4} style={{ textAlign: "right" }}>Delsumma {cat.name}</td>
                  <td className="right" style={{ fontFamily: "var(--mono)" }}>{fmtKr(cat.subtotal)}</td>
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="est-total-section">
        <div className="est-total-row">
          <span className="label-text">Material</span>
          <span className="value">{fmtKr(t.material_total || 0)}</span>
        </div>
        <div className="est-total-row">
          <span className="label-text">Arbete</span>
          <span className="value">{fmtKr(t.labor_total || 0)}</span>
        </div>
        {(t.equipment_total || 0) > 0 && (
          <div className="est-total-row">
            <span className="label-text">Utrustning</span>
            <span className="value">{fmtKr(t.equipment_total)}</span>
          </div>
        )}
        <div className="est-total-row">
          <span className="label-text">Delsumma</span>
          <span className="value">{fmtKr(t.subtotal || 0)}</span>
        </div>
        {(t.margin_amount || 0) > 0 && (
          <div className="est-total-row">
            <span className="label-text">Påslag ({result.meta?.margin_pct || 15}%)</span>
            <span className="value">{fmtKr(t.margin_amount)}</span>
          </div>
        )}
        <div className="est-total-row">
          <span className="label-text">Summa exkl. moms</span>
          <span className="value">{fmtKr(t.total_ex_vat || 0)}</span>
        </div>
        <div className="est-total-row">
          <span className="label-text">Moms (25%)</span>
          <span className="value">{fmtKr(t.vat || 0)}</span>
        </div>
        <div className="est-total-row big">
          <span>Totalt inkl. moms</span>
          <span className="value">{fmtKr(t.total_inc_vat || 0)}</span>
        </div>
        {includeRot && (t.rot_deduction || 0) > 0 && (
          <>
            <div className="est-total-row" style={{ marginTop: 12 }}>
              <span className="label-text">ROT-avdrag (30% på arbete)</span>
              <span className="est-rot">−{fmtKr(t.rot_deduction)}</span>
            </div>
            <div className="est-total-row big">
              <span>Kunden betalar</span>
              <span className="value" style={{ color: "var(--green)" }}>{fmtKr(t.customer_pays || t.total_inc_vat || 0)}</span>
            </div>
          </>
        )}
      </div>

      {result.estimated_days && (
        <div className="info-box" style={{ marginTop: 16 }}>
          Uppskattad tidsåtgång: ca {result.estimated_days} arbetsdagar
        </div>
      )}

      {result.warnings?.length > 0 && (
        <div className="warning-box" style={{ marginTop: 12 }}>
          <strong>Observera:</strong>
          <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
            {result.warnings.map((w: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
          </ul>
        </div>
      )}

      {result.assumptions?.length > 0 && (
        <div style={{ marginTop: 12, padding: "12px 16px", background: "var(--bg-elevated)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text-secondary)" }}>Antaganden:</strong>
          <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
            {result.assumptions.map((a: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{a}</li>)}
          </ul>
        </div>
      )}
    </ProtectedLayout>
  );
}
