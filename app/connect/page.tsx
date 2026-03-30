"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { uploadAnalyze, uploadAnalyzeWithMapping } from "@/lib/api";
import { savePack, saveFileMeta, getFileMeta, clearAll, FileMeta } from "@/lib/store";

const MAPPING_FIELDS = [
  { key: "period",       label: "Period",         required: true,  hint: "Datum eller månad, t.ex. 2024-01 eller Jan-24" },
  { key: "account",      label: "Konto",          required: true,  hint: "Kontonummer, t.ex. 3000 eller 5010" },
  { key: "actual",       label: "Utfall",         required: true,  hint: "Faktiskt belopp / bokfört värde" },
  { key: "budget",       label: "Budget",         required: false, hint: "Budgeterat belopp för perioden" },
  { key: "account_name", label: "Kontonamn",      required: false, hint: "Beskrivning av kontot, t.ex. Personalkostnader" },
  { key: "entity",       label: "Bolag",          required: false, hint: "Bolag eller legal enhet" },
  { key: "cost_center",  label: "Kostnadsställe", required: false, hint: "Kostnadsställe eller avdelning" },
  { key: "project",      label: "Projekt",        required: false, hint: "Projektkod eller projektnamn" },
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

function FileChip({ meta, onRemove }: { meta: FileMeta; onRemove: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: "var(--radius-lg)",
      background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
      marginBottom: 4,
    }}>
      <span style={{ fontSize: 18 }}>📄</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {meta.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
          {meta.sizeKb} KB · analyserad {meta.uploadedAt}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          background: "var(--green-soft)", color: "var(--green)",
          border: "0.5px solid rgba(34,197,94,0.2)", letterSpacing: ".04em",
        }}>✓ AKTIV</span>
        <button onClick={onRemove} style={{
          height: 26, padding: "0 10px", borderRadius: "var(--radius)",
          border: "0.5px solid var(--border-strong)", background: "transparent",
          color: "var(--text-faint)", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
        }}>
          Ta bort
        </button>
      </div>
    </div>
  );
}

export default function ConnectPage() {
  const router   = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file,        setFile]        = useState<File | null>(null);
  const [analysis,    setAnalysis]    = useState<any>(null);
  const [mapping,     setMapping]     = useState<Record<string, string>>({});
  const [error,       setError]       = useState<string | null>(null);
  const [aiState,     setAiState]     = useState<"idle" | "running" | "done">("idle");
  const [saving,      setSaving]      = useState(false);
  const [dragging,    setDragging]    = useState(false);
  const [savedMeta,   setSavedMeta]   = useState<FileMeta | null>(null);
  const [hintField,   setHintField]   = useState<string | null>(null);

  // Load persisted file meta on mount
  useEffect(() => {
    setSavedMeta(getFileMeta());
  }, []);

  function handleFile(f: File | null) {
    setFile(f);
    setError(null);
    setAnalysis(null);
    setMapping({});
    setAiState("idle");
  }

  function handleRemoveFile() {
    clearAll();
    setSavedMeta(null);
    setFile(null);
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

      // Smart mapping: score each available column against each field
      const auto: Record<string, string> = {};
      const cols: string[] = res.available_columns ?? [];
      const preview: Record<string, any>[] = res.preview ?? [];

      // Build a scored mapping
      for (const field of MAPPING_FIELDS) {
        const suggestions = res.column_suggestions?.[field.key] ?? [];
        if (suggestions.length > 0) {
          auto[field.key] = suggestions[0];
          continue;
        }
        // Fallback: fuzzy match column names to field key/label
        const best = smartMatch(field.key, field.label, cols, preview);
        if (best) auto[field.key] = best;
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
      const meta: FileMeta = {
        name: file.name,
        sizeKb: Math.round(file.size / 1024),
        uploadedAt: new Date().toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      };
      saveFileMeta(meta);
      setSavedMeta(meta);
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
            Ladda upp Excel eller CSV — AI mappar kolumnerna automatiskt.
          </div>
        </div>

        {/* ── Active file chip ── */}
        {savedMeta && !file && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".07em",
              textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 8 }}>
              Aktiv fil
            </div>
            <FileChip meta={savedMeta} onRemove={handleRemoveFile} />
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <button
                className="ns-btn-primary"
                onClick={() => router.push("/dashboard")}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                Gå till Dashboard →
              </button>
              <button
                onClick={() => inputRef.current?.click()}
                style={{
                  height: 34, padding: "0 14px", borderRadius: "var(--radius)",
                  border: "0.5px solid var(--border-strong)", background: "transparent",
                  color: "var(--text-muted)", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Byt fil
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="ns-error-banner" role="alert">
            <strong>Något gick fel:</strong> {error}
          </div>
        )}

        {/* ── Drop zone (only when no saved file or actively replacing) ── */}
        {(!savedMeta || file) && (
          <div
            className={`ns-dropzone${dragging ? " dragging" : ""}${file ? " has-file" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0] ?? null); }}
            onClick={() => !file && inputRef.current?.click()}
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
                    {(file.size / 1024).toFixed(0)} KB —{" "}
                    <span style={{ cursor: "pointer", textDecoration: "underline" }}
                      onClick={(e) => { e.stopPropagation(); handleFile(null); }}>
                      byt fil
                    </span>
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
        )}

        {/* ── AI mapping button ── */}
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
            <Spinner /> AI analyserar kolumner och format...
          </div>
        )}

        {/* ── Mapping card ── */}
        {analysis && aiState === "done" && (
          <>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 14px", borderRadius: "var(--radius)",
              background: "var(--green-soft)", border: "0.5px solid rgba(34,197,94,0.2)",
              color: "var(--green)", fontSize: 12,
            }}>
              <span>✓</span>
              AI mappade {totalMapped} av {MAPPING_FIELDS.length} fält
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
                  fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  Kolumnmapping
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20,
                    background: "var(--green-soft)", color: "var(--green)",
                  }}>
                    {totalMapped}/{MAPPING_FIELDS.length} mappade
                  </span>
                </div>
                <div className="ns-mapping-sub">
                  Välj vilken kolumn i din fil som motsvarar varje fält.
                  Håll muspekaren över ett fältnamn för att se tips.
                  <span style={{ color: "var(--accent)", marginLeft: 5 }}>●</span> = obligatorisk
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
                        justifyContent: "space-between", marginBottom: 4, position: "relative" }}>
                        <label
                          className="ns-mapping-label"
                          style={{ cursor: "help" }}
                          onMouseEnter={() => setHintField(field.key)}
                          onMouseLeave={() => setHintField(null)}
                        >
                          {field.label}
                          {field.required
                            ? <span style={{ width: 5, height: 5, borderRadius: "50%",
                                background: "var(--accent)", display: "inline-block",
                                marginLeft: 5, verticalAlign: "middle" }} />
                            : <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 4 }}>valfri</span>}
                        </label>
                        {hintField === field.key && (
                          <div style={{
                            position: "absolute", top: "100%", left: 0, zIndex: 10,
                            background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
                            borderRadius: "var(--radius)", padding: "6px 10px",
                            fontSize: 11, color: "var(--text-muted)", maxWidth: 220,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.4)", marginTop: 4,
                          }}>
                            {field.hint}
                          </div>
                        )}
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
                      {/* Show example value from preview */}
                      {val && analysis.preview?.[0]?.[val] !== undefined && (
                        <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 3 }}>
                          ex: <span style={{ color: "var(--text-muted)" }}>{String(analysis.preview[0][val])}</span>
                        </div>
                      )}
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
                    Avbryt
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

            {/* Preview table */}
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
                          const fieldName = MAPPING_FIELDS.find(f => mapping[f.key] === col)?.label;
                          return (
                            <th key={col} style={{
                              fontSize: 10, fontWeight: 600, letterSpacing: ".07em",
                              textTransform: "uppercase",
                              color: isMapped ? "var(--green)" : "var(--text-faint)",
                              padding: "8px 14px", textAlign: "left",
                              borderBottom: "0.5px solid var(--border-mid)", whiteSpace: "nowrap",
                            }}>
                              {col}
                              {isMapped && <span style={{ opacity: 0.7, marginLeft: 4 }}>→ {fieldName}</span>}
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

// ── Smart column matcher ────────────────────────────────────────────
function smartMatch(
  fieldKey: string,
  fieldLabel: string,
  cols: string[],
  preview: Record<string, any>[]
): string | null {
  const SYNONYMS: Record<string, string[]> = {
    period:       ["period","month","månad","date","datum","year","år","period","month_name",
                   "monthname","yearmonth","fiscal","faktura","bokföringsmånad","bokföringsdatum",
                   "transdate","trans_date","accounting_period","per"],
    account:      ["account","konto","kontonr","account_id","gl","glcode","gl_code","account_no",
                   "accountno","acc","acct","kontonummer","account_number","cost_account",
                   "huvudkonto","account_code"],
    account_name: ["account_name","kontonamn","name","description","descr","desc","benämning",
                   "text","label","account_desc","account_description","kontotext","gl_name",
                   "rubrik","category","kategori"],
    actual:       ["actual","utfall","fact","verklig","bokfört","belopp","amount","value","värde",
                   "actuals","outcome","utfall_sek","actual_amount","saldo","balance","summa",
                   "sum","total","kr","sek","netto"],
    budget:       ["budget","plan","planned","bud","target","mål","budget_amount","bud_amount",
                   "planerat","budgeterat","forecast","fc"],
    entity:       ["entity","bolag","company","legal","enhet","org","organisation","organization",
                   "company_name","legal_entity","subsidiary","dotterbolag","affärsområde"],
    cost_center:  ["cost_center","costcenter","cc","kostnadsställe","resultatenhet","department",
                   "dept","avdelning","ks","division","profit_center","profitcenter","enhet"],
    project:      ["project","projekt","proj","project_id","project_code","projectcode",
                   "project_name","projektnamn","proj_id"],
  };

  const synonyms = SYNONYMS[fieldKey] ?? [];
  const colsLower = cols.map((c) => ({ orig: c, lower: c.toLowerCase().replace(/[\s_\-\.]/g, "") }));

  // 1. Exact match (case-insensitive, ignore separators)
  const fieldClean = fieldKey.replace(/[\s_\-\.]/g, "");
  for (const { orig, lower } of colsLower) {
    if (lower === fieldClean) return orig;
  }

  // 2. Synonym match
  for (const syn of synonyms) {
    const synClean = syn.replace(/[\s_\-\.]/g, "");
    for (const { orig, lower } of colsLower) {
      if (lower === synClean || lower.includes(synClean) || synClean.includes(lower)) {
        return orig;
      }
    }
  }

  // 3. Content-based heuristic using preview values
  if (preview.length > 0) {
    for (const { orig } of colsLower) {
      const sampleVals = preview.slice(0, 5).map((r) => String(r[orig] ?? "")).filter(Boolean);
      if (fieldKey === "period" && sampleVals.some(looksLikePeriod)) return orig;
      if (fieldKey === "account" && sampleVals.some(looksLikeAccount)) return orig;
      if ((fieldKey === "actual" || fieldKey === "budget") && sampleVals.every(looksLikeNumber) && sampleVals.length >= 3) return orig;
    }
  }

  return null;
}

function looksLikePeriod(v: string): boolean {
  return /^\d{4}-\d{2}$/.test(v) ||
         /^\d{4}-\d{2}-\d{2}/.test(v) ||
         /^(jan|feb|mar|apr|maj|jun|jul|aug|sep|okt|nov|dec)/i.test(v) ||
         /^(january|february|march|april|may|june|july|august|september|october|november|december)/i.test(v) ||
         /^Q[1-4]\s?\d{4}/.test(v) ||
         /^\d{6}$/.test(v); // YYYYMM
}

function looksLikeAccount(v: string): boolean {
  return /^\d{4,6}$/.test(v.trim()); // typical account numbers
}

function looksLikeNumber(v: string): boolean {
  const cleaned = v.replace(/[\s,\.kr SEK]/gi, "").replace(",", ".");
  return !isNaN(Number(cleaned)) && cleaned.length > 0;
}
