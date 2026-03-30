export type ReportItem = {
  id: string;
  title: string;
  text: string;
  severity?: string;
  owner?: string;
  status?: string;
  confidence?: string;
};

export type FileMeta = {
  name: string;
  sizeKb: number;
  uploadedAt: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function savePack(pack: unknown) {
  if (!isBrowser()) return;
  localStorage.setItem("nordsheet_pack", JSON.stringify(pack));
}

export function getPack() {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem("nordsheet_pack");
  return raw ? JSON.parse(raw) : null;
}

export function saveFileMeta(meta: FileMeta) {
  if (!isBrowser()) return;
  localStorage.setItem("nordsheet_file_meta", JSON.stringify(meta));
}

export function getFileMeta(): FileMeta | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem("nordsheet_file_meta");
  return raw ? JSON.parse(raw) : null;
}

export function clearAll() {
  if (!isBrowser()) return;
  localStorage.removeItem("nordsheet_pack");
  localStorage.removeItem("nordsheet_file_meta");
  localStorage.removeItem("nordsheet_report_items");
}

export function saveReportItems(items: ReportItem[]) {
  if (!isBrowser()) return;
  localStorage.setItem("nordsheet_report_items", JSON.stringify(items));
}

export function getReportItems(): ReportItem[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem("nordsheet_report_items");
  return raw ? JSON.parse(raw) : [];
}



