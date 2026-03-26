"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import VarianceSplit from "@/components/VarianceSplit";
import { getPack, getReportItems } from "@/lib/store";

export default function VariancesPage() {
  const pack = getPack();
  const reportItems = getReportItems();

  if (!pack) return <ProtectedLayout><div>Ingen analys laddad.</div></ProtectedLayout>;

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <VarianceSplit
        negatives={pack.top_budget || []}
        positives={pack.top_mom || []}
      />
    </ProtectedLayout>
  );
}