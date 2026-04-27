const API = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

async function extractError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = (body as any).detail || (body as any).message;
    if (detail) return `${detail} (HTTP ${res.status})`;
  } catch {}
  return `HTTP ${res.status}: ${res.statusText || "Serverfel"}`;
}

export async function createEstimate(body: {
  description: string;
  job_type?: string;
  area_sqm?: number;
  location?: string;
  hourly_rate?: number;
  include_rot?: boolean;
  margin_pct?: number;
  build_params?: Record<string, string>;
  images?: Array<{ name: string; data: string }>;
  documents?: Array<{ name: string; data: string }>;
}) {
  const res = await fetch(`${API}/api/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

export async function chatMessage(message: string, estimateContext?: any) {
  const res = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, estimate_context: estimateContext }),
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

export async function getJobTypes() {
  const res = await fetch(`${API}/api/job-types`);
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

// ----------------------------------------------------------------
// Spara snickares justering av ett AI-förslag
// ----------------------------------------------------------------

interface EditValue {
  ai: string | number;
  final: string | number;
  reason: string;
}

export interface FeedbackPayload {
  quote_number: string;
  field_changed: string;
  ai_value: string;
  final_value: string;
  reason_code: string;
  reason_text?: string;
  craftsman_name?: string;
  job_type?: string;
  region?: string;
  all_edits?: Record<string, EditValue>;
}

export async function saveFeedback(payload: FeedbackPayload): Promise<void> {
  const res = await fetch(`${API}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await extractError(res));
}
