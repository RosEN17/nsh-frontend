"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { createEstimate } from "@/lib/api";
import { saveEstimate, getEstimates, setSupabaseId } from "@/lib/store";
import { saveQuoteToSupabase, saveDraftToSupabase } from "@/lib/quotes";
import RowFeedbackModal, { RowEdit, QuoteRow } from "@/components/RowFeedbackModal";

// ── Jobbtyper ────────────────────────────────────────────────────────────────
const JOB_TYPES = [
  { id: "badrum",      label: "Badrum",      icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 9h12v3a2 2 0 01-2 2H4a2 2 0 01-2-2V9z"/><path d="M2 9V5a2 2 0 012-2h1v6" strokeLinecap="round"/><circle cx="11" cy="5" r="1.5"/></svg> },
  { id: "kok",         label: "Kök",         icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="5" width="14" height="9" rx="1.5"/><path d="M4 5V4a1 1 0 011-1h6a1 1 0 011 1v1" strokeLinecap="round"/><path d="M5 9h2M9 9h2" strokeLinecap="round"/></svg> },
  { id: "tak",         label: "Tak",         icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1 14h14M2 14V8l6-6 6 6v6" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id: "fasad",       label: "Fasad",       icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="1" width="14" height="14" rx="1.5"/><path d="M1 6h14M6 6v8M10 6v8" strokeWidth="1"/></svg> },
  { id: "golv",        label: "Golv",        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="10" width="14" height="4" rx="1"/><path d="M3 10V7M7 10V5M11 10V7M13 10V6" strokeLinecap="round"/></svg> },
  { id: "malning",     label: "Målning",     icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 12L10 5l2 2-7 7-2-2z"/><path d="M12 3l1 1-1 1-1-1 1-1z" strokeLinejoin="round"/><path d="M3 12l-1 2 2-1" strokeLinecap="round"/></svg> },
  { id: "el",          label: "El",          icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M9 2L5 9h5l-3 5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id: "vvs",         label: "VVS",         icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 3v4a2 2 0 002 2h6a2 2 0 012 2v2" strokeLinecap="round"/><circle cx="3" cy="3" r="1.5"/><circle cx="13" cy="13" r="1.5"/></svg> },
  { id: "tillbyggnad", label: "Tillbyggnad", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="7" width="7" height="8" rx="1"/><rect x="8" y="1" width="7" height="8" rx="1"/></svg> },
  { id: "ovrigt",      label: "Övrigt",      icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M8 5v6M5 8h6" strokeLinecap="round"/></svg> },
];

interface FieldDef { key: string; label: string; unit: string; defaultVal: string; hint: string; type?: "text" | "number" | "select"; options?: string[]; }
interface CheckDef { key: string; label: string; defaultOn: boolean; }
interface JobParams { pill: string; fields: FieldDef[]; checks: CheckDef[]; }

const JOB_PARAMS: Record<string, JobParams> = {
  badrum: { pill: "AI beräknar kakelyta, tätskikt och material exakt", fields: [{ key: "floor_sqm", label: "Golvyta", unit: "m²", defaultVal: "", hint: "Klinker/kakel golv + tätskikt", type: "number" }, { key: "ceiling_height", label: "Takhöjd", unit: "m", defaultVal: "2.4", hint: "Beräknar total väggarea", type: "number" }, { key: "tiled_walls", label: "Kaklade väggar", unit: "st", defaultVal: "4", hint: "Antal väggar som kaklas", type: "number" }, { key: "tile_height", label: "Kakelhöjd på vägg", unit: "m", defaultVal: "2.4", hint: "Full = takhöjd, annars ange höjd", type: "number" }, { key: "openings", label: "Dörrar & fönster", unit: "st", defaultVal: "1", hint: "Dras av från väggyta", type: "number" }, { key: "location", label: "Plats", unit: "", defaultVal: "", hint: "Påverkar materialpris & ROT", type: "text" }], checks: [{ key: "shower_glass", label: "Dusch med glasvägg", defaultOn: true }, { key: "bathtub", label: "Badkar", defaultOn: false }, { key: "toilet_sink", label: "Toalett & handfat", defaultOn: true }, { key: "demo_tiles", label: "Riva befintligt kakel", defaultOn: true }, { key: "floor_heating", label: "Golvvärme", defaultOn: false }] },
  kok: { pill: "AI beräknar skåp, bänkskiva och installation", fields: [{ key: "kitchen_width", label: "Kökets bredd", unit: "m", defaultVal: "", hint: "Totalt löpmeter köksskåp", type: "number" }, { key: "base_cabinets", label: "Antal basskåp", unit: "st", defaultVal: "", hint: "60 cm-moduler under bänk", type: "number" }, { key: "wall_cabinets", label: "Antal hängskåp", unit: "st", defaultVal: "", hint: "Skåp ovan bänk", type: "number" }, { key: "countertop_len", label: "Bänkskivans längd", unit: "m", defaultVal: "", hint: "Inkl. hörn om L-kök", type: "number" }, { key: "location", label: "Plats", unit: "", defaultVal: "", hint: "Påverkar priser & ROT", type: "text" }], checks: [{ key: "demo_kitchen", label: "Rivning av gammalt kök", defaultOn: true }, { key: "dishwasher", label: "Ny diskmaskin", defaultOn: false }, { key: "stove", label: "Ny spis/häll", defaultOn: false }, { key: "backsplash", label: "Kakel/stänkskydd", defaultOn: true }, { key: "ventilation", label: "Ny ventilation", defaultOn: false }] },
  tak: { pill: "AI beräknar takarea, läktning och material", fields: [{ key: "roof_area", label: "Takarea", unit: "m²", defaultVal: "", hint: "Hela takytans area", type: "number" }, { key: "roof_pitch", label: "Taklutning", unit: "°", defaultVal: "27", hint: "Grader — påverkar materialåtgång", type: "number" }, { key: "roof_type", label: "Takets form", unit: "", defaultVal: "Sadeltak", hint: "Välj typ", type: "select", options: ["Sadeltak", "Valmat tak", "Pulpettak", "Platt tak", "Mansardtak"] }, { key: "location", label: "Plats", unit: "", defaultVal: "", hint: "Vindlast & materialpris", type: "text" }], checks: [{ key: "demo_roof", label: "Riva gamla takpannor", defaultOn: true }, { key: "underlay", label: "Ny undertäckning", defaultOn: true }, { key: "gutters", label: "Ny ränndal", defaultOn: false }, { key: "skylight", label: "Takfönster", defaultOn: false }, { key: "vent_hood", label: "Ventilationshuv", defaultOn: false }] },
  fasad: { pill: "AI beräknar fasadarea och materialåtgång", fields: [{ key: "perimeter", label: "Husomkrets", unit: "m", defaultVal: "", hint: "Totalt omfång i meter", type: "number" }, { key: "facade_height", label: "Fasadhöjd", unit: "m", defaultVal: "", hint: "Mark till takfot", type: "number" }, { key: "windows", label: "Antal fönster", unit: "st", defaultVal: "", hint: "Dras av från fasadyta", type: "number" }, { key: "doors", label: "Antal dörrar", unit: "st", defaultVal: "", hint: "Dras av från fasadyta", type: "number" }, { key: "location", label: "Plats", unit: "", defaultVal: "", hint: "Påverkar priser", type: "text" }], checks: [{ key: "demo_panel", label: "Riva befintlig panel", defaultOn: false }, { key: "barge_board", label: "Ny vindskiva", defaultOn: true }, { key: "window_flashing", label: "Ny fönsterbleck", defaultOn: false }, { key: "painting", label: "Målning ingår", defaultOn: false }] },
  golv: { pill: "AI beräknar golvyta, underlag och material", fields: [{ key: "floor_sqm", label: "Golvyta", unit: "m²", defaultVal: "", hint: "Total yta att lägga", type: "number" }, { key: "room_width", label: "Rumsbredd (smalast)", unit: "m", defaultVal: "", hint: "Påverkar spill vid läggning", type: "number" }, { key: "floor_type", label: "Golvtyp", unit: "", defaultVal: "Parkett", hint: "Material att lägga", type: "select", options: ["Parkett", "Laminat", "Klinker", "Marmor", "Vinyl/LVT", "Mosaik"] }, { key: "location", label: "Plats", unit: "", defaultVal: "", hint: "Påverkar priser", type: "text" }], checks: [{ key: "demo_floor", label: "Riva befintligt golv", defaultOn: true }, { key: "leveling", label: "Avjämning krävs", defaultOn: false }, { key: "floor_heating", label: "Golvvärme under", defaultOn: false }, { key: "skirting", label: "Sockel/list ingår", defaultOn: true }] },
  malning: { pill: "AI beräknar färgåtgång och arbetstid exakt", fields: [{ key: "wall_sqm", label: "Väggyta att måla", unit: "m²", defaultVal: "", hint: "Total väggarea", type: "number" }, { key: "ceiling_height", label: "Takhöjd", unit: "m", defaultVal: "2.4", hint: "Används för beräkning", type: "number" }, { key: "rooms", label: "Antal rum", unit: "st", defaultVal: "", hint: "Påverkar flytt & setup-tid", type: "number" }, { key: "location", label: "Plats", unit: "", defaultVal: "", hint: "Påverkar priser", type: "text" }], checks: [{ key: "ceiling", label: "Tak ingår", defaultOn: true }, { key: "walls", label: "Väggar ingår", defaultOn: true }, { key: "spackling", label: "Spackla & slipa först", defaultOn: false }, { key: "trim", label: "Fönster/dörrkarm", defaultOn: false }, { key: "two_coats", label: "2 strykningar", defaultOn: true }] },
  el: { pill: "AI beräknar kabel, uttag och arbetstid", fields: [{ key: "outlets", label: "Antal uttag/brytare", unit: "st", defaultVal: "", hint: "Nya eluttag att dra", type: "number" }, { key: "cable_meters", label: "Kabelledning", unit: "m", defaultVal: "", hint: "Uppskattad kabelsträcka", type: "number" }, { key: "fixtures", label: "Antal armaturer", unit: "st", defaultVal: "", hint: "Takdosor & lamputtag", type: "number" }, { key: "location", label: "Plats", unit: "", defaultVal: "", hint: "Påverkar priser", type: "text" }], checks: [{ key: "fusebox", label: "Elcentral/proppskåp", defaultOn: false }, { key: "rcd", label: "Jordfelsbrytare", defaultOn: true }, { key: "thermostat", label: "Golvvärme-termostat", defaultOn: false }, { key: "inspection", label: "Elbesiktning ingår", defaultOn: false }] },
  vvs: { pill: "AI beräknar rör, kopplingar och arbetstid", fields: [{ key: "taps", label: "Antal blandare", unit: "st", defaultVal: "", hint: "Kök, bad, tvätt...", type: "number" }, { key: "pipe_meters", label: "Ny rörledning", unit: "m", defaultVal: "", hint: "Meter ny rördragning", type: "number" }, { key: "drains", label: "Antal avlopp", unit: "st", defaultVal: "", hint: "Golvbrunnar & anslutningar", type: "number" }, { key: "location", label: "Plats", unit: "", defaultVal: "", hint: "Påverkar priser", type: "text" }], checks: [{ key: "water_heater", label: "Ny varmvattenberedare", defaultOn: false }, { key: "radiator", label: "Ny radiator", defaultOn: false }, { key: "laundry", label: "Ny tvättpunkt", defaultOn: true }, { key: "backflow", label: "Backventil", defaultOn: false }] },
  tillbyggnad: { pill: "AI beräknar stomme, isolering och ytskikt", fields: [{ key: "addition_sqm", label: "Tillbyggnadsarea", unit: "m²", defaultVal: "", hint: "Bruttoarea ny del", type: "number" }, { key: "ceiling_height", label: "Takhöjd", unit: "m", defaultVal: "2.4", hint: "Invändig takhöjd", type: "number" }, { key: "windows", label: "Antal fönster", unit: "st", defaultVal: "", hint: "Nya fönster i tillbyggnad", type: "number" }, { key: "location", label: "Plats", unit: "", defaultVal: "", hint: "Påverkar priser", type: "text" }], checks: [{ key: "slab", label: "Platta på mark", defaultOn: true }, { key: "crawl_space", label: "Krypgrund", defaultOn: false }, { key: "heating", label: "Radiatorer/golvvärme", defaultOn: true }, { key: "electricity", label: "El i tillbyggnad", defaultOn: true }] },
  ovrigt: { pill: "Fyll i det som är relevant för ditt jobb", fields: [{ key: "area_sqm", label: "Yta / area", unit: "m²", defaultVal: "", hint: "Om relevant för jobbet", type: "number" }, { key: "units", label: "Antal enheter", unit: "st", defaultVal: "", hint: "T.ex. antal objekt, rum...", type: "number" }, { key: "location", label: "Plats", unit: "", defaultVal: "", hint: "Påverkar priser & ROT", type: "text" }], checks: [{ key: "demo", label: "Rivning/demontering", defaultOn: false }, { key: "cleaning", label: "Städning efter jobb", defaultOn: false }] },
};

function fmtKr(n: number) {
  return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n) + " kr";
}

function getSettings() {
  if (typeof window === "undefined") return {} as any;
  try { return JSON.parse(localStorage.getItem("byggkalk_settings") || "{}"); } catch { return {}; }
}

// ── Beräkna totals från categories ──────────────────────────────────────────
// Kallas varje gång categories ändras så att summering alltid är korrekt
function calcTotals(categories: any[], meta: any, includeRot: boolean) {
  let laborTotal    = 0;
  let materialTotal = 0;
  let equipTotal    = 0;

  for (const cat of categories) {
    for (const row of cat.rows || []) {
      const t = row.total || 0;
      if (row.type === "labor")     laborTotal    += t;
      else if (row.type === "material") materialTotal += t;
      else if (row.type === "equipment") equipTotal += t;
      else materialTotal += t; // okänd typ räknas som material
    }
  }

  const marginPct    = meta?.margin_pct || 0;
  const subtotalExMargin = laborTotal + materialTotal + equipTotal;
  const marginAmount = Math.round(subtotalExMargin * marginPct / 100);
  const totalExVat   = subtotalExMargin + marginAmount;
  const vat          = Math.round(totalExVat * 0.25);
  const totalIncVat  = totalExVat + vat;

  // ROT: 30% på arbetskostnad inkl. moms, max 50 000 kr per person
  // Vi räknar enkel variant: 30% på labor inkl moms, cap 50 000
  const laborIncVat  = Math.round((laborTotal + Math.round(laborTotal * marginPct / 100)) * 1.25);
  const rotDeduction = includeRot ? Math.min(Math.round(laborIncVat * 0.3), 50000) : 0;
  const customerPays = totalIncVat - rotDeduction;

  return {
    labor_total:    laborTotal,
    material_total: materialTotal,
    equipment_total: equipTotal,
    margin_amount:  marginAmount,
    subtotal_ex_vat: subtotalExMargin,
    total_ex_vat:   totalExVat,
    vat,
    total_inc_vat:  totalIncVat,
    rot_deduction:  rotDeduction,
    customer_pays:  customerPays,
  };
}

// ── HTML-generering ──────────────────────────────────────────────────────────
function generateQuoteHTML(result: any, cats: any[], totals: ReturnType<typeof calcTotals>, settings: any) {
  const today      = new Date().toLocaleDateString("sv-SE");
  const validDays  = settings.quote_validity_days || 30;
  const validUntil = new Date(Date.now() + validDays * 86400000).toLocaleDateString("sv-SE");
  const quoteNr    = "OFF-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);
  const companyName = settings.company_name || "Företagsnamn";
  const hourlyRate  = result.meta?.hourly_rate || settings.hourly_rate || 650;

  let rowsHTML = "";
  for (const cat of cats) {
    rowsHTML += `<tr style="background:#f5f5f5"><td colspan="5" style="padding:10px 12px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #e0e0e0;color:#444">${cat.name}</td></tr>`;
    for (const row of cat.rows || []) {
      rowsHTML += `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;color:#222">${row.description}${row.note ? `<br><span style="font-size:10px;color:#999">${row.note}</span>` : ""}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;color:#888;text-align:center">${row.unit}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:'Courier New',monospace">${row.quantity}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:'Courier New',monospace">${fmtKr(row.unit_price)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:'Courier New',monospace;font-weight:600">${fmtKr(row.total)}</td></tr>`;
    }
    const catSubtotal = (cat.rows || []).reduce((s: number, r: any) => s + (r.total || 0), 0);
    rowsHTML += `<tr style="background:#fafafa"><td colspan="4" style="padding:8px 12px;text-align:right;font-weight:600;font-size:11px;border-bottom:2px solid #ddd;color:#555">Delsumma</td><td style="padding:8px 12px;text-align:right;font-weight:700;font-size:12px;font-family:'Courier New',monospace;border-bottom:2px solid #ddd">${fmtKr(catSubtotal)}</td></tr>`;
  }

  const logoHTML = settings.logo_base64 ? `<img src="${settings.logo_base64}" style="max-height:55px;max-width:180px;object-fit:contain" />` : `<div style="font-size:22px;font-weight:800;color:#1a1a1a">${companyName}</div>`;
  const companyInfoLines = [settings.address, settings.zip_city, settings.phone ? `Tel: ${settings.phone}` : "", settings.email, settings.website].filter(Boolean);
  const anbudsText = settings.quote_intro || "Vi tackar för er förfrågan och erbjuder oss härmed att utföra arbeten på rubricerat projekt i enlighet med erhållet förfrågningsunderlag/platsbesök";
  const prereqLines = settings.quote_prerequisites ? settings.quote_prerequisites.split("\n").filter(Boolean) : ["Att fri framkomlighet finns och att störande arbete kan utföras dagtid 07.00–17.00", "Att ni fritt tillhandahåller el och vatten"];
  const reservationLines = settings.quote_reservations ? settings.quote_reservations.split("\n").filter(Boolean) : ["Byggström tillhandahålls av byggherren", "Markarbeten ingår ej i denna offert"];

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offert ${quoteNr}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;max-width:820px;margin:0 auto;padding:40px;color:#222;font-size:13px;line-height:1.6}@media print{body{padding:20px;font-size:11px}}table{width:100%;border-collapse:collapse}h2{font-size:16px;font-weight:700;margin:0 0 12px;color:#1a1a1a}.divider{border:none;border-top:1px solid #e0e0e0;margin:24px 0}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:3px solid #6a8193"><div>${logoHTML}${settings.org_number ? `<div style="font-size:10px;color:#888;margin-top:1px">Org.nr: ${settings.org_number}</div>` : ""}<div style="font-size:10px;color:#888;margin-top:2px;line-height:1.7">${companyInfoLines.join("<br>")}</div></div><div style="text-align:right"><div style="font-size:26px;font-weight:800;color:#6a8193;letter-spacing:1px">OFFERT</div><div style="font-size:12px;color:#555;margin-top:8px;line-height:1.8"><div>Offertnummer: <strong>${quoteNr}</strong></div><div>Datum: ${today}</div><div>Giltig t.o.m: <strong>${validUntil}</strong></div>${settings.contact_name ? `<div style="margin-top:4px">Kontakt: ${settings.contact_name}${settings.contact_title ? `, ${settings.contact_title}` : ""}</div>` : ""}</div></div></div>
<div style="display:flex;gap:40px;margin-bottom:24px"><div style="flex:1;padding:14px 16px;border:1px dashed #ccc;border-radius:4px;font-size:12px;color:#999"><div style="font-weight:700;color:#666;margin-bottom:8px">KUND</div>Namn: ________________________________<br><br>Adress: ________________________________<br><br>Telefon: ________________________________</div><div style="flex:1;padding:14px 16px;background:#f9f9f9;border-radius:4px;font-size:12px"><div style="font-weight:700;color:#666;margin-bottom:8px">AVSER</div><div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:4px">${result.job_title || "Kalkyl"}</div><div style="color:#666;line-height:1.5">${result.job_summary || ""}</div></div></div>
<p style="margin:0 0 14px;color:#333;line-height:1.7">${anbudsText}</p>
<p style="margin:0 0 6px;font-weight:700;color:#1a1a1a">Anbudssumma förutsätter:</p><ul style="margin:0;padding-left:20px;color:#333;line-height:1.9">${prereqLines.map((l: string) => `<li>${l}</li>`).join("")}</ul>
<hr class="divider">
<h2>Specifikation</h2>
<table style="margin-bottom:20px"><thead><tr style="background:#1a1a1a;color:white"><th style="padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;width:40%">Post</th><th style="padding:9px 12px;text-align:center;font-size:10px;text-transform:uppercase">Enhet</th><th style="padding:9px 12px;text-align:right;font-size:10px;text-transform:uppercase">Antal</th><th style="padding:9px 12px;text-align:right;font-size:10px;text-transform:uppercase">À-pris</th><th style="padding:9px 12px;text-align:right;font-size:10px;text-transform:uppercase">Summa</th></tr></thead><tbody>${rowsHTML}</tbody></table>
<div style="max-width:360px;margin-left:auto">
<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #eee"><span>Material</span><span>${fmtKr(totals.material_total)}</span></div>
<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #eee"><span>Arbete</span><span>${fmtKr(totals.labor_total)}</span></div>
${totals.equipment_total > 0 ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #eee"><span>Utrustning</span><span>${fmtKr(totals.equipment_total)}</span></div>` : ""}
${totals.margin_amount > 0 ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #eee"><span>Påslag</span><span>${fmtKr(totals.margin_amount)}</span></div>` : ""}
<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #eee"><span>Summa exkl. moms</span><span>${fmtKr(totals.total_ex_vat)}</span></div>
<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #eee"><span>Moms 25%</span><span>${fmtKr(totals.vat)}</span></div>
<div style="display:flex;justify-content:space-between;padding:12px 0;font-size:18px;font-weight:800;border-top:2px solid #1a1a1a;margin-top:4px"><span>Totalt inkl. moms</span><span>${fmtKr(totals.total_inc_vat)}</span></div>
${totals.rot_deduction > 0 ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#16a34a"><span>ROT-avdrag (30% på arbete)</span><span>−${fmtKr(totals.rot_deduction)}</span></div><div style="display:flex;justify-content:space-between;padding:10px 0;font-size:18px;font-weight:800;color:#16a34a;border-top:2px solid #16a34a;margin-top:4px"><span>Att betala</span><span>${fmtKr(totals.customer_pays)}</span></div>` : ""}
</div>
${result.estimated_days ? `<div style="padding:10px 16px;background:#f0f9ff;border-left:3px solid #3b82f6;font-size:12px;color:#1e40af;margin-bottom:16px">Uppskattad tidsåtgång: ca ${result.estimated_days} arbetsdagar</div>` : ""}
<hr class="divider">
<p style="margin:0 0 6px;font-weight:700;color:#1a1a1a">Reservationer:</p><ul style="margin:0;padding-left:20px;color:#333;line-height:1.9">${reservationLines.map((l: string) => `<li>${l}</li>`).join("")}</ul>
<hr class="divider">
<h2>Förutsättningar &amp; villkor</h2>
<div style="margin-bottom:14px"><div style="font-weight:700;margin-bottom:3px">Betalningsvillkor</div><div>${settings.payment_terms || "30 dagar."}</div></div>
<div style="margin-bottom:14px"><div style="font-weight:700;margin-bottom:3px">Offertens giltighetstid</div><div>Offertens giltighetstid gäller ${validDays} dagar från ovanstående datum.</div></div>
<div style="margin-bottom:14px"><div style="font-weight:700;margin-bottom:3px">Tillkommande arbeten</div><div>Arbetad tid debiteras med ${hourlyRate.toLocaleString("sv-SE")},00 exkl. moms<br>Material och underentreprenörer debiteras mot redovisad kostnad +12%</div></div>
${settings.quote_footer ? `<div style="margin-bottom:14px"><div style="font-weight:700;margin-bottom:3px">Övriga villkor</div><div>${settings.quote_footer.replace(/\n/g, "<br>")}</div></div>` : ""}
<hr class="divider">
<div style="display:flex;justify-content:space-between;margin-bottom:32px"><div style="width:45%"><div style="font-size:11px;color:#888;margin-bottom:36px">Leverantör</div><div style="border-top:1px solid #bbb;padding-top:8px;font-size:12px;color:#444">${settings.contact_name || companyName}</div></div><div style="width:45%"><div style="font-size:11px;color:#888;margin-bottom:36px">Kund (godkännande)</div><div style="border-top:1px solid #bbb;padding-top:8px;font-size:12px;color:#888">Namn: ________________________<br>Datum: ________________________</div></div></div>
<div style="border-top:2px solid #6a8193;padding-top:16px"><div style="display:flex;justify-content:space-between;font-size:11px;color:#555"><div><div style="font-weight:700;color:#1a1a1a;font-size:12px;margin-bottom:4px">${companyName}</div>${settings.org_number ? `<div>Org.nr: ${settings.org_number}</div>` : ""}${settings.f_skatt ? `<div>Godkänd för F-skatt</div>` : ""}</div><div>${settings.phone ? `<div>Tel: ${settings.phone}</div>` : ""}${settings.email ? `<div>${settings.email}</div>` : ""}</div><div style="text-align:right">${settings.bankgiro ? `<div>Bankgiro: ${settings.bankgiro}</div>` : ""}${settings.plusgiro ? `<div>Plusgiro: ${settings.plusgiro}</div>` : ""}</div></div></div>
</body></html>`;
}

// ── NameModal ─────────────────────────────────────────────────────────────────
function NameModal({ defaultName, onConfirm, onCancel, title, confirmLabel, saving }: { defaultName: string; onConfirm: (n: string) => void; onCancel: () => void; title: string; confirmLabel: string; saving: boolean }) {
  const [name, setName] = useState(defaultName);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "var(--bg-elevated)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "28px 32px", width: 420, maxWidth: "90vw" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>{title}</div>
        <label className="label">Namn på offerten</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && name.trim()) onConfirm(name.trim()); if (e.key === "Escape") onCancel(); }} autoFocus placeholder="T.ex. Badrumsrenovering Svensson" style={{ marginBottom: 20 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Avbryt</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => name.trim() && onConfirm(name.trim())} disabled={!name.trim() || saving}>{saving ? "Sparar..." : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── EstimateInner ─────────────────────────────────────────────────────────────
function EstimateInner() {
  const searchParams = useSearchParams();
  const viewId = searchParams.get("view");

  const [step, setStep]               = useState<"input" | "loading" | "result">("input");
  const [jobType, setJobType]         = useState("badrum");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [checkValues, setCheckValues] = useState<Record<string, boolean>>({});
  const [description, setDescription] = useState("");
  const [hourlyRate, setHourlyRate]   = useState("650");
  const [marginPct, setMarginPct]     = useState("15");
  const [includeRot, setIncludeRot]   = useState(true);

  const [result, setResult]           = useState<any>(null);
  const [categories, setCategories]   = useState<any[]>([]);

  const [error, setError]             = useState("");
  const [loadingMsg, setLoadingMsg]   = useState("");
  const [saved, setSaved]             = useState(false);
  const [showSources, setShowSources] = useState(false);

  const [allEdits, setAllEdits]       = useState<Record<string, RowEdit>>({});
  const [editingCell, setEditingCell] = useState<{ catIdx: number; rowIdx: number } | null>(null);

  const [showMailModal, setShowMailModal]     = useState(false);
  const [mailStep, setMailStep]               = useState<"form" | "choose">("form");
  const [customerName, setCustomerName]       = useState("");
  const [customerEmail, setCustomerEmail]     = useState("");
  const [sending, setSending]                 = useState(false);
  const [sent, setSent]                       = useState(false);
  const [mailSubject, setMailSubject]         = useState("");
  const [mailBody, setMailBody]               = useState("");
  const [pendingSendName, setPendingSendName] = useState("");
  const [showDraftModal, setShowDraftModal]   = useState(false);
  const [showSendModal, setShowSendModal]     = useState(false);
  const [savingDraft, setSavingDraft]         = useState(false);
  const [localId] = useState(() => crypto.randomUUID());

  const [pdfFiles, setPdfFiles]         = useState<File[]>([]);
  const [imageFiles, setImageFiles]     = useState<File[]>([]);
  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);

  // ── Live-beräkning av totals varje gång categories ändras ──
  const liveTotals = useMemo(
    () => result ? calcTotals(categories, result.meta, includeRot) : null,
    [categories, result, includeRot]
  );

  useEffect(() => {
    const params = JOB_PARAMS[jobType];
    const fv: Record<string, string> = {};
    const cv: Record<string, boolean> = {};
    params.fields.forEach(f => { fv[f.key] = f.defaultVal; });
    params.checks.forEach(c => { cv[c.key] = c.defaultOn; });
    setFieldValues(fv); setCheckValues(cv);
  }, [jobType]);

  useEffect(() => {
    const s = getSettings();
    if (s.hourly_rate) setHourlyRate(String(s.hourly_rate));
    if (s.margin_pct !== undefined) setMarginPct(String(s.margin_pct));
    if (s.include_rot !== undefined) setIncludeRot(s.include_rot);
  }, []);

  useEffect(() => {
    if (viewId) {
      const found = getEstimates().find(e => e.id === viewId);
      if (found) { setResult(found.data); setCategories(JSON.parse(JSON.stringify(found.data.categories || []))); setDescription(found.description); setJobType(found.job_type || "badrum"); setSaved(true); setStep("result"); }
    }
  }, [viewId]);

  useEffect(() => {
    if (result) { setCategories(JSON.parse(JSON.stringify(result.categories || []))); setAllEdits({}); }
  }, [result]);

  function buildAiParams(): Record<string, string> {
    const params = JOB_PARAMS[jobType];
    const out: Record<string, string> = {};
    params.fields.forEach(f => { const v = fieldValues[f.key]; if (v) out[f.key] = f.unit ? `${v} ${f.unit}` : v; });
    const checkedLabels = params.checks.filter(c => checkValues[c.key]).map(c => c.label);
    if (checkedLabels.length > 0) out["ingår_i_jobbet"] = checkedLabels.join(", ");
    out["jobbtyp"] = JOB_TYPES.find(j => j.id === jobType)?.label || jobType;
    return out;
  }

  const loadingMessages = ["Analyserar jobbeskrivningen...", "Beräknar materialåtgång...", "Hämtar aktuella priser...", "Bygger din kalkyl..."];

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result as string); r.onerror = reject; r.readAsDataURL(file); });
  }

  async function handleGenerate() {
    if (!description.trim()) { setError("Beskriv jobbet först."); return; }
    setError(""); setStep("loading"); setSaved(false);
    let msgIdx = 0; setLoadingMsg(loadingMessages[0]);
    const interval = setInterval(() => { msgIdx = Math.min(msgIdx + 1, loadingMessages.length - 1); setLoadingMsg(loadingMessages[msgIdx]); }, 2000);
    try {
      const imagePayload  = await Promise.all(imageFiles.map(async f => ({ name: f.name, data: await fileToBase64(f) })));
      const pdfPayload    = await Promise.all(pdfFiles.map(async f => ({ name: f.name, data: await fileToBase64(f) })));
      const drawingImages = await Promise.all(drawingFiles.filter(f => !f.name.toLowerCase().endsWith(".pdf")).map(async f => ({ name: f.name, data: await fileToBase64(f) })));
      const drawingPdfs   = await Promise.all(drawingFiles.filter(f => f.name.toLowerCase().endsWith(".pdf")).map(async f => ({ name: f.name, data: await fileToBase64(f) })));
      const data = await createEstimate({ description: description.trim(), job_type: jobType, location: fieldValues["location"] || undefined, hourly_rate: parseFloat(hourlyRate) || 650, margin_pct: parseFloat(marginPct) || 15, include_rot: includeRot, build_params: buildAiParams(), images: [...imagePayload, ...drawingImages], documents: [...pdfPayload, ...drawingPdfs] });
      clearInterval(interval); setResult(data); setStep("result");
    } catch (e: any) { clearInterval(interval); setError(e.message || "Något gick fel."); setStep("input"); }
  }

  async function writeCraftsmanEdits(supabaseQuoteId: string, edits: Record<string, RowEdit>) {
    try {
      const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  || "";
      const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      await fetch(`${SUPABASE_URL}/rest/v1/quotes?id=eq.${supabaseQuoteId}`, {
        method: "PATCH",
        headers: { "apikey": SUPABASE_ANON, "Authorization": `Bearer ${SUPABASE_ANON}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({ craftsman_edits: edits }),
      });
    } catch (e) { console.warn("Kunde inte spara craftsman_edits:", e); }
  }

  async function handleConfirmDraft(name: string) {
    if (!result) return; setSavingDraft(true);
    const dataToSave = { ...result, categories };
    saveEstimate({ id: localId, created: new Date().toISOString(), description: name, job_type: jobType, total_inc_vat: liveTotals?.total_inc_vat || 0, customer_pays: liveTotals?.customer_pays || 0, data: dataToSave });
    const { id: sbId } = await saveDraftToSupabase(name, liveTotals?.total_inc_vat || 0, liveTotals?.customer_pays || 0, dataToSave);
    if (sbId) {
      setSupabaseId(localId, sbId);
      if (Object.keys(allEdits).length > 0) await writeCraftsmanEdits(sbId, allEdits);
    }
    setSavingDraft(false); setShowDraftModal(false); setSaved(true);
  }

  function handleDownloadQuote() {
    if (!result || !liveTotals) return;
    const settings = getSettings();
    if (!settings.company_name) { alert("Fyll i företagsuppgifter under Inställningar först."); return; }
    const html = generateQuoteHTML(result, categories, liveTotals, settings);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) w.onload = () => setTimeout(() => w.print(), 500);
  }

  function handleClickSend() { if (!result) return; setPendingSendName(result.job_title || description || "Ny offert"); setShowSendModal(true); }
  function handleConfirmSendName(name: string) { setShowSendModal(false); setPendingSendName(name); setShowMailModal(true); }

  async function handleMailCustomer() {
    if (!result || !customerEmail.trim() || !liveTotals) return;
    const settings = getSettings();
    if (!settings.company_name) { alert("Fyll i företagsuppgifter under Inställningar först."); return; }
    setSending(true);
    const dataToSave = { ...result, categories };
    const { id, error: sbErr } = await saveQuoteToSupabase(
      pendingSendName || result.job_title || description,
      result.job_summary || description,
      customerName, customerEmail,
      liveTotals.total_inc_vat,
      liveTotals.customer_pays,
      dataToSave, settings
    );
    if (sbErr || !id) { alert("Kunde inte spara offert: " + (sbErr || "Okänt fel")); setSending(false); return; }
    if (Object.keys(allEdits).length > 0) await writeCraftsmanEdits(id, allEdits);
    const acceptUrl   = `${window.location.origin}/accept?id=${id}`;
    const companyName = settings.company_name || "Vi";
    const subj = `Offert: ${pendingSendName || result.job_title || "Kalkyl"} — ${companyName}`;
    const bd = `Hej ${customerName || ""}!\n\nTack för din förfrågan. Här kommer vår offert för ${pendingSendName || result.job_title || "arbetet"}.\n\n${result.job_summary || ""}\n\nTotalt: ${fmtKr(liveTotals.total_inc_vat)}${liveTotals.rot_deduction > 0 ? `\nROT-avdrag: -${fmtKr(liveTotals.rot_deduction)}\nAtt betala: ${fmtKr(liveTotals.customer_pays)}` : ""}\n\nSe hela offerten:\n${acceptUrl}\n\nGiltig i ${settings.quote_validity_days || 30} dagar.\n\nMed vänliga hälsningar\n${settings.contact_name || companyName}${settings.phone ? `\nTel: ${settings.phone}` : ""}${settings.email ? `\n${settings.email}` : ""}`;
    setMailSubject(subj); setMailBody(bd); setSending(false); setMailStep("choose");
  }

  function openGmail()   { window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(customerEmail)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`, "_blank"); setSent(true); setShowMailModal(false); setMailStep("form"); }
  function openOutlook() { window.open(`https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(customerEmail)}&subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`, "_blank"); setSent(true); setShowMailModal(false); setMailStep("form"); }
  function openMailto()  { window.location.href = `mailto:${customerEmail}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`; setSent(true); setShowMailModal(false); setMailStep("form"); }
  function copyMailContent() { navigator.clipboard.writeText(`Till: ${customerEmail}\nÄmne: ${mailSubject}\n\n${mailBody}`); alert("Kopierat!"); }

  function handleReset() { setStep("input"); setResult(null); setCategories([]); setDescription(""); setSaved(false); setShowSources(false); setAllEdits({}); window.history.replaceState(null, "", "/estimate"); }

  function handleRowSave(catIdx: number, rowIdx: number, updatedRow: QuoteRow, updatedEdits: Record<string, RowEdit>) {
    setCategories(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[catIdx].rows[rowIdx] = updatedRow;
      next[catIdx].subtotal = next[catIdx].rows.reduce((s: number, r: any) => s + (r.total || 0), 0);
      return next;
    });
    setAllEdits(updatedEdits);
    setEditingCell(null);
  }

  // ── INPUT ──────────────────────────────────────────────────────────────────
  if (step === "input") {
    const params  = JOB_PARAMS[jobType];
    const jtLabel = JOB_TYPES.find(j => j.id === jobType)?.label || "";
    return (
      <ProtectedLayout>
        <Header title="Ny kalkyl" subtitle="Beskriv jobbet — AI:n räknar ut resten" />
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Jobbtyp</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7 }}>
            {JOB_TYPES.map(jt => (
              <button key={jt.id} onClick={() => setJobType(jt.id)} style={{ background: jobType === jt.id ? "rgba(106,129,147,0.12)" : "var(--bg-surface)", border: `0.5px solid ${jobType === jt.id ? "rgba(106,129,147,0.5)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "10px 6px 8px", textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, transition: "all 0.12s" }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: jobType === jt.id ? "rgba(106,129,147,0.2)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", color: jobType === jt.id ? "#6a8193" : "var(--text-faint)" }}>{jt.icon}</div>
                <span style={{ fontSize: 11, color: jobType === jt.id ? "#8aaabb" : "var(--text-muted)", fontWeight: jobType === jt.id ? 500 : 400 }}>{jt.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", color: "var(--text-faint)", textTransform: "uppercase" }}>Smarta parametrar — {jtLabel}</div>
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--accent-soft)", border: "0.5px solid var(--accent-border)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "var(--accent-text)", marginBottom: 10 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }} />{params.pill}
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: params.checks.length ? 14 : 0 }}>
            {params.fields.map(f => (
              <div key={f.key} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 7 }}>{f.label}</div>
                {f.type === "select" ? (
                  <select className="input" style={{ width: "100%", padding: "6px 8px", fontSize: 13 }} value={fieldValues[f.key] || f.defaultVal} onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}>
                    {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", background: "var(--bg-elevated)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 10px" }}>
                    <input type={f.type === "number" ? "number" : "text"} placeholder={f.type === "number" ? "0" : "—"} value={fieldValues[f.key] ?? f.defaultVal} onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))} style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text-primary)", width: "100%", minWidth: 0 }} />
                    {f.unit && <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: 4, flexShrink: 0 }}>{f.unit}</span>}
                  </div>
                )}
                <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 5, lineHeight: 1.4, opacity: 0.7 }}>{f.hint}</div>
              </div>
            ))}
          </div>
          {params.checks.length > 0 && (
            <>
              <div style={{ height: "0.5px", background: "var(--border)", marginBottom: 10 }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", letterSpacing: "1px", textTransform: "uppercase" }}>Ingår i jobbet</div>
                <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", background: "var(--bg-surface)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "4px 10px", fontSize: 11, color: "var(--text-muted)" }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 14V10M14 14V10M8 2v8M5 5l3-3 3 3" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 14h12" strokeLinecap="round"/></svg>
                  <span>Ladda upp ritningar</span>
                  {drawingFiles.length > 0 && <span style={{ background: "rgba(106,129,147,0.2)", color: "#6a8193", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 600, marginLeft: 2 }}>{drawingFiles.length}</span>}
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf" multiple style={{ display: "none" }} onChange={e => { const files = Array.from(e.target.files || []); setDrawingFiles(prev => [...prev, ...files]); e.target.value = ""; }} />
                </label>
              </div>
              {drawingFiles.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>{drawingFiles.map((f, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg-surface)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "3px 8px", fontSize: 11, color: "var(--text-muted)" }}><span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span><button onClick={() => setDrawingFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 13 }}>×</button></div>))}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {params.checks.map(c => (
                  <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", padding: "6px 0" }}>
                    <div onClick={() => setCheckValues(prev => ({ ...prev, [c.key]: !prev[c.key] }))} style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `0.5px solid ${checkValues[c.key] ? "rgba(106,129,147,0.6)" : "var(--border)"}`, background: checkValues[c.key] ? "rgba(106,129,147,0.18)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                      {checkValues[c.key] && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="#6a8193" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span style={{ fontSize: 12, color: checkValues[c.key] ? "var(--text-secondary)" : "var(--text-muted)" }}>{c.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", color: "var(--text-faint)", textTransform: "uppercase" }}>Jobbeskrivning</div>
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <textarea className="input textarea" placeholder="Beskriv jobbet i fritext. T.ex: Badrumsrenovering ca 6 kvm. Riva befintligt kakel golv och väggar. Nytt tätskikt, klinker på golv (60×60), kakel på väggar (30×60). Ny dusch med glasvägg, ny toalett och handfat." value={description} onChange={e => setDescription(e.target.value)} rows={4} />
          {error && <div className="login-error" style={{ marginTop: 10 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", background: "var(--bg-surface)", border: `0.5px solid ${pdfFiles.length > 0 ? "rgba(106,129,147,0.5)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 12, color: pdfFiles.length > 0 ? "#8aaabb" : "var(--text-muted)" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="1" width="9" height="13" rx="1.5"/><path d="M8 1v4h4" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 8h6M5 10.5h4" strokeLinecap="round"/></svg>
              <span style={{ fontWeight: 500 }}>PDF med underlag</span>
              {pdfFiles.length > 0 && <span style={{ background: "rgba(106,129,147,0.2)", color: "#6a8193", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{pdfFiles.length} fil{pdfFiles.length > 1 ? "er" : ""}</span>}
              <input type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={e => { const files = Array.from(e.target.files || []); setPdfFiles(prev => [...prev, ...files]); e.target.value = ""; }} />
            </label>
            <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", background: "var(--bg-surface)", border: `0.5px solid ${imageFiles.length > 0 ? "rgba(106,129,147,0.5)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 12, color: imageFiles.length > 0 ? "#8aaabb" : "var(--text-muted)" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="3" width="14" height="10" rx="1.5"/><circle cx="5.5" cy="7" r="1.5"/><path d="M1 11l4-3 3 3 2-2 5 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontWeight: 500 }}>Projektbilder</span>
              {imageFiles.length > 0 && <span style={{ background: "rgba(106,129,147,0.2)", color: "#6a8193", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{imageFiles.length} bild{imageFiles.length > 1 ? "er" : ""}</span>}
              <input type="file" accept=".png,.jpg,.jpeg,.webp" multiple style={{ display: "none" }} onChange={e => { const files = Array.from(e.target.files || []); setImageFiles(prev => [...prev, ...files]); e.target.value = ""; }} />
            </label>
          </div>
          {(pdfFiles.length > 0 || imageFiles.length > 0) && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 5 }}>
              {pdfFiles.map((f, i) => (<div key={`pdf-${i}`} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(239,68,68,0.06)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius)", padding: "3px 8px", fontSize: 11, color: "var(--text-muted)" }}><span style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span><button onClick={() => setPdfFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}>×</button></div>))}
              {imageFiles.map((f, i) => (<div key={`img-${i}`} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(106,129,147,0.06)", border: "0.5px solid rgba(106,129,147,0.2)", borderRadius: "var(--radius)", padding: "3px 8px", fontSize: 11, color: "var(--text-muted)" }}><span style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span><button onClick={() => setImageFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}>×</button></div>))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", color: "var(--text-faint)", textTransform: "uppercase" }}>Kalkylparametrar</div>
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div><label className="label">Timpris (kr/h)</label><input className="input" type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} /></div>
            <div><label className="label">Påslag (%)</label><input className="input" type="number" value={marginPct} onChange={e => setMarginPct(e.target.value)} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 20 }}>
              <div onClick={() => setIncludeRot(!includeRot)} style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", flexShrink: 0, position: "relative", background: includeRot ? "var(--accent)" : "var(--border)", transition: "background 0.15s" }}>
                <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, transition: "left 0.15s", left: includeRot ? 18 : 2 }} />
              </div>
              <div><div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>ROT-avdrag</div><div style={{ fontSize: 11, color: "var(--text-faint)" }}>30% på arbete</div></div>
            </div>
          </div>
        </div>
        <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={handleGenerate}>Generera kalkyl med AI</button>
      </ProtectedLayout>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <ProtectedLayout>
        <div className="loading-overlay">
          <svg width="64" height="64" viewBox="0 0 220 240" fill="none"><path d="M 110 10 Q 114 95, 118 115 Q 135 119, 210 122 Q 135 125, 118 129 Q 114 149, 110 234 Q 106 149, 102 129 Q 85 125, 10 122 Q 85 119, 102 115 Q 106 95, 110 10 Z" fill="#ffffff"/><path d="M 110 108 Q 112 118, 114 120 Q 120 121, 130 122 Q 120 123, 114 124 Q 112 126, 110 136 Q 108 126, 106 124 Q 100 123, 90 122 Q 100 121, 106 120 Q 108 118, 110 108 Z" fill="#6a8193"/></svg>
          <div className="loading-text">{loadingMsg}</div>
          <div className="loading-bar"><div className="loading-bar-fill" /></div>
        </div>
      </ProtectedLayout>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (!result || !liveTotals) return null;
  const editedCount = Object.keys(allEdits).length;
  const settings    = getSettings();

  return (
    <ProtectedLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div className="page-title">{result.job_title || "Kalkyl"}</div>
          <div className="page-subtitle">{result.job_summary || description}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>Ny kalkyl</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSources(!showSources)}>{showSources ? "Dölj källor" : "Visa priskällor"}</button>
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadQuote}>📄 Ladda ner offert</button>
          <button className="btn btn-secondary btn-sm" onClick={handleClickSend} style={{ background: "var(--accent-soft)", color: "var(--accent-text)", borderColor: "var(--accent-border)" }}>{sent ? "✓ Skickad" : "✉ Maila kund"}</button>
          <button className={`btn btn-sm ${saved ? "btn-secondary" : "btn-primary"}`} onClick={() => !saved && setShowDraftModal(true)} disabled={saved}>{saved ? "✓ Utkast sparat" : "Spara utkast"}</button>
        </div>
      </div>

      {editedCount > 0 && (
        <div style={{ marginBottom: 12, padding: "8px 14px", background: "rgba(99,179,130,0.08)", border: "0.5px solid rgba(99,179,130,0.25)", borderRadius: "var(--radius)", fontSize: 12, color: "#3d9e6a", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{editedCount} rad{editedCount > 1 ? "er" : ""} justerad{editedCount > 1 ? "e" : ""}</span>
          <span style={{ color: "var(--text-faint)" }}>— summering uppdaterad automatiskt</span>
        </div>
      )}

      {showSources && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          <strong>Om priskällor:</strong> Materialpriser är uppskattade baserat på svenska marknadspriser 2025–2026. Klicka på "Justera" på en rad för att ändra antal eller pris — summering uppdateras direkt.
        </div>
      )}

      {/* ── Kalkylrader ── */}
      <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
        <table className="est-table">
          <thead>
            <tr>
              <th style={{ width: "36%" }}>Post</th>
              <th>Enhet</th>
              <th className="right">Antal</th>
              <th className="right">À-pris</th>
              <th className="right">Summa</th>
              <th style={{ width: 90 }}></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat: any, catIdx: number) => (
              <>
                <tr key={`cat-${catIdx}`} className="est-cat-row">
                  <td colSpan={6}>{cat.name}</td>
                </tr>
                {(cat.rows || []).map((row: any, rowIdx: number) => {
                  const editKey = `${cat.name}__${row.description}`;
                  const isEdited = !!allEdits[editKey];
                  return (
                    <tr key={`row-${catIdx}-${rowIdx}`} style={{ background: isEdited ? "rgba(99,179,130,0.04)" : undefined }}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div>
                            <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{row.description}</div>
                            {row.note && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{row.note}</div>}
                          </div>
                          {isEdited && <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 10, background: "rgba(99,179,130,0.15)", color: "#3d9e6a", border: "0.5px solid rgba(99,179,130,0.3)", whiteSpace: "nowrap", flexShrink: 0 }}>justerad</span>}
                        </div>
                      </td>
                      <td style={{ color: "var(--text-faint)" }}>{row.unit}</td>
                      <td className="right" style={{ fontFamily: "var(--mono)", fontWeight: isEdited ? 500 : undefined }}>{row.quantity}</td>
                      <td className="right" style={{ fontFamily: "var(--mono)" }}>{fmtKr(row.unit_price)}</td>
                      <td className="right" style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{fmtKr(row.total)}</td>
                      <td style={{ textAlign: "center", padding: "6px 8px" }}>
                        <button
                          onClick={() => setEditingCell({ catIdx, rowIdx })}
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: "var(--radius)", border: "0.5px solid var(--border-strong)", background: isEdited ? "rgba(99,179,130,0.1)" : "transparent", color: isEdited ? "#3d9e6a" : "var(--text-faint)", cursor: "pointer", fontSize: 11, fontWeight: 500, transition: "all 0.1s", whiteSpace: "nowrap" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-strong)"; (e.currentTarget as HTMLButtonElement).style.color = isEdited ? "#3d9e6a" : "var(--text-faint)"; }}
                        >
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M11 2l3 3-8 8H3v-3l8-8z" strokeLinejoin="round"/></svg>
                          {isEdited ? "Ändrad" : "Justera"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="est-subtotal">
                  <td colSpan={5} style={{ textAlign: "right" }}>Delsumma {cat.name}</td>
                  <td className="right" style={{ fontFamily: "var(--mono)" }}>{fmtKr(cat.subtotal)}</td>
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Summering — alltid live från liveTotals ── */}
      <div className="est-total-section">
        <div className="est-total-row"><span className="label-text">Material</span><span className="value">{fmtKr(liveTotals.material_total)}</span></div>
        <div className="est-total-row"><span className="label-text">Arbete</span><span className="value">{fmtKr(liveTotals.labor_total)}</span></div>
        {liveTotals.equipment_total > 0 && <div className="est-total-row"><span className="label-text">Utrustning</span><span className="value">{fmtKr(liveTotals.equipment_total)}</span></div>}
        {liveTotals.margin_amount > 0 && <div className="est-total-row"><span className="label-text">Påslag ({result.meta?.margin_pct || 15}%)</span><span className="value">{fmtKr(liveTotals.margin_amount)}</span></div>}
        <div className="est-total-row"><span className="label-text">Summa exkl. moms</span><span className="value">{fmtKr(liveTotals.total_ex_vat)}</span></div>
        <div className="est-total-row"><span className="label-text">Moms (25%)</span><span className="value">{fmtKr(liveTotals.vat)}</span></div>
        <div className="est-total-row big"><span>Totalt inkl. moms</span><span className="value">{fmtKr(liveTotals.total_inc_vat)}</span></div>
        {liveTotals.rot_deduction > 0 && (
          <>
            <div className="est-total-row" style={{ marginTop: 12 }}><span className="label-text">ROT-avdrag (30% på arbete)</span><span className="est-rot">−{fmtKr(liveTotals.rot_deduction)}</span></div>
            <div className="est-total-row big"><span>Kunden betalar</span><span className="value" style={{ color: "var(--green)" }}>{fmtKr(liveTotals.customer_pays)}</span></div>
          </>
        )}
      </div>

      {result.estimated_days && <div className="info-box" style={{ marginTop: 16 }}>Uppskattad tidsåtgång: ca {result.estimated_days} arbetsdagar</div>}

      {result.warnings?.length > 0 && (
        <div className="warning-box" style={{ marginTop: 12 }}>
          <strong>Observera:</strong>
          <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
            {result.warnings.map((w: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
          </ul>
        </div>
      )}

      {result.assumptions?.length > 0 && (
        <div style={{ marginTop: 12, padding: "12px 16px", background: "var(--bg-elevated)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--text-muted)" }}>
          <strong style={{ color: "var(--text-secondary)" }}>Antaganden:</strong>
          <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
            {result.assumptions.map((a: string, i: number) => <li key={i} style={{ marginBottom: 4 }}>{a}</li>)}
          </ul>
        </div>
      )}

      {editingCell && (
        <RowFeedbackModal
          quoteNumber={result.job_title || localId}
          row={categories[editingCell.catIdx].rows[editingCell.rowIdx]}
          category={categories[editingCell.catIdx].name}
          jobType={jobType}
          region={fieldValues["location"]}
          craftsmanName={settings.contact_name}
          allEdits={allEdits}
          onSave={(updatedRow, updatedEdits) => handleRowSave(editingCell.catIdx, editingCell.rowIdx, updatedRow, updatedEdits)}
          onClose={() => setEditingCell(null)}
        />
      )}

      {showDraftModal && <NameModal defaultName={result.job_title || description || "Nytt utkast"} onConfirm={handleConfirmDraft} onCancel={() => setShowDraftModal(false)} title="Spara utkast" confirmLabel="Spara utkast" saving={savingDraft} />}
      {showSendModal && <NameModal defaultName={result.job_title || description || "Ny offert"} onConfirm={handleConfirmSendName} onCancel={() => setShowSendModal(false)} title="Namnge offerten" confirmLabel="Fortsätt" saving={false} />}

      {showMailModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-elevated)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "28px 32px", width: 440, maxWidth: "90vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{mailStep === "form" ? "Skicka offert till kund" : "Välj mailapp"}</div>
              <button onClick={() => { setShowMailModal(false); setMailStep("form"); }} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            {mailStep === "form" ? (
              <>
                <div style={{ padding: "10px 14px", background: "var(--accent-soft)", border: "0.5px solid var(--accent-border)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--accent-text)", marginBottom: 16 }}><strong>Offert:</strong> {pendingSendName}</div>
                <div style={{ marginBottom: 14 }}><label className="label">Kundens namn</label><input className="input" placeholder="Anna Andersson" value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
                <div style={{ marginBottom: 20 }}><label className="label">Kundens e-post *</label><input className="input" type="email" placeholder="kund@email.se" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></div>
                <div style={{ padding: "12px 16px", background: "var(--bg-surface)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>Kunden får ett mail med en sammanfattning och en länk för att granska och godkänna offerten.</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowMailModal(false)}>Avbryt</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleMailCustomer} disabled={sending || !customerEmail.trim()}>{sending ? "Sparar offert..." : "Fortsätt"}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Offerten sparad. Välj mailapp för <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{customerEmail}</span>:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  <button className="btn btn-primary" onClick={openGmail} style={{ width: "100%" }}>📧 Öppna i Gmail</button>
                  <button className="btn btn-secondary" onClick={openOutlook} style={{ width: "100%" }}>📬 Öppna i Outlook</button>
                  <button className="btn btn-secondary" onClick={openMailto} style={{ width: "100%" }}>💻 Öppna i standardmail</button>
                </div>
                <div style={{ borderTop: "0.5px solid var(--border)", paddingTop: 12 }}>
                  <button className="btn btn-secondary" onClick={copyMailContent} style={{ width: "100%", fontSize: 12 }}>📋 Kopiera mailinnehåll</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </ProtectedLayout>
  );
}

export default function EstimatePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#0d0d12" }} />}>
      <EstimateInner />
    </Suspense>
  );
}
