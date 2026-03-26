"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import VarianceTable from "@/components/VarianceTable";
import { getPack, getReportItems } from "@/lib/store";

export default function VariancesPage() {
  const pack = getPack();
  const reportItems = getReportItems();

  if (!pack) {
    return (
      <ProtectedLayout>
        <Header reportCount={0} />
        <div className="ns-page">
          <div className="ns-hero">
            <div className="ns-hero-title">Hantera avvikelser</div>
            <div className="ns-hero-sub">Ingen analys laddad — gå till Connect först.</div>
          </div>
        </div>
      </ProtectedLayout>
    );
  }

  const budgetRows = (pack.top_budget || []).map((x: any) => ({
    status: "Att hantera" as const,
    category: x.Label || x.Konto || "—",
    description: x.Label || x.Konto || "—",
    company: "—",
    impact: x["Vs budget diff"] ?? x.variance ?? null,
    owner: "—",
    activity: undefined,
  }));

  const momRows = (pack.top_mom || []).map((x: any) => ({
    status: "Utredd" as const,
    category: x.Label || x.Konto || "—",
    description: x.Label || x.Konto || "—",
    company: "—",
    impact: x["MoM diff"] ?? null,
    owner: "—",
    activity: undefined,
  }));

  const rows = [...budgetRows, ...momRows];

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <div className="ns-page">
        <div className="ns-hero">
          <div className="ns-hero-title">Hantera avvikelser</div>
          <div className="ns-hero-sub">{rows.length} avvikelser att hantera</div>
        </div>
        <VarianceTable rows={rows} />
      </div>
    </ProtectedLayout>
  );
}
