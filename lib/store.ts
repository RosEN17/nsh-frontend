export type ReportItem = {
  id: string;
  title: string;
  text: string;
  severity?: string;
  owner?: string;
  status?: string;
  confidence?: string;
};

export function savePack(pack: unknown) {
  localStorage.setItem("nordsheet_pack", JSON.stringify(pack));
}

export function getPack() {
  const raw = localStorage.getItem("nordsheet_pack");
  return raw ? JSON.parse(raw) : null;
}

export function saveReportItems(items: ReportItem[]) {
  localStorage.setItem("nordsheet_report_items", JSON.stringify(items));
}

export function getReportItems(): ReportItem[] {
  const raw = localStorage.getItem("nordsheet_report_items");
  return raw ? JSON.parse(raw) : [];
}