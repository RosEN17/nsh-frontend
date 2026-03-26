const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || "API error");
  }

  return res.json();
}

export async function getForecast() {
  const res = await fetch(`${API_BASE}/forecast`);
  if (!res.ok) throw new Error("Kunde inte hämta forecast");
  return res.json();
}

export async function uploadAnalyze(file: File) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) throw new Error("Kunde inte analysera filen");
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

  if (!res.ok) throw new Error("Kunde inte köra analys med mapping");
  return res.json();
}

export async function downloadExport(body: unknown, filename: string) {
  const res = await fetch(`${API_BASE}/api/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error("Export misslyckades");

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}