"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTeam } from "@/lib/useTeam";

type Report = {
  id: string; name: string; report_type: string;
  period: string; fmt: string; created_at: string;
};

export default function ReportsPage() {
  const { company } = useTeam();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company?.id) return;
    supabase.from("saved_reports").select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setReports(data||[]); setLoading(false); });
  }, [company?.id]);

  async function deleteReport(id: string) {
    await supabase.from("saved_reports").delete().eq("id", id);
    setReports(prev => prev.filter(r => r.id !== id));
  }

  const ICONS: Record<string,string> = {
    pptx: "📊", docx: "📄", pdf: "📋",
  };

  return (
    <ProtectedLayout>
      <Header reportCount={reports.length} />
      <div className="ns-page">
        <div className="ns-hero-title">Sparade rapporter</div>
        <div className="ns-hero-sub" style={{ marginTop: 3 }}>
          {reports.length} rapporter genererade
        </div>

        {loading ? (
          <div style={{fontSize:13,color:"var(--text-faint)"}}>Laddar...</div>
        ) : reports.length === 0 ? (
          <div className="sb-empty-state">
            <div className="sb-empty-title">Inga sparade rapporter</div>
            <div className="sb-empty-sub">Generera rapporter från Report-sidan.</div>
            <a href="/export" className="sb-empty-action">Gå till Report →</a>
          </div>
        ) : (
          <div className="reports-grid">
            {reports.map(r => (
              <div key={r.id} className="report-card">
                <div className="report-card-icon">{ICONS[r.fmt] || "📄"}</div>
                <div className="report-card-body">
                  <div className="report-card-name">{r.name}</div>
                  <div className="report-card-meta">
                    {r.report_type && <span>{r.report_type}</span>}
                    {r.period && <span>· {r.period}</span>}
                    <span>· {r.fmt?.toUpperCase()}</span>
                  </div>
                  <div className="report-card-date">
                    {new Date(r.created_at).toLocaleDateString("sv-SE")}
                  </div>
                </div>
                <button className="report-card-del" onClick={()=>deleteReport(r.id)}
                  title="Ta bort">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
