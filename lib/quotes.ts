import { supabase } from "./supabase";

export interface QuoteRecord {
  id: string;
  user_id: string;
  created_at: string;
  title: string;
  description: string;
  customer_name: string;
  customer_email: string;
  total_inc_vat: number;
  customer_pays: number;
  status: string;
  accepted_at: string | null;
  quote_data: any;
  settings_data: any;
  outcome: string | null;
  lost_reason: string | null;
  craftsman_edits: any | null;
  labor_cost: number | null;
  material_cost: number | null;
  subcontractor_cost: number | null;
  disposal_cost: number | null;
  overhead_cost: number | null;
  rot_deduction: number | null;
  customer_net_cost: number | null;
  project_type: string | null;
  region: string | null;
  complexity: string | null;
  waste_factor: number | null;
  risk_factor: number | null;
  tile_price_per_sqm: number | null;
  work_items: string[] | null;
  craftsman_name: string | null;
  pricing_snapshot: any | null;
}

function detectComplexity(result: any): string {
  const allRows: any[] = (result.categories || []).flatMap((c: any) => c.rows || []);
  const workText = allRows.map((r: any) => (r.description || "").toLowerCase()).join(" ");
  const totalHours = allRows
    .filter((r: any) => r.type === "labor")
    .reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);

  if (workText.includes("asbest") || workText.includes("bärande") || workText.includes("konstruktör")) return "specialist";
  if (workText.includes("mögel") || workText.includes("fukt") || workText.includes("sanering")) return "high";
  if (totalHours > 80) return "high";
  if (totalHours > 40) return "medium";
  return "low";
}

function extractWorkItems(result: any): string[] {
  return (result.categories || [])
    .flatMap((c: any) => c.rows || [])
    .filter((r: any) =>
      (r.type === "labor" || r.type === "subcontractor") && r.description
    )
    .map((r: any) => r.description as string);
}

function calcCosts(result: any): {
  laborCost: number; materialCost: number; subcontractorCost: number;
  disposalCost: number; overheadCost: number;
} {
  const allRows: any[] = (result.categories || []).flatMap((c: any) => c.rows || []);
  return {
    laborCost:         allRows.filter(r => r.type === "labor")        .reduce((s, r) => s + (r.total || 0), 0),
    materialCost:      allRows.filter(r => r.type === "material")     .reduce((s, r) => s + (r.total || 0), 0),
    subcontractorCost: allRows.filter(r => r.type === "subcontractor").reduce((s, r) => s + (r.total || 0), 0),
    disposalCost:      allRows.filter(r => r.type === "disposal")     .reduce((s, r) => s + (r.total || 0), 0),
    overheadCost:      allRows.filter(r => r.type === "overhead")     .reduce((s, r) => s + (r.total || 0), 0),
  };
}

export async function saveDraftToSupabase(
  title: string,
  totalIncVat: number,
  customerPays: number,
  quoteData: any
): Promise<{ id: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Inte inloggad" };

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      user_id:        user.id,
      title,
      description:    "",
      customer_name:  "",
      customer_email: "",
      total_inc_vat:  totalIncVat,
      customer_pays:  customerPays,
      status:         "draft",
      quote_data:     quoteData,
      settings_data:  {},
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export async function saveQuoteToSupabase(
  title: string,
  description: string,
  customerName: string,
  customerEmail: string,
  totalIncVat: number,
  customerPays: number,
  quoteData: any,
  settingsData: any,
  options?: { jobType?: string; location?: string; buildParams?: Record<string, string> }
): Promise<{ id: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Inte inloggad" };

  const t = quoteData?.totals || {};

  let labor: number, material: number, sub: number, disposal: number, overhead: number;
  if (t.labor_total !== undefined) {
    labor    = t.labor_total || 0;
    material = t.material_total || 0;
    sub      = t.subcontractor_total || 0;
    disposal = t.disposal_total || 0;
    overhead = t.overhead_total || 0;
  } else {
    const c = calcCosts(quoteData);
    labor = c.laborCost; material = c.materialCost; sub = c.subcontractorCost;
    disposal = c.disposalCost; overhead = c.overheadCost;
  }

  const workItems   = extractWorkItems(quoteData);
  const complexity  = detectComplexity(quoteData);

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      user_id:        user.id,
      title, description,
      customer_name:  customerName,
      customer_email: customerEmail,
      total_inc_vat:  totalIncVat,
      customer_pays:  customerPays,
      status:         "sent",
      quote_data:     quoteData,
      settings_data:  settingsData,

      project_type:   options?.jobType || "ovrigt",
      region:         options?.location || null,
      complexity,

      labor_cost:         labor    > 0 ? Math.round(labor)    : null,
      material_cost:      material > 0 ? Math.round(material) : null,
      subcontractor_cost: sub      > 0 ? Math.round(sub)      : null,
      disposal_cost:      disposal > 0 ? Math.round(disposal) : null,
      overhead_cost:      overhead > 0 ? Math.round(overhead) : null,
      rot_deduction:      t.rot_deduction > 0 ? Math.round(t.rot_deduction) : null,
      customer_net_cost:  customerPays > 0 ? Math.round(customerPays) : null,

      work_items:         workItems.length > 0 ? workItems : null,
      craftsman_name:     settingsData?.contact_name || null,

      pricing_snapshot:   quoteData?.pricing_snapshot || null,

      outcome:        "pending",
      ai_generated:   true,
      ai_confidence:  null,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export async function getQuoteById(id: string): Promise<QuoteRecord | null> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data as QuoteRecord;
}

export async function acceptQuote(id: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("quotes")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getUserQuotes(): Promise<QuoteRecord[]> {
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as QuoteRecord[];
}

export async function updateOutcome(
  id: string, outcome: "won" | "lost" | "pending", lostReason?: string
): Promise<{ success: boolean; error?: string }> {
  const updateData: Record<string, any> = { outcome };
  if (outcome === "lost" && lostReason) updateData.lost_reason = lostReason;
  if (outcome === "won") updateData.lost_reason = null;
  const { error } = await supabase
    .from("quotes")
    .update(updateData)
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
