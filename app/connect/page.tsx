"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { uploadAnalyzeWithMapping } from "@/lib/api";
import { savePack } from "@/lib/store";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

const MAPPING_LABELS: Record<string, string> = {
  period:       "Period",
  account:      "Konto",
  actual:       "Utfall",
  budget:       "Budget",
  entity:       "Bolag",
  cost_center:  "Kostnadsställe",
  project:      "Projekt",
  account_name: "Kontonamn",
};

const MAPPING_REQUIRED = ["period", "account", "actual"];

type MappingSource = "ai" | "keyword" | "none";

function Steps({ current }: { current: number }) {
  const steps = ["Ladda upp", "AI-mappning", "Kör analys"];
  return (
    <div className="connect-steps">
      {steps.map((label, i) => (
        <div key={i} className={`connect-step ${i + 1 === current ? "active" : i + 1 < current ? "done" : ""}`}>
          <div className="connect-step-circle">
            {i + 1 < current ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <span>{i + 1}</span>
            )}
          </div>
          <span className="connect-step-label">{label}</span>
          {i < steps.length - 1 && <div className="connect-step-line" />}
        </div>
      ))}
    </div>
  );
}

function SourceBadge({ source }: { source: MappingSource }) {
  if (source === "ai")      return <span className="map-badge map-badge-ai">AI</span>;
  if (source === "keyword") return <span className="map-badge map-badge-kw">Auto</span>;
  return <span className="map-badge map-badge-none">Manuell</span>;
}

export default function ConnectPage() {
  const router = useRouter();
  const [step,      setStep]      = useState(1);
  const [file,      setFile]      = useState<File | null>(null);
  const [dragging,  setDragging]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [analysis,  setAnalysis]  = useState<any>(null);
  const [mapping,   setMapping]   = useState<Record<string, string>>({});
  const [mapSource, setMapSource] = useState<Record<string, MappingSource>>({});
  const [aiUsed,    setAiUsed]    = useState(false);

  function handleFile(f: File | null) {
    setFile(f); setError(null); setAnalysis(null); setStep(1);
  }

  async function analyzeWithAI() {
    if (!file) return;
    setError(null); setAiLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/api/ai-map`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAnalysis(data);
      setMapping(data.mapping || {});
      setMapSource(data.mapping_source || {});
      setAiUsed(data.ai_used || false);
      setStep(2);
    } catch (e: any) {
      setError(e.message || "Något gick fel vid AI-analys.");
    } finally {
      setAiLoading(false);
    }
  }

  async function runAnalysis() {
    if (!file) return;
    setError(null); setLoading(true);
    try {
      const pack = await uploadAnalyzeWithMapping(file, mapping);
      savePack(pack);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message || "Analys misslyckades.");
      setLoading(false);
    }
  }

  const requiredMapped = MAPPING_REQUIRED.every((f) => mapping[f]);
  const mappedCount    = Object.values(mapping).filter(Boolean).length;
  const totalFields    = Object.keys(MAPPING_LABELS).length;

  return (
    <ProtectedLayout>
      <Header reportCount={0} />
      <div className="ns-page">
        <div className="connect-header">
          <div>
            <div className="ns-hero-title">Importera data</div>
            <div className="ns-hero-sub">AI mappar dina kolumner automatiskt</div>
          </div>
          <Steps current={step} />
        </div>

        {error && (
          <div className="ns-error-banner" role="alert">
            <strong>Fel:</strong> {error}
          </div>
        )}

        {step === 1 && (
          <div className="connect-upload-area">
            <div
              className={`ns-dropzone${dragging ? " dragging" : ""}${file ? " has-file" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0] || null); }}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input id="file-input" type="file" accept=".csv,.xlsx,.xls"
                style={{ display: "none" }} onChange={(e) => handleFile(e.target.files?.[0] || null)} />
              {file ? (
                <div className="ns-dropzone-file">
                  <div className="connect-file-icon">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M4 2h8l4 4v12a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                      <path d="M12 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <div className="ns-dropzone-filename">{file.name}</div>
                    <div className="ns-dropzone-filesize">{(file.size / 1024).toFixed(0)} KB · klicka för att byta</div>
                  </div>
                </div>
              ) : (
                <div className="ns-dropzone-empty">
                  <div className="connect-upload-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M12 16V8M12 8l-3 3M12 8l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 16v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="ns-dropzone-label">Dra och släpp fil här</div>
                  <div className="ns-dropzone-sub">CSV, XLSX eller XLS</div>
                </div>
              )}
            </div>

            {file && (
              <button className="connect-ai-btn" onClick={analyzeWithAI} disabled={aiLoading}>
                {aiLoading ? (
                  <><div className="connect-spinner" />AI analyserar kolumner...</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z" fill="currentColor"/>
                  </svg>Analysera med AI</>
                )}
              </button>
            )}
          </div>
        )}

        {step === 2 && analysis && (
          <div className="connect-mapping-area">
            <div className={`connect-ai-banner ${aiUsed ? "ai-success" : "ai-fallback"}`}>
              <div className="connect-ai-banner-icon">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z" fill="currentColor"/>
                </svg>
              </div>
              <div>
                <div className="connect-ai-banner-title">
                  {aiUsed ? "AI mappade dina kolumner" : "Automatisk mappning"}
                </div>
                <div className="connect-ai-banner-sub">
                  {mappedCount} av {totalFields} kolumner identifierades — granska och justera vid behov.
                </div>
              </div>
              <span className="connect-stat-pill">{mappedCount}/{totalFields} mappade</span>
            </div>

            <div className="connect-map-card">
              <div className="connect-map-header">
                <div className="connect-map-title">Kolumnmapping</div>
                <div className="connect-map-sub">Fält markerade med * krävs</div>
              </div>

              <div className="connect-map-grid">
                {Object.keys(MAPPING_LABELS).map((field) => {
                  const required = MAPPING_REQUIRED.includes(field);
                  const source   = mapSource[field] as MappingSource || "none";
                  const val      = mapping[field] || "";
                  const missing  = required && !val;
                  return (
                    <div key={field} className={`connect-map-row${missing ? " missing" : ""}`}>
                      <div className="connect-map-field">
                        <span className="connect-map-label">
                          {MAPPING_LABELS[field]}
                          {required && <span className="connect-map-required">*</span>}
                        </span>
                        <SourceBadge source={source} />
                      </div>
                      <select
                        className={`connect-map-select${missing ? " select-error" : val ? " select-ok" : ""}`}
                        value={val}
                        onChange={(e) => {
                          setMapping((p) => ({ ...p, [field]: e.target.value }));
                          setMapSource((p) => ({ ...p, [field]: "none" }));
                        }}
                      >
                        <option value="">— välj kolumn —</option>
                        {analysis.available_columns.map((col: string) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {analysis.preview?.length > 0 && (
                <div className="connect-preview">
                  <div className="connect-preview-label">Förhandsvisning</div>
                  <div className="connect-preview-scroll">
                    <table className="connect-preview-table">
                      <thead>
                        <tr>{analysis.available_columns.slice(0, 8).map((col: string) => <th key={col}>{col}</th>)}</tr>
                      </thead>
                      <tbody>
                        {analysis.preview.slice(0, 3).map((row: any, i: number) => (
                          <tr key={i}>
                            {analysis.available_columns.slice(0, 8).map((col: string) => (
                              <td key={col}>{String(row[col] ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="connect-actions">
              <button className="connect-back-btn" onClick={() => { setStep(1); setAnalysis(null); }}>
                ← Byt fil
              </button>
              <button className="connect-run-btn" onClick={runAnalysis} disabled={loading || !requiredMapped}>
                {loading ? <><div className="connect-spinner" />Kör analys...</> : "Kör analys →"}
              </button>
            </div>
            {!requiredMapped && (
              <div className="connect-warning">Period, Konto och Utfall måste mappas.</div>
            )}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
