"use client";

import { useState, useRef } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getReportItems } from "@/lib/store";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 13, height: 13, flexShrink: 0,
      border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff",
      borderRadius: "50%", animation: "nsSpin .7s linear infinite",
    }} />
  );
}

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MSEK`;
  if (abs >= 1_000)     return `${Math.round(n / 1_000)} tkr`;
  return `${Math.round(n)} kr`;
}

type InvoiceAnalysis = {
  supplier:        string;
  invoice_number:  string;
  invoice_date:    string;
  due_date:        string;
  total_amount:    number | null;
  vat_amount:      number | null;
  net_amount:      number | null;
  currency:        string;
  line_items:      { description: string; amount: number; quantity?: number }[];
  ai_summary:      string;
  anomalies:       string[];
  category:        string;
  confidence:      number;
};

type UploadedInvoice = {
  file:     File;
  status:   "analyzing" | "done" | "error";
  analysis: InvoiceAnalysis | null;
  error:    string | null;
};

// ── Invoice card ──────────────────────────────────────────────────
function InvoiceCard({
  inv, index, onRemove,
}: {
  inv: UploadedInvoice; index: number; onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const a = inv.analysis;

  return (
    <div className="inv-card">
      {/* Header row */}
      <div className="inv-card-top">
        <div className="inv-card-left">
          <div className="inv-pdf-icon">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 2h6l4 4v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"
                stroke="currentColor" strokeWidth="1.2" fill="none"/>
              <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="inv-card-filename">{inv.file.name}</div>
            <div className="inv-card-filesize">{(inv.file.size / 1024).toFixed(0)} KB</div>
          </div>
        </div>

        <div className="inv-card-right">
          {inv.status === "analyzing" && (
            <div className="inv-status-analyzing"><Spinner /> Analyserar...</div>
          )}
          {inv.status === "error" && (
            <span className="inv-status-error">Fel</span>
          )}
          {inv.status === "done" && a && (
            <>
              <span className="inv-total">{fmt(a.total_amount)}</span>
              {a.anomalies.length > 0 && (
                <span className="inv-anomaly-badge">{a.anomalies.length} avvikelse{a.anomalies.length > 1 ? "r" : ""}</span>
              )}
              <button className="inv-expand-btn" onClick={() => setExpanded(!expanded)}>
                {expanded ? "Stäng" : "Mer info"}
              </button>
            </>
          )}
          <button className="inv-remove-btn" onClick={onRemove} title="Ta bort">✕</button>
        </div>
      </div>

      {/* Error */}
      {inv.status === "error" && inv.error && (
        <div className="inv-error-msg">{inv.error}</div>
      )}

      {/* Expanded analysis */}
      {expanded && a && (
        <div className="inv-expanded">

          {/* KPIs */}
          <div className="inv-kpi-row">
            {[
              { label: "Leverantör",    val: a.supplier      || "—" },
              { label: "Fakturanr",     val: a.invoice_number || "—" },
              { label: "Fakturadatum",  val: a.invoice_date   || "—" },
              { label: "Förfallodatum", val: a.due_date       || "—" },
              { label: "Netto",         val: fmt(a.net_amount) },
              { label: "Moms",          val: fmt(a.vat_amount) },
              { label: "Totalt",        val: fmt(a.total_amount) },
              { label: "Valuta",        val: a.currency      || "—" },
              { label: "Kategori",      val: a.category      || "—" },
            ].map((k) => (
              <div key={k.label} className="inv-kpi">
                <div className="inv-kpi-label">{k.label}</div>
                <div className="inv-kpi-val">{k.val}</div>
              </div>
            ))}
          </div>

          {/* AI summary */}
          <div className="inv-ai-section">
            <div className="inv-ai-header">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z"
                  fill="#9b94ff"/>
              </svg>
              <span>AI-analys</span>
              <span className="inv-confidence">
                {Math.round(a.confidence * 100)}% säkerhet
              </span>
            </div>
            <div className="inv-ai-text">{a.ai_summary}</div>
          </div>

          {/* Anomalies */}
          {a.anomalies.length > 0 && (
            <div className="inv-anomalies">
              <div className="inv-anomaly-title">Avvikelser att granska</div>
              {a.anomalies.map((anom, i) => (
                <div key={i} className="inv-anomaly-row">
                  <span className="inv-anomaly-dot" />
                  {anom}
                </div>
              ))}
            </div>
          )}

          {/* Line items */}
          {a.line_items.length > 0 && (
            <div className="inv-lines">
              <div className="inv-lines-title">Rader</div>
              <table className="inv-lines-table">
                <thead>
                  <tr>
                    <th>Beskrivning</th>
                    <th>Antal</th>
                    <th style={{ textAlign: "right" }}>Belopp</th>
                  </tr>
                </thead>
                <tbody>
                  {a.line_items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.description}</td>
                      <td>{item.quantity ?? "—"}</td>
                      <td style={{ textAlign: "right" }}>{fmt(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
export default function FakturorPage() {
  const reportItems = getReportItems();
  const inputRef    = useRef<HTMLInputElement>(null);
  const [dragging,  setDragging]  = useState(false);
  const [invoices,  setInvoices]  = useState<UploadedInvoice[]>([]);
  const [error,     setError]     = useState<string | null>(null);

  async function analyzeInvoice(file: File): Promise<InvoiceAnalysis | null> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/api/analyze-invoice`, {
      method: "POST",
      body:   fd,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    const pdfs = Array.from(files).filter(f =>
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length === 0) {
      setError("Endast PDF-filer stöds.");
      return;
    }

    // Add all as "analyzing"
    const newInvs: UploadedInvoice[] = pdfs.map(f => ({
      file: f, status: "analyzing", analysis: null, error: null,
    }));
    setInvoices(prev => [...prev, ...newInvs]);

    // Analyze each
    for (let i = 0; i < pdfs.length; i++) {
      const idx = invoices.length + i;
      try {
        const analysis = await analyzeInvoice(pdfs[i]);
        setInvoices(prev => prev.map((inv, j) =>
          j === idx ? { ...inv, status: "done", analysis } : inv
        ));
      } catch (e: any) {
        setInvoices(prev => prev.map((inv, j) =>
          j === idx ? { ...inv, status: "error", error: e.message } : inv
        ));
      }
    }
  }

  function removeInvoice(idx: number) {
    setInvoices(prev => prev.filter((_, i) => i !== idx));
  }

  const totalAmount = invoices
    .filter(i => i.status === "done" && i.analysis?.total_amount)
    .reduce((s, i) => s + (i.analysis?.total_amount ?? 0), 0);

  const anomalyCount = invoices
    .filter(i => i.status === "done")
    .reduce((s, i) => s + (i.analysis?.anomalies.length ?? 0), 0);

  return (
    <ProtectedLayout>
      <style>{`@keyframes nsSpin { to { transform: rotate(360deg); } }`}</style>
      <Header reportCount={reportItems.length} />
      <div className="ns-page">

        <div className="ns-hero-title">Fakturor</div>
        <div className="ns-hero-sub" style={{ marginTop: 3 }}>
          Ladda upp PDF-fakturor — AI extraherar data och flaggar avvikelser
        </div>

        {error && (
          <div className="ns-error-banner" role="alert">
            <strong>Fel:</strong> {error}
          </div>
        )}

        {/* Summary pills */}
        {invoices.length > 0 && (
          <div className="var-summary-row">
            <div className="var-summary-pill" style={{ borderColor: "var(--border)" }}>
              <span className="var-pill-num">{invoices.filter(i => i.status === "done").length}</span>
              <span className="var-pill-label">Analyserade</span>
            </div>
            <div className="var-summary-pill" style={{ borderColor: "var(--border)" }}>
              <span className="var-pill-num">{fmt(totalAmount)}</span>
              <span className="var-pill-label">Totalt belopp</span>
            </div>
            {anomalyCount > 0 && (
              <div className="var-summary-pill var-pill-neg">
                <span className="var-pill-num">{anomalyCount}</span>
                <span className="var-pill-label">Avvikelser</span>
              </div>
            )}
          </div>
        )}

        {/* Drop zone */}
        <div
          className={`ns-dropzone${dragging ? " dragging" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault(); setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            style={{ display: "none" }}
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
          <div className="ns-dropzone-empty">
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "var(--accent-soft)", display: "flex",
              alignItems: "center", justifyContent: "center",
              color: "var(--accent-text)", marginBottom: 8,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V8M12 8l-3 3M12 8l3 3" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 16v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="ns-dropzone-label">Dra och släpp PDF-fakturor här</div>
            <div className="ns-dropzone-sub">
              eller klicka för att välja — flera filer stöds
            </div>
          </div>
        </div>

        {/* Invoice list */}
        {invoices.length > 0 && (
          <div className="inv-list">
            {invoices.map((inv, i) => (
              <InvoiceCard
                key={i}
                inv={inv}
                index={i}
                onRemove={() => removeInvoice(i)}
              />
            ))}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
