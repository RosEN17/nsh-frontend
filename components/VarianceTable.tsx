"use client";

import { useState } from "react";

type VarianceRow = {
  status: "Att hantera" | "Utredd" | "Godkänd";
  category: string;
  description: string;
  company: string;
  impact: number | null;
  owner: string;
  activity?: string;
};

function StatusBadge({ status }: { status: VarianceRow["status"] }) {
  const cls =
    status === "Att hantera" ? "badge badge-amber"
    : status === "Utredd"    ? "badge badge-gray"
    :                          "badge badge-green";
  return (
    <span className={cls}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}

function Impact({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="impact-neu">—</span>;
  const pos = value >= 0;
  const abs = Math.abs(value);
  const fmt = abs >= 1_000_000
    ? `${(abs / 1_000_000).toFixed(1)} MSEK`
    : abs >= 1_000
    ? `${Math.round(abs / 1_000)} tkr`
    : `${Math.round(abs)}`;
  return (
    <span className={pos ? "impact-pos" : "impact-neg"}>
      {pos ? "+ " : "− "}{fmt}
    </span>
  );
}

export default function VarianceTable({ rows }: { rows: VarianceRow[] }) {
  const [filter, setFilter] = useState("Alla");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filters = ["Alla", "Mina fall", "Störst avvikelse", "Mest brådskande"];

  const visible =
    filter === "Störst avvikelse"
      ? [...rows].sort((a, b) => Math.abs(b.impact ?? 0) - Math.abs(a.impact ?? 0))
      : rows;

  function toggleRow(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="ns-toolbar">
        {filters.map((f) => (
          <button
            key={f}
            className={`ns-toolbar-btn${filter === f ? " active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
        <div className="ns-search-wrap">
          <span className="ns-search-icon">🔍</span>
          <input className="ns-search" placeholder="Sök kategori..." />
        </div>
        <select className="ns-select">
          <option>Bolag</option>
        </select>
      </div>

      <div className="ns-table-card">
        <div className="ns-table-head">
          <div className="ns-table-icon">≡</div>
          <span className="ns-table-title">{visible.length} avvikelser</span>
          <span className="ns-table-badge">att hantera</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th>Status</th>
              <th>Kategori</th>
              <th>Beskrivning</th>
              <th>Bolag</th>
              <th>Impact</th>
              <th>Ägare</th>
              <th>Senaste aktivitet</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-faint)" }}>
                  Inga avvikelser att visa
                </td>
              </tr>
            ) : (
              visible.map((row, i) => (
                <tr key={i} className={selected.has(i) ? "row-selected" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      className="row-cb"
                      checked={selected.has(i)}
                      onChange={() => toggleRow(i)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td><StatusBadge status={row.status} /></td>
                  <td><span className="cat-badge">{row.category}</span></td>
                  <td style={{ maxWidth: 220 }}>{row.description}</td>
                  <td>{row.company}</td>
                  <td><Impact value={row.impact} /></td>
                  <td><span className="cell-owner">{row.owner}</span></td>
                  <td>
                    {row.activity && (
                      <span className="cell-activity">{row.activity}</span>
                    )}
                  </td>
                  <td>
                    <button className="action-btn">Mer info</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="ns-table-footer">
          <div className="ns-table-footer-left">
            <input
              type="checkbox"
              className="row-cb"
              checked={selected.size > 0}
              onChange={() => setSelected(new Set())}
            />
            {selected.size > 0 ? `${selected.size} markerade` : "Välj rader"}
          </div>
          <div className="ns-table-footer-right">
            <button className="fbtn">Markera åtgärd</button>
            <button className="fbtn">👤 Tilldela ▾</button>
            <button className="fbtn">Godkänn</button>
            <button className="fbtn fbtn-primary">Skicka</button>
          </div>
        </div>
      </div>
    </div>
  );
}
