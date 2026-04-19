"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getEstimates, deleteEstimate, SavedEstimate } from "@/lib/store";

function fmtKr(n: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "decimal", maximumFractionDigits: 0 }).format(n) + " kr";
}

export default function EstimatesPage() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<SavedEstimate[]>([]);

  useEffect(() => { setEstimates(getEstimates()); }, []);

  function handleDelete(id: string) {
    if (!confirm("Ta bort kalkylen?")) return;
    deleteEstimate(id);
    setEstimates(getEstimates());
  }

  function handleView(est: SavedEstimate) {
    localStorage.setItem("byggkalk_current", JSON.stringify(est.data));
    router.push("/estimate?view=" + est.id);
  }

  return (
    <ProtectedLayout>
      <Header title="Mina kalkyler" subtitle={`${estimates.length} sparade kalkyler`} />

      {estimates.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-title">Inga sparade kalkyler</div>
            <div className="empty-desc">Kalkyler du skapar och sparar visas här.</div>
            <button className="btn btn-primary" onClick={() => router.push("/estimate")}>
              Skapa ny kalkyl
            </button>
          </div>
        </div>
      ) : (
        <div>
          {estimates.map((est) => (
            <div key={est.id} className="est-list-item">
              <div className="est-list-icon" onClick={() => handleView(est)} style={{ cursor: "pointer" }}>📐</div>
              <div className="est-list-info" onClick={() => handleView(est)} style={{ cursor: "pointer" }}>
                <div className="est-list-title">{est.description}</div>
                <div className="est-list-meta">
                  {new Date(est.created).toLocaleDateString("sv-SE")}
                  {est.job_type && ` · ${est.job_type}`}
                </div>
              </div>
              <div className="est-list-amount">{fmtKr(est.customer_pays)}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(est.id)} style={{ color: "var(--text-faint)" }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </ProtectedLayout>
  );
}
