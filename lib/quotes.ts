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
  rot_deduction: number | null;
  customer_net_cost: number | null;
  project_type: string | null;
  region: string | null;          // Var JOBBET utförs — från Plats-fältet per kalkyl
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

// ── Extrahera arbetsmoment (labor-rader) från kalkylen ────────────────────
function extractWorkItems(result: any): string[] {
  return (result.categories || [])
    .flatMap((c: any) => c.rows || [])
    .filter((r: any) => r.type === "labor" && r.description)
    .map((r: any) => r.description as string);
}

// ── Beräkna labor_cost och material_cost från kategorirader ──────────────
// Används som fallback om result.totals saknas
function calcCosts(result: any): { laborCost: number; materialCost: number } {
  const allRows: any[] = (result.categories || []).flatMap((c: any) => c.rows || []);
  return {
    laborCost:    allRows.filter(r => r.type === "labor")   .reduce((s, r) => s + (r.total || 0), 0),
    materialCost: allRows.filter(r => r.type === "material").reduce((s, r) => s + (r.total || 0), 0),
  };
}

// ── Räkna ut svinnfaktor från material vs totalt material ────────────────
// Approximation: om material_total inkluderar svinn jämfört med ren kostnad
function estimateWasteFactor(result: any): number {
  // AI:n skriver alltid svinn i assumptions — leta efter det
  const assumptions: string[] = result.assumptions || [];
  for (const a of assumptions) {
    const match = a.match(/(\d+)[%\s]*svinn/i);
    if (match) return parseInt(match[1]) / 100;
  }
  // Standard för badrum om inget hittas
  return 0.12;
}


// ─────────────────────────────────────────────────────────────────────────────
// saveDraftToSupabase — spara utkast (minimal data)
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
// saveQuoteToSupabase — spara skickad offert med alla AI-träningsfält
//
// Fältmappning:
//   region          ← location (Plats-fältet per jobb, INTE företagets adress)
//   labor_cost      ← result.totals.labor_total (exkl. moms, exkl. påslag)
//   material_cost   ← result.totals.material_total
//   rot_deduction   ← result.totals.rot_deduction
//   customer_net_cost ← result.totals.customer_pays
//   work_items      ← alla labor-rader ur kalkylen
//   complexity      ← beräknas från arbetsmoment och timmar
//   waste_factor    ← hämtas ur assumptions om AI:n nämner svinn
//   craftsman_name  ← settings.contact_name
//   tile_price_per_sqm ← build_params.tile_height (om angivet)
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
  // Extra parametrar för AI-träningsfält
  options?: {
    jobType?: string;
    location?: string;       // Var jobbet utförs — från Plats-fältet
    buildParams?: Record<string, string>;
  }
): Promise<{ id: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Inte inloggad" };

  const t = quoteData?.totals || {};
  const meta = quoteData?.meta || {};

  // Beräkna costs — försök från totals, fallback till kategorirader
  const { laborCost, materialCost } = t.labor_total
    ? { laborCost: t.labor_total, materialCost: t.material_total || 0 }
    : calcCosts(quoteData);

  // Extrahera arbetsmoment
  const workItems = extractWorkItems(quoteData);

  // Gissa complexity
  const complexity = detectComplexity(quoteData);

  // Svinnfaktor
  const wasteFactor = estimateWasteFactor(quoteData);

  // Kakel/klinker pris per kvm — från build_params om angivet
  // (snickaren fyller inte in detta direkt men AI:n kan nämna det)
  let tilePricePerSqm: number | null = null;
  const tileMatch = (quoteData?.assumptions || [])
    .join(" ")
    .match(/(\d+)\s*kr\/kvm.*kakel/i);
  if (tileMatch) tilePricePerSqm = parseInt(tileMatch[1]);

  // Risk factor — leta i assumptions
  let riskFactor: number | null = null;
  const riskMatch = (quoteData?.assumptions || [])
    .join(" ")
    .match(/(\d+)[%\s]*risk/i);
  if (riskMatch) riskFactor = parseInt(riskMatch[1]) / 100;

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      // ── Grunddata ──
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

      // ── Projektinfo ──
      project_type:   options?.jobType || "ovrigt",
      region:         options?.location || null,  // Var JOBBET utförs
      complexity,

      // ── Ekonomi (exkl. moms, exkl. påslag — råvärden för AI) ──
      labor_cost:        laborCost > 0 ? Math.round(laborCost) : null,
      material_cost:     materialCost > 0 ? Math.round(materialCost) : null,
      rot_deduction:     t.rot_deduction > 0 ? Math.round(t.rot_deduction) : null,
      customer_net_cost: customerPays > 0 ? Math.round(customerPays) : null,

      // ── AI-träningsfält ──
      work_items:         workItems.length > 0 ? workItems : null,
      waste_factor:       wasteFactor,
      risk_factor:        riskFactor,
      tile_price_per_sqm: tilePricePerSqm,
      craftsman_name:     settingsData?.contact_name || null,

      // ── Outcome (pending tills snickaren markerar won/lost) ──
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
// Övriga funktioner (oförändrade)
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
