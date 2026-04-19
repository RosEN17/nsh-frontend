"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getEstimates, SavedEstimate } from "@/lib/store";

function fmtKr(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MSEK`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} tkr`;
  return `${Math.round(n)} kr`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [estimates, setEstimates] = useState<SavedEstimate[]>([]);

  useEffect(() => { setEstimates(getEstimates()); }, []);

  const totalValue = estimates.reduce((s, e) => s + (e.customer_pays || 0), 0);
  const thisMonth = estimates.filter(e => {
    const d = new Date(e.created);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  return (
    <ProtectedLayout>
      <Header title="Dashboard" subtitle="Översikt av dina kalkyler" />

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{estimates.length}</div>
          <div className="stat-label">Totalt kalkyler</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{thisMonth.length}</div>
          <div className="stat-label">Denna månad</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{fmtKr(totalValue)}</div>
          <div className="stat-label">Totalt värde</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{estimates.length > 0 ? fmtKr(totalValue / estimates.length) : "—"}</div>
          <div className="stat-label">Snittoffert</div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <button className="btn btn-primary btn-lg" onClick={() => router.push("/estimate")} style={{ width: "100%" }}>
          + Ny kalkyl
        </button>
      </div>

      {estimates.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📐</div>
            <div className="empty-title">Inga kalkyler ännu</div>
            <div className="empty-desc">
              Beskriv ett jobb och låt AI:n räkna ut material, arbetstid och pris åt dig. Din första kalkyl tar under en minut.
            </div>
            <button className="btn btn-primary" onClick={() => router.push("/estimate")}>
              Skapa din första kalkyl
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="card-title" style={{ marginBottom: 12 }}>Senaste kalkyler</div>
          {estimates.slice(0, 10).map((est) => (
            <div key={est.id} className="est-list-item" onClick={() => {
              localStorage.setItem("byggkalk_current", JSON.stringify(est.data));
              router.push("/estimate?view=" + est.id);
            }}>
              <div className="est-list-icon">📐</div>
              <div className="est-list-info">
                <div className="est-list-title">{est.description}</div>
                <div className="est-list-meta">
                  {new Date(est.created).toLocaleDateString("sv-SE")}
                  {est.job_type && ` · ${est.job_type}`}
                </div>
              </div>
              <div className="est-list-amount">{fmtKr(est.customer_pays)}</div>
            </div>
          ))}
        </div>
      )}
    </ProtectedLayout>
  );
}
