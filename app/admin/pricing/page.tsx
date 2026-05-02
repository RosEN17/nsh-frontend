"use client";

import { useState, useEffect } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import { getPricing } from "@/lib/api";

const JOB_TYPES = [
  { id: "rivning", label: "Rivning" },
  { id: "fasad",   label: "Fasad" },
  { id: "altan",   label: "Altan/Trall" },
];

const QUALITIES = [
  { id: "standard", label: "Standard" },
  { id: "premium",  label: "Premium" },
];

const REGIONS = [
  { id: "default",   label: "Övriga Sverige" },
  { id: "stockholm", label: "Stockholm" },
  { id: "goteborg",  label: "Göteborg" },
  { id: "malmo",     label: "Malmö" },
  { id: "norrland",  label: "Norrland" },
];

interface PricingContext {
  work_norms: any[];
  material_prices: any[];
  subcontractor_prices: any[];
  disposal_costs: any[];
  equipment_rental: any[];
  overhead_costs: any[];
  regional: any;
}

function fmtKr(n: number): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("sv-SE") + " kr";
}

export default function AdminPricingPage() {
  const [jobType, setJobType] = useState("rivning");
  const [quality, setQuality] = useState("standard");
  const [region, setRegion]   = useState("default");
  const [data, setData]       = useState<PricingContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [filter, setFilter]   = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getPricing(jobType, quality, region)
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(String(e?.message || e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [jobType, quality, region]);

  const matches = (text: string) =>
    !filter.trim() || text.toLowerCase().includes(filter.toLowerCase());

  return (
    <ProtectedLayout>
      <div className="page-title">Prislåda — admin</div>
      <div className="page-subtitle">
        Visar exakt vilka rader AI:n får för en given jobbtyp, kvalitetsnivå och region.
        Edit sker i Supabase Studio (eller via SQL); detta är read-only översikt.
      </div>

      {/* Filterrad */}
      <div className="card" style={{ marginTop: 16, marginBottom: 16, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <label className="label">Jobbtyp</label>
          <div style={{ display: "flex", gap: 6 }}>
            {JOB_TYPES.map(jt => (
              <button
                key={jt.id}
                onClick={() => setJobType(jt.id)}
                style={{
                  background: jobType === jt.id ? "rgba(106,129,147,0.15)" : "var(--bg-surface)",
                  border: `0.5px solid ${jobType === jt.id ? "rgba(106,129,147,0.5)" : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  padding: "5px 14px",
                  fontSize: 12,
                  fontWeight: jobType === jt.id ? 600 : 400,
                  color: jobType === jt.id ? "#8aaabb" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >{jt.label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Kvalitet</label>
          <div style={{ display: "flex", gap: 6 }}>
            {QUALITIES.map(q => (
              <button
                key={q.id}
                onClick={() => setQuality(q.id)}
                style={{
                  background: quality === q.id ? "rgba(106,129,147,0.15)" : "var(--bg-surface)",
                  border: `0.5px solid ${quality === q.id ? "rgba(106,129,147,0.5)" : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  padding: "5px 12px",
                  fontSize: 12,
                  color: quality === q.id ? "#8aaabb" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >{q.label}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Region</label>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            className="input"
            style={{ width: 180 }}
          >
            {REGIONS.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="label">Filtrera rader</label>
          <input
            className="input"
            placeholder="Sök på namn, post, leverantör..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="card" style={{ background: "rgba(239,68,68,0.06)", border: "0.5px solid rgba(239,68,68,0.3)", color: "#ef4444", marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="card" style={{ textAlign: "center", padding: 32, color: "var(--text-faint)" }}>
          Hämtar prislåda...
        </div>
      )}

      {!loading && data && (
        <>
          {/* Regional info */}
          {data.regional && (
            <div className="card" style={{ marginBottom: 16, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong>Region: {data.regional.region}</strong>
                  <span style={{ marginLeft: 12, color: "var(--text-faint)" }}>
                    Arbete-faktor {data.regional.labor_factor} · Material-faktor {data.regional.material_factor} · UE-faktor {data.regional.ue_factor}
                  </span>
                </div>
                {Number(data.regional.congestion_per_day) > 0 && (
                  <div style={{ background: "rgba(245,158,11,0.1)", border: "0.5px solid rgba(245,158,11,0.3)", borderRadius: "var(--radius)", padding: "4px 10px", color: "#f59e0b", fontSize: 11 }}>
                    Trängselskatt: {data.regional.congestion_per_day} kr/dag innanför zonen
                  </div>
                )}
              </div>
            </div>
          )}

          <PricingSection title="Arbetstidsnormer" rows={data.work_norms.filter(n => matches(n.label))}
            columns={[
              { key: "label",     label: "Moment",   width: "40%" },
              { key: "hours_per", label: "Tid",      align: "right", render: (v: number, row: any) => `${v} h/${row.unit}` },
              { key: "scope",     label: "Scope" },
              { key: "notes",     label: "Anteckning" },
            ]}
          />

          <PricingSection title="Materialpriser" rows={data.material_prices.filter(m => matches(m.label) || matches(m.supplier || ""))}
            columns={[
              { key: "label",        label: "Material",   width: "40%" },
              { key: "price",        label: "Pris",       align: "right", render: (v: number, row: any) => `${fmtKr(v)} / ${row.unit}` },
              { key: "quality_tier", label: "Kvalitet" },
              { key: "supplier",     label: "Leverantör" },
            ]}
          />

          <PricingSection title="Underentreprenörer" rows={data.subcontractor_prices.filter(s => matches(s.description) || matches(s.trade))}
            columns={[
              { key: "trade",       label: "Yrke" },
              { key: "scope",       label: "Scope" },
              { key: "description", label: "Beskrivning", width: "40%" },
              { key: "price",       label: "Pris",        align: "right", render: (v: number, row: any) => `${fmtKr(v)} / ${row.unit}` },
            ]}
          />

          <PricingSection title="Sophantering & deponi" rows={data.disposal_costs.filter(d => matches(d.label))}
            columns={[
              { key: "label",    label: "Post",     width: "40%" },
              { key: "category", label: "Kategori" },
              { key: "price",    label: "Pris",     align: "right", render: (v: number, row: any) => `${fmtKr(v)} / ${row.unit}` },
              { key: "notes",    label: "Anteckning" },
            ]}
          />

          <PricingSection title="Hyrutrustning" rows={data.equipment_rental.filter(e => matches(e.label))}
            columns={[
              { key: "label", label: "Utrustning",  width: "40%" },
              { key: "price", label: "Pris",        align: "right", render: (v: number, row: any) => `${fmtKr(v)} / ${row.unit}` },
              { key: "notes", label: "Anteckning" },
            ]}
          />

          <PricingSection title="Etablering, resor, frakt" rows={data.overhead_costs.filter(o => matches(o.label))}
            columns={[
              { key: "label",        label: "Post",     width: "40%" },
              { key: "calc_type",    label: "Beräkning" },
              { key: "rate",         label: "Värde",    align: "right", render: (v: number, row: any) => `${v} ${row.unit}` },
              { key: "trigger_rule", label: "Villkor" },
            ]}
          />
        </>
      )}
    </ProtectedLayout>
  );
}

interface ColumnDef {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "right";
  render?: (value: any, row: any) => string;
}

function PricingSection({
  title, rows, columns,
}: {
  title: string;
  rows: any[];
  columns: ColumnDef[];
}) {
  if (!rows || rows.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
        {title}
        <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 400 }}>({rows.length} rader)</span>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="est-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} style={{ width: col.width, textAlign: col.align || "left" }}>{col.label}</th>
              ))}
              <th style={{ width: 90, textAlign: "right" }}>Source ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id || i}>
                {columns.map(col => {
                  const value = row[col.key];
                  const display = col.render ? col.render(value, row) : (value ?? "—");
                  return (
                    <td key={col.key} style={{ textAlign: col.align || "left" }}>
                      {display || "—"}
                    </td>
                  );
                })}
                <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 10, color: "var(--text-faint)" }}>
                  {row.id ? row.id.substring(0, 8) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
