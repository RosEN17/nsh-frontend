import { supabase } from "./supabase";

export async function updateCompanyName(name: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("companies")
    .update({ name })
    .eq("user_id", user.id);
}
