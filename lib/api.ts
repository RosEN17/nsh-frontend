import { supabase } from "./supabase";

const API = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

async function extractError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = (body as any).detail || (body as any).message;
    if (detail) return `${detail} (HTTP ${res.status})`;
  } catch {}
  return `HTTP ${res.status}: ${res.statusText || "Serverfel"}`;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) return { "Authorization": `Bearer ${token}` };
  } catch {}
  return {};
}

export interface EstimateRequest {
  description: string;
  job_type?: string;
  area_sqm?: number;
  location?: string;
  address?: string;
  distance_km?: number;
  work_days?: number;
  quality?: "standard" | "premium";
  hourly_rate?: number;
  include_rot?: boolean;
  margin_pct?: number;
  ue_markup_pct?: number;
  build_params?: Record<string, string>;
  images?: Array<{ name: string; data: string }>;
  documents?: Array<{ name: string; data: string }>;
}

export async function createEstimate(body: EstimateRequest) {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API}/api/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

export async function chatMessage(message: string, estimateContext?: any) {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
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

export async function getPricing(jobType: string, quality: string = "standard", region: string = "default") {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API}/api/admin/pricing/${jobType}?quality=${quality}&region=${region}`, {
    headers: authHeader,
  });
  if (!res.ok) throw new Error(await extractError(res));
  return res.json();
}

// ----------------------------------------------------------------
// Feedback
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
  source_id?: string;
  source_table?: string;
}

export async function saveFeedback(payload: FeedbackPayload): Promise<void> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await extractError(res));
}
