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
  outcome: string | null;       // won | lost | pending
  lost_reason: string | null;
  craftsman_edits: any | null;
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
      user_id: user.id,
      title,
      description: "",
      customer_name: "",
      customer_email: "",
      total_inc_vat: totalIncVat,
      customer_pays: customerPays,
      status: "draft",
      quote_data: quoteData,
      settings_data: {},
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
  settingsData: any
): Promise<{ id: string | null; error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null, error: "Inte inloggad" };

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      user_id: user.id,
      title,
      description,
      customer_name: customerName,
      customer_email: customerEmail,
      total_inc_vat: totalIncVat,
      customer_pays: customerPays,
      status: "sent",
      quote_data: quoteData,
      settings_data: settingsData,
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
    .update({
      status: "accepted",
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

// ── NY: Uppdatera outcome (won/lost/pending) direkt från UI ──────────────────
// Kallas när snickaren klickar Vann eller Förlorade på en offert.
// Skriver till quotes-tabellens outcome och lost_reason-kolumner.
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
    updateData.lost_reason = null;  // Rensa om man ångrar sig
  }

  const { error } = await supabase
    .from("quotes")
    .update(updateData)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
