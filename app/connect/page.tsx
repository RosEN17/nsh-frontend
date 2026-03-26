"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { uploadAnalyze, uploadAnalyzeWithMapping } from "@/lib/api";
import { savePack } from "@/lib/store";

export default function ConnectPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [mapping, setMapping] = useState<any>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);

  function handleFile(f: File | null) {
    setFile(f);
    setError(null);
    setAnalysis(null);
  }

  async function analyzeFile() {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const res = await uploadAnalyze(file);
      setAnalysis(res);
      setMapping({
        period:       res.column_suggestions.period?.[0]       || "",
        account:      res.column_suggestions.account?.[0]      || "",
        actual:       res.column_suggestions.actual?.[0]       || "",
        budget:       res.column_suggestions.budget?.[0]       || "",
        entity:       res.column_suggestions.entity?.[0]       || "",
        cost_center:  res.column_suggestions.cost_center?.[0]  || "",
        project:      res.column_suggestions.project?.[0]      || "",
        account_name: "",
      });
    } catch (e: any) {
      setError(e.message || "Något gick fel vid filanalysen.");
    } finally {
      setLoading(false);
    }
  }

  async function runMappedAnalysis() {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const pack = await uploadAnalyzeWithMapping(file, mapping);
      savePack(pack);
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message || "Analys med mappning misslyckades.");
    } finally {
      setLoading(false);
    }
  }

  const mappingLabels: Record<string, string> = {
    period:       "Period",
    account:      "Konto",
    actual:       "Utfall",
    budget:       "Budget",
    entity:       "Bolag",
    cost_center:  "Kostnadsställe",
    project:      "Projekt",
    account_name: "Kontonamn",
  };

  return (
    <ProtectedLayout>
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

        {/* File drop zone */}
        <div
          className={`ns-dropzone${dragging ? " dragging" : ""}${file ? " has-file" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0] || null);
          }}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
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

        {file && !analysis && (
          <button
            className="ns-btn-primary"
            onClick={analyzeFile}
            disabled={loading}
          >
            {loading ? "Analyserar..." : "Läs fil"}
          </button>
        )}

        {analysis && (
          <div className="ns-mapping-card">
            <div className="ns-mapping-title">Kolumnmapping</div>
            <div className="ns-mapping-sub">
              Vi har föreslagit kolumner automatiskt — justera vid behov.
            </div>
            <div className="ns-mapping-grid">
              {Object.keys(mapping).map((key) => (
                <div key={key} className="ns-mapping-row">
                  <label className="ns-mapping-label">
                    {mappingLabels[key] || key}
                  </label>
                  <select
                    className="ns-mapping-select"
                    value={mapping[key] || ""}
                    onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                  >
                    <option value="">— välj kolumn —</option>
                    {analysis.available_columns.map((col: string) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              className="ns-btn-primary"
              onClick={runMappedAnalysis}
              disabled={loading}
            >
              {loading ? "Kör analys..." : "Kör analys →"}
            </button>
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
