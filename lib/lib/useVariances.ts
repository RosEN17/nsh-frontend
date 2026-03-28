"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type VarianceItem = {
  id:         string;
  konto:      string;
  label:      string;
  category:   string;
  period:     string;
  actual:     number | null;
  budget:     number | null;
  impact:     number | null;
  impact_pct: number | null;
  status:     "Att hantera" | "Utredd" | "Godkänd" | "Skickad";
  owner_id:   string | null;
  ai_summary: string | null;
  notes:      string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
};

export function useVariances(companyId: string | null) {
  const [items,   setItems]   = useState<VarianceItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("variance_items")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  async function saveFromPack(packRows: any[], companyId: string, period: string) {
    const rows = packRows.map((r) => ({
      company_id: companyId,
      konto:      r.konto   || r.Konto   || "",
      label:      r.label   || r.Label   || r.Konto || "",
      category:   r.category || "",
      period,
      actual:     r.actual  ?? r.Utfall  ?? null,
      budget:     r.budget  ?? r.Budget  ?? null,
      impact:     r.impact  ?? r["Vs budget diff"] ?? null,
      impact_pct: r.impactPct ?? r["Vs budget %"] ?? null,
      status:     "Att hantera",
    }));

    const { error } = await supabase.from("variance_items").upsert(rows, {
      onConflict: "company_id,konto,period",
      ignoreDuplicates: false,
    });
    if (!error) load();
    return !error;
  }

  async function updateStatus(id: string, status: VarianceItem["status"]) {
    await supabase.from("variance_items").update({ status }).eq("id", id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
  }

  async function assignOwner(id: string, owner_id: string) {
    await supabase.from("variance_items").update({ owner_id }).eq("id", id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, owner_id } : i));
  }

  async function saveAiSummary(id: string, ai_summary: string) {
    await supabase.from("variance_items").update({ ai_summary }).eq("id", id);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ai_summary } : i));
  }

  async function bulkUpdateStatus(ids: string[], status: VarianceItem["status"]) {
    await supabase.from("variance_items").update({ status }).in("id", ids);
    setItems((prev) => prev.map((i) => ids.includes(i.id) ? { ...i, status } : i));
  }

  return { items, loading, load, saveFromPack, updateStatus, assignOwner, saveAiSummary, bulkUpdateStatus };
}
