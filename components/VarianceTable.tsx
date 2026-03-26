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
  if (value === null) return <span className="impact-neu">—</span>;
  const pos = value >= 0;
  return (
    <span className={pos ? "impact-pos" : "impact-neg"}>
      {pos ? "+ " : "− "}{Math.abs(value).toLocaleString("sv-SE")} tkr
    </span>
  );
}

export default function VarianceTable({
  rows,
}: {
  rows: VarianceRow[];
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [filter, setFilter] = useState("Alla");

  const filters = ["Alla", "Mina fall", "Störst avvikelse", "Mest brådskande"];

  const visible =
    filter === "Alla"
      ? rows
      : filter === "Mina fall"
      ? rows.filter((r) => r.owner === "William")
      : filter === "Störst avvikelse"
      ? [...rows].sort((a, b) => Math.abs(b.impact ?? 0) - Math.abs(a.impact ?? 0))
      : rows;

  function toggleRow(i: number) {
    setSelected((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
            {visible.map((row, i) => (
              <tr key={i} onClick={() => toggleRow(i)}>
                <td><StatusBadge status={row.status} /></td>
                <td><span className="cat-badge">{row.category}</span></td>
                <td>{row.description}</td>
                <td>{row.company}</td>
                <td><Impact value={row.impact} /></td>
                <td><span className="cell-owner">{row.owner}</span></td>
                <td>
                  {row.activity && (
                    <span className="cell-activity">{row.activity}</span>
                  )}
                </td>
                <td>
                  <button
                    className="action-btn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Mer info
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ns-table-footer">
          <div className="ns-table-footer-left">
            <input
              type="checkbox"
              checked={selected.length > 0}
              onChange={() => setSelected([])}
            />
            {selected.length > 0
              ? `${selected.length} markerade`
              : "Välj rader"}
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
