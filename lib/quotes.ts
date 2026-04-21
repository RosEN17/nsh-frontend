import { supabase } from "./supabase";

// ═══════════════════════════════════════════════════════════════
// BYGGLET INTEGRATION — byt ut denna funktion när ni har API-nyckel
// ═══════════════════════════════════════════════════════════════
async function createByggletProject(quote: any): Promise<{ success: boolean; project_id?: string; error?: string }> {
  // TODO: Ersätt med riktigt Bygglet API-anrop
  // Exempel på hur det troligen ser ut:
  //
  // const res = await fetch("https://api.bygglet.com/v1/projects", {
  //   method: "POST",
  //   headers: {
  //     "Authorization": `Bearer ${process.env.NEXT_PUBLIC_BYGGLET_API_KEY}`,
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify({
  //     name: quote.title,
  //     description: quote.description,
  //     customer_name: quote.customer_name,
  //     customer_email: quote.customer_email,
  //     budget: quote.customer_pays,
  //   }),
  // });
  // const data = await res.json();
  // return { success: res.ok, project_id: data.id };

  console.log("[Bygglet placeholder] Skulle skapa projekt:", quote.title);
  return { success: true, project_id: "placeholder-" + Date.now() };
}
// ═══════════════════════════════════════════════════════════════

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
  // 1. Markera som accepterad i Supabase
  const { error } = await supabase
    .from("quotes")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  // 2. Hämta hela offerten
  const quote = await getQuoteById(id);
  if (!quote) return { success: false, error: "Offert hittades inte" };

  // 3. Skapa projekt i Bygglet (placeholder tills API finns)
  const bygglet = await createByggletProject(quote);
  if (!bygglet.success) {
    console.error("[Bygglet] Kunde inte skapa projekt:", bygglet.error);
  }

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
