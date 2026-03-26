"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";

export default function ForecastPage() {
  const pack = getPack();
  const reportItems = getReportItems();

  if (!pack) return <ProtectedLayout><div>Ingen analys laddad.</div></ProtectedLayout>;

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <div className="panel">
        <h2>Forecast</h2>
        <p>Här visar du run-rate och forecast-data från dina Pythonfunktioner i `analysis.py`.</p>
      </div>
    </ProtectedLayout>
  );
}