"use client";

import { useState } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { createEstimate } from "@/lib/api";
import { saveEstimate } from "@/lib/store";

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

export default function EstimatePage() {
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

  function handleReset() {
    setStep("input");
    setResult(null);
    setDescription("");
    setJobType("");
    setAreaSqm("");
    setSaved(false);
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
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={handleReset}>Ny kalkyl</button>
          <button className={`btn ${saved ? "btn-secondary" : "btn-primary"}`} onClick={handleSave} disabled={saved}>
            {saved ? "✓ Sparad" : "Spara kalkyl"}
          </button>
        </div>
      </div>

      {/* Estimate table */}
      <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
        <table className="est-table">
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Post</th>
              <th>Enhet</th>
              <th className="right">Antal</th>
              <th className="right">À-pris</th>
              <th className="right">Summa</th>
            </tr>
          </thead>
          <tbody>
            {(result.categories || []).map((cat: any, ci: number) => (
              <>
                <tr key={`cat-${ci}`} className="est-cat-row">
                  <td colSpan={5}>{cat.name}</td>
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
                  </tr>
                ))}
                <tr className="est-subtotal">
                  <td colSpan={4} style={{ textAlign: "right" }}>Delsumma {cat.name}</td>
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

      {/* Estimated time */}
      {result.estimated_days && (
        <div className="info-box" style={{ marginTop: 16 }}>
          Uppskattad tidsåtgång: ca {result.estimated_days} arbetsdagar
        </div>
      )}

      {/* Warnings */}
      {result.warnings?.length > 0 && (
        <div className="warning-box" style={{ marginTop: 12 }}>
          <strong>Observera:</strong>
          <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
            {result.warnings.map((w: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Assumptions */}
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
