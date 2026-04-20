"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getEstimates, deleteEstimate, renameEstimate, SavedEstimate } from "@/lib/store";

function fmtKr(n: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "decimal", maximumFractionDigits: 0 }).format(n) + " kr";
}

export default function EstimatesPage() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<SavedEstimate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => { setEstimates(getEstimates()); }, []);

  function handleDelete(id: string, name: string) {
    if (!confirm(`Ta bort "${name}"?`)) return;
    deleteEstimate(id);
    setEstimates(getEstimates());
  }

  function handleView(est: SavedEstimate) {
    router.push("/estimate?view=" + est.id);
  }

  function startRename(est: SavedEstimate) {
    setEditingId(est.id);
    setEditName(est.description);
  }

  function saveRename(id: string) {
    if (editName.trim()) {
      renameEstimate(id, editName.trim());
      setEstimates(getEstimates());
    }
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === "Enter") saveRename(id);
    if (e.key === "Escape") setEditingId(null);
  }

  return (
    <ProtectedLayout>
      <Header title="Mina kalkyler" subtitle={`${estimates.length} sparade kalkyler`} />

      {estimates.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">Inga sparade kalkyler</div>
            <div className="empty-desc">Kalkyler du skapar och sparar visas här. Du kan döpa dem, öppna dem och ladda ner som offert.</div>
            <button className="btn btn-primary" onClick={() => router.push("/estimate")}>
              Skapa ny kalkyl
            </button>
          </div>
        </div>
      ) : (
        <div>
          {estimates.map((est) => (
            <div key={est.id} className="est-list-item" style={{ position: "relative" }}>
              <div className="est-list-icon" onClick={() => handleView(est)} style={{ cursor: "pointer" }}>📐</div>
              <div className="est-list-info" style={{ flex: 1, minWidth: 0 }}>
                {editingId === est.id ? (
                  <input
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => saveRename(est.id)}
                    onKeyDown={(e) => handleKeyDown(e, est.id)}
                    autoFocus
                    style={{ padding: "4px 8px", fontSize: 14, fontWeight: 600 }}
                  />
                ) : (
                  <div className="est-list-title" onClick={() => handleView(est)} style={{ cursor: "pointer" }}>
                    {est.description}
                  </div>
                )}
                <div className="est-list-meta">
                  {new Date(est.created).toLocaleDateString("sv-SE")}
                  {est.job_type && ` · ${est.job_type}`}
                </div>
              </div>
              <div className="est-list-amount" style={{ marginRight: 8 }}>{fmtKr(est.customer_pays)}</div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => startRename(est)}
                  title="Döp om"
                  style={{ color: "var(--text-faint)", fontSize: 14, padding: "6px 8px" }}
                >
                  ✏️
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDelete(est.id, est.description)}
                  title="Ta bort"
                  style={{ color: "var(--text-faint)", fontSize: 14, padding: "6px 8px" }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </ProtectedLayout>
  );
}
