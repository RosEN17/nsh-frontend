// Spara kalkyler i localStorage
const ESTIMATES_KEY = "byggkalk_estimates";

export interface SavedEstimate {
  id: string;
  created: string;
  description: string;
  job_type?: string;
  total_inc_vat: number;
  customer_pays: number;
  data: any;
  supabase_id?: string; // satt när utkastet är sparat till Supabase
}

export function getEstimates(): SavedEstimate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ESTIMATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveEstimate(est: SavedEstimate) {
  const all = getEstimates();
  all.unshift(est);
  localStorage.setItem(ESTIMATES_KEY, JSON.stringify(all.slice(0, 100)));
}

export function deleteEstimate(id: string) {
  const all = getEstimates().filter(e => e.id !== id);
  localStorage.setItem(ESTIMATES_KEY, JSON.stringify(all));
}

export function renameEstimate(id: string, newName: string) {
  const all = getEstimates();
  const est = all.find(e => e.id === id);
  if (est) {
    est.description = newName;
    localStorage.setItem(ESTIMATES_KEY, JSON.stringify(all));
  }
}

export function setSupabaseId(id: string, supabaseId: string) {
  const all = getEstimates();
  const est = all.find(e => e.id === id);
  if (est) {
    est.supabase_id = supabaseId;
    localStorage.setItem(ESTIMATES_KEY, JSON.stringify(all));
  }
}

export function clearEstimates() {
  localStorage.removeItem(ESTIMATES_KEY);
}
