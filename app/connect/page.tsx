"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { uploadAnalyze, uploadAnalyzeWithMapping } from "@/lib/api";
import { savePack } from "@/lib/store";

const MAPPING_FIELDS = [
  { key: "period",       label: "Period",         required: true  },
  { key: "account",      label: "Konto",          required: true  },
  { key: "actual",       label: "Utfall",         required: true  },
  { key: "budget",       label: "Budget",         required: false },
  { key: "account_name", label: "Kontonamn",      required: false },
  { key: "entity",       label: "Bolag",          required: false },
  { key: "cost_center",  label: "Kostnadsställe", required: false },
  { key: "project",      label: "Projekt",        required: false },
] as const;

const REQUIRED = MAPPING_FIELDS.filter((f) => f.required).map((f) => f.key);

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 13, height: 13, flexShrink: 0,
      border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff",
      borderRadius: "50%", animation: "nsSpin .7s linear infinite",
    }} />
  );
}

export default function ConnectPage() {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file,     setFile]     = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [mapping,  setMapping]  = useState<Record<string, string>>({});
  const [error,    setError]    = useState<string | null>(null);
  const [aiState,  setAiState]  = useState<"idle" | "running" | "done">("idle");
  const [saving,   setSaving]   = useState(false);
  const [dragging, setDragging] = useState(false);

  function handleFile(f: File | null) {
    setFile(f);
    setError(null);
    setAnalysis(null);
    setMapping({});
    setAiState("idle");
  }

  async function runAiMapping() {
    if (!file) return;
    setError(null);
    setAiState("running");
    try {
      const res = await uploadAnalyze(file);
      setAnalysis(res);
      const auto: Record<string, string> = {};
      for (const f of MAPPING_FIELDS) {
        const suggestions = res.column_suggestions?.[f.key] ?? [];
        if (suggestions.length > 0) auto[f.key] = suggestions[0];
      }
      setMapping(auto);
      setAiState("done");
    } catch (e: any) {
      setError(e.message || "Något gick fel vid filanalysen.");
      setAiState("idle");
    }
  }

  async function runAnalysis() {
    if (!file) return;
    setError(null);
    setSaving(true);
    try {
      const pack = await uploadAnalyzeWithMapping(file, mapping);
      savePack(pack);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message || "Analys med mappning misslyckades.");
    } finally {
      setSaving(false);
    }
  }

  const reqMapped      = REQUIRED.filter((k) => mapping[k]).length;
  const totalMapped    = MAPPING_FIELDS.filter((f) => mapping[f.key]).length;
  const allRequiredMet = reqMapped === REQUIRED.length;
  const previewCols    = (analysis?.available_columns ?? []).slice(0, 8) as string[];

  return (
    <ProtectedLayout>
      <style>{`@keyframes nsSpin { to { transform: rotate(360deg); } }`}</style>
      <Header reportCount={0} />

      <div className="ns-page">
        <div className="ns-hero">
          <div className="ns-hero-title">Importera data</div>
          <div className="ns-hero-sub">
            Ladda upp Excel eller CSV, kontrollera kolumnmapping och kör analys.
          </div>
        </div>

        {error && (
          <div className="ns-error-banner" role="alert">
            <strong>Något gick fel:</strong> {error}
          </div>
        )}

        <div
          className={`ns-dropzone${dragging ? " dragging" : ""}${file ? " has-file" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0] ?? null); }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="ns-dropzone-file">
              <span className="ns-dropzone-icon">📄</span>
              <div>
                <div className="ns-dropzone-filename">{file.name}</div>
                <div className="ns-dropzone-filesize">
                  {(file.size / 1024).toFixed(0)} KB — klicka för att byta fil
                </div>
              </div>
            </div>
          ) : (
            <div className="ns-dropzone-empty">
              <span className="ns-dropzone-icon">⬆</span>
              <div className="ns-dropzone-label">Dra och släpp fil här</div>
              <div className="ns-dropzone-sub">eller klicka för att välja — CSV, XLSX, XLS</div>
            </div>
          )}
        </div>

        {file && aiState === "idle" && (
          <button className="ns-btn-primary" onClick={runAiMapping}
            style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 14 }}>✦</span> Kör AI mapping
          </button>
        )}

        {file && aiState === "running" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "9px 14px", borderRadius: "var(--radius)",
            background: "var(--accent-soft)", border: "0.5px solid var(--accent-border)",
            color: "var(--accent-text)", fontSize: 12,
          }}>
            <Spinner /> AI analyserar kolumner...
          </div>
        )}

        {analysis && aiState === "done" && (
          <>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 14px", borderRadius: "var(--radius)",
              background: "var(--green-soft)", border: "0.5px solid rgba(34,197,94,0.2)",
              color: "var(--green)", fontSize: 12,
            }}>
              <span>✓</span>
              AI mappade {totalMapped} av {MAPPING_FIELDS.length} fält — granska och justera vid behov
              <button onClick={runAiMapping} style={{
                marginLeft: "auto", background: "transparent", fontFamily: "inherit",
                border: "0.5px solid var(--border-strong)", borderRadius: "var(--radius)",
                color: "var(--text-muted)", fontSize: 11, padding: "3px 10px", cursor: "pointer",
              }}>
                ↺ Kör om
              </button>
            </div>

            <div className="ns-mapping-card">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8,
                  fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>
                  Kolumnmapping
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20,
                    background: "var(--green-soft)", color: "var(--green)",
                  }}>
                    {totalMapped}/{MAPPING_FIELDS.length} mappade
                  </span>
                </div>
                <div className="ns-mapping-sub">
                  Vi föreslog kolumner automatiskt — justera vid behov.{" "}
                  <span style={{ color: "var(--accent-text)" }}>●</span> = obligatorisk
                </div>
              </div>

              <div className="ns-mapping-grid">
                {MAPPING_FIELDS.map((field) => {
                  const val      = mapping[field.key] ?? "";
                  const isMapped = !!val;
                  const borderColor = isMapped
                    ? "rgba(34,197,94,0.4)"
                    : field.required ? "rgba(239,68,68,0.4)" : "var(--border-strong)";
                  return (
                    <div key={field.key} className="ns-mapping-row">
                      <div style={{ display: "flex", alignItems: "center",
                        justifyContent: "space-between", marginBottom: 4 }}>
                        <label className="ns-mapping-label">{field.label}</label>
                        {field.required
                          ? <span style={{ width: 5, height: 5, borderRadius: "50%",
                              background: "var(--accent)", flexShrink: 0 }} />
                          : <span style={{ fontSize: 10, color: "var(--text-faint)" }}>valfri</span>}
                      </div>
                      <select
                        className="ns-mapping-select"
                        style={{ borderColor, background: isMapped ? "rgba(34,197,94,0.04)" : "var(--bg-surface)" }}
                        value={val}
                        onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
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

              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                paddingTop: 14, borderTop: "0.5px solid var(--border-mid)",
              }}>
                <span style={{ fontSize: 12, color: allRequiredMet ? "var(--green)" : "var(--red)" }}>
                  {allRequiredMet
                    ? "✓ Alla obligatoriska fält är mappade"
                    : `Saknas: ${REQUIRED.length - reqMapped} obligatoriska fält`}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button onClick={() => handleFile(null)} style={{
                    height: 34, padding: "0 14px", borderRadius: "var(--radius)",
                    border: "0.5px solid var(--border-strong)", background: "transparent",
                    color: "var(--text-muted)", fontSize: 12, fontWeight: 500,
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    Byt fil
                  </button>
                  <button
                    className="ns-btn-primary"
                    onClick={runAnalysis}
                    disabled={!allRequiredMet || saving}
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                  >
                    {saving ? <><Spinner /> Kör analys...</> : "Kör analys →"}
                  </button>
                </div>
              </div>
            </div>

            {analysis.preview?.length > 0 && (
              <div style={{
                background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
                borderRadius: "var(--radius-lg)", overflow: "hidden",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: ".07em",
                  textTransform: "uppercase", color: "var(--text-faint)",
                  padding: "10px 16px", borderBottom: "0.5px solid var(--border-mid)",
                }}>
                  Förhandsgranskning — {Math.min(analysis.preview.length, 5)} rader
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {previewCols.map((col) => {
                          const isMapped = Object.values(mapping).includes(col);
                          return (
                            <th key={col} style={{
                              fontSize: 10, fontWeight: 600, letterSpacing: ".07em",
                              textTransform: "uppercase",
                              color: isMapped ? "var(--green)" : "var(--text-faint)",
                              padding: "8px 14px", textAlign: "left",
                              borderBottom: "0.5px solid var(--border-mid)", whiteSpace: "nowrap",
                            }}>
                              {col}{isMapped ? " ✓" : ""}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.preview.slice(0, 5).map((row: any, i: number) => (
                        <tr key={i} style={{ borderBottom: "0.5px solid rgba(255,255,255,0.04)" }}>
                          {previewCols.map((col) => (
                            <td key={col} style={{ padding: "8px 14px", fontSize: 12, color: "var(--text-muted)" }}>
                              {String(row[col] ?? "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ProtectedLayout>
  );
}
