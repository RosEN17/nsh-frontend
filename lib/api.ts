const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

// Extracts a readable message from any failed response.
// Tries JSON `.detail` (FastAPI style), then `.message`, then falls back
// to "HTTP <status>" so the caller always gets something actionable.
async function extractError(res: Response): Promise<string> {
  const status = res.status;
  try {
    const body = await res.json();
    const detail = (body as any).detail || (body as any).message;
    if (detail) return `${detail} (HTTP ${status})`;
  } catch {
    // body was not JSON — ignore
  }
  return `HTTP ${status}: ${res.statusText || "Server error"}`;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await extractError(res));
  }

  return res.json();
}

export async function getForecast() {
  const res = await fetch(`${API_BASE}/forecast`);
  if (!res.ok) throw new Error(`Kunde inte hämta forecast — ${await extractError(res)}`);
  return res.json();
}

export async function uploadAnalyze(file: File) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) throw new Error(`Analys misslyckades — ${await extractError(res)}`);
  return res.json();
}

export async function uploadAnalyzeWithMapping(
  file: File,
  mapping: Record<string, string | null>
) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("mapping_json", JSON.stringify(mapping));

  const res = await fetch(`${API_BASE}/api/analyze-with-mapping`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) throw new Error(`Mappningsanalys misslyckades — ${await extractError(res)}`);
  return res.json();
}

export async function downloadExport(body: unknown, filename: string) {
  const res = await fetch(`${API_BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Export misslyckades — ${await extractError(res)}`);

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}
