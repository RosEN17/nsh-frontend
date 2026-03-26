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

  async function analyzeFile() {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const res = await uploadAnalyze(file);
      setAnalysis(res);
      setMapping({
        period: res.column_suggestions.period?.[0] || "",
        account: res.column_suggestions.account?.[0] || "",
        actual: res.column_suggestions.actual?.[0] || "",
        budget: res.column_suggestions.budget?.[0] || "",
        entity: res.column_suggestions.entity?.[0] || "",
        cost_center: res.column_suggestions.cost_center?.[0] || "",
        project: res.column_suggestions.project?.[0] || "",
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

  return (
    <ProtectedLayout>
      <Header reportCount={0} />

      <div className="ns-hero">
        <div className="ns-eyebrow">Connect</div>
        <div className="ns-hero-title">Importera data och starta analysen</div>
        <div className="ns-hero-text">Ladda upp Excel eller CSV, kontrollera kolumnmapping och kör analys.</div>
      </div>

      {error && (
        <div className="ns-error-banner" role="alert">
          <strong>Något gick fel:</strong> {error}
        </div>
      )}

      <input
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={(e) => { setFile(e.target.files?.[0] || null); setError(null); }}
      />
      <button onClick={analyzeFile} disabled={loading || !file}>
        {loading && !analysis ? "Analyserar..." : "Läs fil"}
      </button>

      {analysis && (
        <div className="panel">
          <h3>Kolumnmapping</h3>
          {Object.keys(mapping).map((key) => (
            <div key={key}>
              <label>{key}</label>
              <select
                value={mapping[key] || ""}
                onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
              >
                <option value="">-- välj --</option>
                {analysis.available_columns.map((col: string) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          ))}

          <button onClick={runMappedAnalysis} disabled={loading}>
            {loading ? "Kör analys..." : "Kör analys"}
          </button>
        </div>
      )}
    </ProtectedLayout>
  );
}
