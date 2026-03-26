"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import KPIGrid from "@/components/KPIGrid";
import AIInsights from "@/components/AIInsights";
import AIChat from "@/components/AIChat";
import { getPack, getReportItems } from "@/lib/store";

export default function DashboardPage() {
  const pack = getPack();
  const reportItems = getReportItems();

  if (!pack) return <ProtectedLayout><div>Ingen analys laddad.</div></ProtectedLayout>;

  const cards = [
    { title: "Current period", value: pack.current_period, subchips: ["Analys"] },
    { title: "Previous period", value: pack.previous_period || "N/A", subchips: ["Jämförelse"] },
    { title: "Warnings", value: String(pack.warnings?.length || 0), subchips: ["Datamodell"] },
    { title: "Narrative", value: pack.narrative ? "Ready" : "Empty", subchips: ["AI / rules"] },
  ];

  const insights = [
    pack.narrative || "Ingen narrativ kommentar tillgänglig.",
    ...(pack.warnings || []).slice(0, 2),
  ];

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <KPIGrid cards={cards} />
      <div className="two-col">
        <AIInsights insights={insights} />
        <AIChat pack={pack} />
      </div>
    </ProtectedLayout>
  );
}