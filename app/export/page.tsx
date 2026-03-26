"use client";

import { downloadExport } from "@/lib/api";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getReportItems } from "@/lib/store";

export default function ExportPage() {
  const pack = getPack();
  const reportItems = getReportItems();

  if (!pack) return <ProtectedLayout><div>Ingen analys laddad.</div></ProtectedLayout>;

  async function exportFile(fmt: "pptx" | "docx") {
    await downloadExport(
      {
        fmt,
        pack,
        report_items: reportItems,
        spec: { title: "NordSheet Export" },
        purpose: "finance_report",
        business_type: "Övrigt",
      },
      `finance_report.${fmt}`
    );
  }

  return (
    <ProtectedLayout>
      <Header reportCount={reportItems.length} />
      <div className="panel">
        <h2>Export</h2>
        <button onClick={() => exportFile("pptx")}>Export PPTX</button>
        <button onClick={() => exportFile("docx")}>Export DOCX</button>
      </div>
    </ProtectedLayout>
  );
}