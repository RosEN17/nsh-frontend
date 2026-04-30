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
  // AI-träningsfält
  outcome: string | null;
  lost_reason: string | null;
  craftsman_edits: any | null;
  labor_cost: number | null;
  material_cost: number | null;
  subcontractor_cost: number | null;
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
}

// ── Gissa complexity från kalkylen ─────────────────────────────────────────
function detectComplexity(result: any): string {
  const allRows: any[] = (result.categories || []).flatMap((c: any) => c.rows || []);
  const workText = allRows.map((r: any) => (r.description || "").toLowerCase()).join(" ");
  const totalHours = allRows
    .filter((r: any) => r.type === "labor")
    .reduce((sum: number, r: any) => sum + (r.quantity || 0), 0);

  if (
    workText.includes("ny vägg") || workText.includes("bärande") ||
    workText.includes("bygglov") || workText.includes("flytt av vvb") ||
    workText.includes("tillbyggnad")
  ) return "specialist";

  if (
    workText.includes("brunnsflytt") || workText.includes("flytt av brunn") ||
    workText.includes("nytt avlopp") || workText.includes("framdragning") ||
    workText.includes("golvvärme") || workText.includes("fuktskada")
  ) return "high";

  if (totalHours > 80) return "high";
  if (totalHours > 40) return "medium";
  return "low";
}

// ── Extrahera arbetsmoment (labor + UE) från kalkylen ────────────────────
function extractWorkItems(result: any): string[] {
  return (result.categories || [])
    .flatMap((c: any) => c.rows || [])
    .filter((r: any) =>
      (r.type === "labor" || r.type === "subcontractor") && r.description
    )
    .map((r: any) => r.description as string);
}

// ── Beräkna costs från kategorirader (fallback om totals saknas) ──────────
function calcCosts(result: any): {
  laborCost: number;
  materialCost: number;
  subcontractorCost: number;
} {
  const allRows: any[] = (result.categories || []).flatMap((c: any) => c.rows || []);
  return {
    laborCost:         allRows.filter(r => r.type === "labor")        .reduce((s, r) => s + (r.total || 0), 0),
    materialCost:      allRows.filter(r => r.type === "material")     .reduce((s, r) => s + (r.total || 0), 0),
    subcontractorCost: allRows.filter(r => r.type === "subcontractor").reduce((s, r) => s + (r.total || 0), 0),
  };
}

function estimateWasteFactor(result: any): number {
  const assumptions: string[] = result.assumptions || [];
  for (const a of assumptions) {
    const match = a.match(/(\d+)[%\s]*svinn/i);
    if (match) return parseInt(match[1]) / 100;
  }
  return 0.12;
}


// ─────────────────────────────────────────────────────────────────────────────
// saveDraftToSupabase
// ─────────────────────────────────────────────────────────────────────────────

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
      user_id:      user.id,
      title,
      description:  "",
      customer_name:  "",
      customer_email: "",
      total_inc_vat:  totalIncVat,
      customer_pays:  customerPays,
      status:       "draft",
      quote_data:   quoteData,
      settings_data: {},
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}


// ─────────────────────────────────────────────────────────────────────────────
// saveQuoteToSupabase — sparar inkl. UE-kostnad
// ─────────────────────────────────────────────────────────────────────────────

export async function saveQuoteToSupabase(
  title: string,
  description: string,
  customerName: string,
  customerEmail: string,
  totalIncVat: number,
  customerPays: number,
  quoteData: any,
  settingsData: any,
  options?: {
    jobType?: string;
    location?: string;
    buildParams?: Record<string, string>;
  }
): Promise<{ id: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Inte inloggad" };

  const t = quoteData?.totals || {};

  // Kostnader — försök från totals, fallback till kategorirader
  let laborCost: number;
  let materialCost: number;
  let subcontractorCost: number;
  if (t.labor_total !== undefined) {
    laborCost         = t.labor_total || 0;
    materialCost      = t.material_total || 0;
    subcontractorCost = t.subcontractor_total || 0;
  } else {
    const c = calcCosts(quoteData);
    laborCost         = c.laborCost;
    materialCost      = c.materialCost;
    subcontractorCost = c.subcontractorCost;
  }

  const workItems   = extractWorkItems(quoteData);
  const complexity  = detectComplexity(quoteData);
  const wasteFactor = estimateWasteFactor(quoteData);

  let tilePricePerSqm: number | null = null;
  const tileMatch = (quoteData?.assumptions || [])
    .join(" ")
    .match(/(\d+)\s*kr\/kvm.*kakel/i);
  if (tileMatch) tilePricePerSqm = parseInt(tileMatch[1]);

  let riskFactor: number | null = null;
  const riskMatch = (quoteData?.assumptions || [])
    .join(" ")
    .match(/(\d+)[%\s]*risk/i);
  if (riskMatch) riskFactor = parseInt(riskMatch[1]) / 100;

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      user_id:        user.id,
      title,
      description,
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

      labor_cost:         laborCost > 0 ? Math.round(laborCost) : null,
      material_cost:      materialCost > 0 ? Math.round(materialCost) : null,
      subcontractor_cost: subcontractorCost > 0 ? Math.round(subcontractorCost) : null,
      rot_deduction:      t.rot_deduction > 0 ? Math.round(t.rot_deduction) : null,
      customer_net_cost:  customerPays > 0 ? Math.round(customerPays) : null,

      work_items:         workItems.length > 0 ? workItems : null,
      waste_factor:       wasteFactor,
      risk_factor:        riskFactor,
      tile_price_per_sqm: tilePricePerSqm,
      craftsman_name:     settingsData?.contact_name || null,

      outcome:        "pending",
      ai_generated:   true,
      ai_confidence:  null,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}


// ─────────────────────────────────────────────────────────────────────────────
// Övriga funktioner
// ─────────────────────────────────────────────────────────────────────────────

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
    .update({
      status:      "accepted",
      accepted_at: new Date().toISOString(),
    })
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
  id: string,
  outcome: "won" | "lost" | "pending",
  lostReason?: string
): Promise<{ success: boolean; error?: string }> {
  const updateData: Record<string, any> = { outcome };

  if (outcome === "lost" && lostReason) {
    updateData.lost_reason = lostReason;
  }
  if (outcome === "won") {
    updateData.lost_reason = null;
  }

  const { error } = await supabase
    .from("quotes")
    .update(updateData)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
