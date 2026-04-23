"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { createEstimate } from "@/lib/api";
import { saveEstimate, getEstimates, setSupabaseId } from "@/lib/store";
import { saveQuoteToSupabase, saveDraftToSupabase } from "@/lib/quotes";

// ── Jobbtyper ────────────────────────────────────────────────────────────────
const JOB_TYPES = [
  { id: "badrum",     label: "Badrum",      icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 9h12v3a2 2 0 01-2 2H4a2 2 0 01-2-2V9z"/><path d="M2 9V5a2 2 0 012-2h1v6" strokeLinecap="round"/><circle cx="11" cy="5" r="1.5"/></svg> },
  { id: "kok",        label: "Kök",         icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="5" width="14" height="9" rx="1.5"/><path d="M4 5V4a1 1 0 011-1h6a1 1 0 011 1v1" strokeLinecap="round"/><path d="M5 9h2M9 9h2" strokeLinecap="round"/></svg> },
  { id: "tak",        label: "Tak",         icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1 14h14M2 14V8l6-6 6 6v6" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id: "fasad",      label: "Fasad",       icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="1" width="14" height="14" rx="1.5"/><path d="M1 6h14M6 6v8M10 6v8" strokeWidth="1"/></svg> },
  { id: "golv",       label: "Golv",        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="10" width="14" height="4" rx="1"/><path d="M3 10V7M7 10V5M11 10V7M13 10V6" strokeLinecap="round"/></svg> },
  { id: "malning",    label: "Målning",     icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 12L10 5l2 2-7 7-2-2z"/><path d="M12 3l1 1-1 1-1-1 1-1z" strokeLinejoin="round"/><path d="M3 12l-1 2 2-1" strokeLinecap="round"/></svg> },
  { id: "el",         label: "El",          icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M9 2L5 9h5l-3 5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { id: "vvs",        label: "VVS",         icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 3v4a2 2 0 002 2h6a2 2 0 012 2v2" strokeLinecap="round"/><circle cx="3" cy="3" r="1.5"/><circle cx="13" cy="13" r="1.5"/></svg> },
  { id: "tillbyggnad",label: "Tillbyggnad", icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="7" width="7" height="8" rx="1"/><rect x="8" y="1" width="7" height="8" rx="1"/></svg> },
  { id: "ovrigt",     label: "Övrigt",      icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M8 5v6M5 8h6" strokeLinecap="round"/></svg> },
];

// ── Typer ────────────────────────────────────────────────────────────────────
interface FieldDef {
  key: string;
  label: string;
  unit: string;
  defaultVal: string;
  hint: string;
  type?: "text" | "number" | "select";
  options?: string[];
}

interface CheckDef {
  key: string;
  label: string;
  defaultOn: boolean;
}

interface JobParams {
  pill: string;
  fields: FieldDef[];
  checks: CheckDef[];
}

// ── Smarta parametrar per jobbtyp ────────────────────────────────────────────
const JOB_PARAMS: Record<string, JobParams> = {
  badrum: {
    pill: "AI beräknar kakelyta, tätskikt och material exakt",
    fields: [
      { key: "floor_sqm",      label: "Golvyta",              unit: "m²", defaultVal: "", hint: "Klinker/kakel golv + tätskikt", type: "number" },
      { key: "ceiling_height", label: "Takhöjd",              unit: "m",  defaultVal: "2.4", hint: "Beräknar total väggarea", type: "number" },
      { key: "tiled_walls",    label: "Kaklade väggar",       unit: "st", defaultVal: "4", hint: "Antal väggar som kaklas", type: "number" },
      { key: "tile_height",    label: "Kakelhöjd på vägg",    unit: "m",  defaultVal: "2.4", hint: "Full = takhöjd, annars ange höjd", type: "number" },
      { key: "openings",       label: "Dörrar & fönster",     unit: "st", defaultVal: "1", hint: "Dras av från väggyta", type: "number" },
      { key: "location",       label: "Plats",                unit: "",   defaultVal: "", hint: "Påverkar materialpris & ROT", type: "text" },
    ],
    checks: [
      { key: "shower_glass",   label: "Dusch med glasvägg",   defaultOn: true  },
      { key: "bathtub",        label: "Badkar",               defaultOn: false },
      { key: "toilet_sink",    label: "Toalett & handfat",    defaultOn: true  },
      { key: "demo_tiles",     label: "Riva befintligt kakel",defaultOn: true  },
      { key: "floor_heating",  label: "Golvvärme",            defaultOn: false },
    ],
  },
  kok: {
    pill: "AI beräknar skåp, bänkskiva och installation",
    fields: [
      { key: "kitchen_width",  label: "Kökets bredd",         unit: "m",  defaultVal: "", hint: "Totalt löpmeter köksskåp", type: "number" },
      { key: "base_cabinets",  label: "Antal basskåp",        unit: "st", defaultVal: "", hint: "60 cm-moduler under bänk", type: "number" },
      { key: "wall_cabinets",  label: "Antal hängskåp",       unit: "st", defaultVal: "", hint: "Skåp ovan bänk", type: "number" },
      { key: "countertop_len", label: "Bänkskivans längd",    unit: "m",  defaultVal: "", hint: "Inkl. hörn om L-kök", type: "number" },
      { key: "location",       label: "Plats",                unit: "",   defaultVal: "", hint: "Påverkar priser & ROT", type: "text" },
    ],
    checks: [
      { key: "demo_kitchen",   label: "Rivning av gammalt kök",defaultOn: true  },
      { key: "dishwasher",     label: "Ny diskmaskin",         defaultOn: false },
      { key: "stove",          label: "Ny spis/häll",          defaultOn: false },
      { key: "backsplash",     label: "Kakel/stänkskydd",      defaultOn: true  },
      { key: "ventilation",    label: "Ny ventilation",        defaultOn: false },
    ],
  },
  tak: {
    pill: "AI beräknar takarea, läktning och material",
    fields: [
      { key: "roof_area",      label: "Takarea",              unit: "m²", defaultVal: "", hint: "Hela takytans area", type: "number" },
      { key: "roof_pitch",     label: "Taklutning",           unit: "°",  defaultVal: "27", hint: "Grader — påverkar materialåtgång", type: "number" },
      { key: "roof_type",      label: "Takets form",          unit: "",   defaultVal: "Sadeltak", hint: "Välj typ", type: "select",
        options: ["Sadeltak", "Valmat tak", "Pulpettak", "Platt tak", "Mansardtak"] },
      { key: "location",       label: "Plats",                unit: "",   defaultVal: "", hint: "Vindlast & materialpris", type: "text" },
    ],
    checks: [
      { key: "demo_roof",      label: "Riva gamla takpannor", defaultOn: true  },
      { key: "underlay",       label: "Ny undertäckning",     defaultOn: true  },
      { key: "gutters",        label: "Ny ränndal",           defaultOn: false },
      { key: "skylight",       label: "Takfönster",           defaultOn: false },
      { key: "vent_hood",      label: "Ventilationshuv",      defaultOn: false },
    ],
  },
  fasad: {
    pill: "AI beräknar fasadarea och materialåtgång",
    fields: [
      { key: "perimeter",      label: "Husomkrets",           unit: "m",  defaultVal: "", hint: "Totalt omfång i meter", type: "number" },
      { key: "facade_height",  label: "Fasadhöjd",            unit: "m",  defaultVal: "", hint: "Mark till takfot", type: "number" },
      { key: "windows",        label: "Antal fönster",        unit: "st", defaultVal: "", hint: "Dras av från fasadyta", type: "number" },
      { key: "doors",          label: "Antal dörrar",         unit: "st", defaultVal: "", hint: "Dras av från fasadyta", type: "number" },
      { key: "location",       label: "Plats",                unit: "",   defaultVal: "", hint: "Påverkar priser", type: "text" },
    ],
    checks: [
      { key: "demo_panel",     label: "Riva befintlig panel", defaultOn: false },
      { key: "barge_board",    label: "Ny vindskiva",         defaultOn: true  },
      { key: "window_flashing",label: "Ny fönsterbleck",      defaultOn: false },
      { key: "painting",       label: "Målning ingår",        defaultOn: false },
    ],
  },
  golv: {
    pill: "AI beräknar golvyta, underlag och material",
    fields: [
      { key: "floor_sqm",      label: "Golvyta",              unit: "m²", defaultVal: "", hint: "Total yta att lägga", type: "number" },
      { key: "room_width",     label: "Rumsbredd (smalast)",  unit: "m",  defaultVal: "", hint: "Påverkar spill vid läggning", type: "number" },
      { key: "floor_type",     label: "Golvtyp",              unit: "",   defaultVal: "Parkett", hint: "Material att lägga", type: "select",
        options: ["Parkett", "Laminat", "Klinker", "Marmor", "Vinyl/LVT", "Mosaik"] },
      { key: "location",       label: "Plats",                unit: "",   defaultVal: "", hint: "Påverkar priser", type: "text" },
    ],
    checks: [
      { key: "demo_floor",     label: "Riva befintligt golv", defaultOn: true  },
      { key: "leveling",       label: "Avjämning krävs",      defaultOn: false },
      { key: "floor_heating",  label: "Golvvärme under",      defaultOn: false },
      { key: "skirting",       label: "Sockel/list ingår",    defaultOn: true  },
    ],
  },
  malning: {
    pill: "AI beräknar färgåtgång och arbetstid exakt",
    fields: [
      { key: "wall_sqm",       label: "Väggyta att måla",     unit: "m²", defaultVal: "", hint: "Total väggarea", type: "number" },
      { key: "ceiling_height", label: "Takhöjd",              unit: "m",  defaultVal: "2.4", hint: "Används för beräkning", type: "number" },
      { key: "rooms",          label: "Antal rum",            unit: "st", defaultVal: "", hint: "Påverkar flytt & setup-tid", type: "number" },
      { key: "location",       label: "Plats",                unit: "",   defaultVal: "", hint: "Påverkar priser", type: "text" },
    ],
    checks: [
      { key: "ceiling",        label: "Tak ingår",            defaultOn: true  },
      { key: "walls",          label: "Väggar ingår",         defaultOn: true  },
      { key: "spackling",      label: "Spackla & slipa först",defaultOn: false },
      { key: "trim",           label: "Fönster/dörrkarm",     defaultOn: false },
      { key: "two_coats",      label: "2 strykningar",        defaultOn: true  },
    ],
  },
  el: {
    pill: "AI beräknar kabel, uttag och arbetstid",
    fields: [
      { key: "outlets",        label: "Antal uttag/brytare",  unit: "st", defaultVal: "", hint: "Nya eluttag att dra", type: "number" },
      { key: "cable_meters",   label: "Kabelledning",         unit: "m",  defaultVal: "", hint: "Uppskattad kabelsträcka", type: "number" },
      { key: "fixtures",       label: "Antal armaturer",      unit: "st", defaultVal: "", hint: "Takdosor & lamputtag", type: "number" },
      { key: "location",       label: "Plats",                unit: "",   defaultVal: "", hint: "Påverkar priser", type: "text" },
    ],
    checks: [
      { key: "fusebox",        label: "Elcentral/proppskåp",  defaultOn: false },
      { key: "rcd",            label: "Jordfelsbrytare",      defaultOn: true  },
      { key: "thermostat",     label: "Golvvärme-termostat",  defaultOn: false },
      { key: "inspection",     label: "Elbesiktning ingår",   defaultOn: false },
    ],
  },
  vvs: {
    pill: "AI beräknar rör, kopplingar och arbetstid",
    fields: [
      { key: "taps",           label: "Antal blandare",       unit: "st", defaultVal: "", hint: "Kök, bad, tvätt...", type: "number" },
      { key: "pipe_meters",    label: "Ny rörledning",        unit: "m",  defaultVal: "", hint: "Meter ny rördragning", type: "number" },
      { key: "drains",         label: "Antal avlopp",         unit: "st", defaultVal: "", hint: "Golvbrunnar & anslutningar", type: "number" },
      { key: "location",       label: "Plats",                unit: "",   defaultVal: "", hint: "Påverkar priser", type: "text" },
    ],
    checks: [
      { key: "water_heater",   label: "Ny varmvattenberedare",defaultOn: false },
      { key: "radiator",       label: "Ny radiator",          defaultOn: false },
      { key: "laundry",        label: "Ny tvättpunkt",        defaultOn: true  },
      { key: "backflow",       label: "Backventil",           defaultOn: false },
    ],
  },
  tillbyggnad: {
    pill: "AI beräknar stomme, isolering och ytskikt",
    fields: [
      { key: "addition_sqm",   label: "Tillbyggnadsarea",     unit: "m²", defaultVal: "", hint: "Bruttoarea ny del", type: "number" },
      { key: "ceiling_height", label: "Takhöjd",              unit: "m",  defaultVal: "2.4", hint: "Invändig takhöjd", type: "number" },
      { key: "windows",        label: "Antal fönster",        unit: "st", defaultVal: "", hint: "Nya fönster i tillbyggnad", type: "number" },
      { key: "location",       label: "Plats",                unit: "",   defaultVal: "", hint: "Påverkar priser", type: "text" },
    ],
    checks: [
      { key: "slab",           label: "Platta på mark",       defaultOn: true  },
      { key: "crawl_space",    label: "Krypgrund",            defaultOn: false },
      { key: "heating",        label: "Radiatorer/golvvärme", defaultOn: true  },
      { key: "electricity",    label: "El i tillbyggnad",     defaultOn: true  },
    ],
  },
  ovrigt: {
    pill: "Fyll i det som är relevant för ditt jobb",
    fields: [
      { key: "area_sqm",       label: "Yta / area",           unit: "m²", defaultVal: "", hint: "Om relevant för jobbet", type: "number" },
      { key: "units",          label: "Antal enheter",        unit: "st", defaultVal: "", hint: "T.ex. antal objekt, rum...", type: "number" },
      { key: "location",       label: "Plats",                unit: "",   defaultVal: "", hint: "Påverkar priser & ROT", type: "text" },
    ],
    checks: [
      { key: "demo",           label: "Rivning/demontering",  defaultOn: false },
      { key: "cleaning",       label: "Städning efter jobb",  defaultOn: false },
    ],
  },
};

// ── Hjälpfunktioner ───────────────────────────────────────────────────────────
function fmtKr(n: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "decimal", maximumFractionDigits: 0 }).format(n) + " kr";
}

function getSettings() {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem("byggkalk_settings") || "{}"); } catch { return {}; }
}

function generateQuoteHTML(result: any, settings: any) {
  const t = result.totals || {};
  const today = new Date().toLocaleDateString("sv-SE");
  const validDays = settings.quote_validity_days || 30;
  const validUntil = new Date(Date.now() + validDays * 86400000).toLocaleDateString("sv-SE");
  const quoteNr = "OFF-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 9000) + 1000);

  let rowsHTML = "";
  for (const cat of result.categories || []) {
    rowsHTML += `<tr style="background:#f8f8f8"><td colspan="5" style="padding:10px 12px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e5e5;color:#555">${cat.name}</td></tr>`;
    for (const row of cat.rows || []) {
      rowsHTML += `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px">${row.description}${row.note ? `<br><span style="font-size:10px;color:#999">${row.note}</span>` : ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;color:#888;text-align:center">${row.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:'Courier New',monospace">${row.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:'Courier New',monospace">${fmtKr(row.unit_price)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:'Courier New',monospace;font-weight:600">${fmtKr(row.total)}</td>
      </tr>`;
    }
    rowsHTML += `<tr><td colspan="4" style="padding:8px 12px;text-align:right;font-weight:600;font-size:11px;border-bottom:2px solid #ddd;color:#555">Delsumma</td><td style="padding:8px 12px;text-align:right;font-weight:700;font-size:12px;font-family:'Courier New',monospace;border-bottom:2px solid #ddd">${fmtKr(cat.subtotal)}</td></tr>`;
  }

  const logoHTML = settings.logo_base64
    ? `<img src="${settings.logo_base64}" style="max-height:60px;max-width:200px" />`
    : `<div style="font-size:24px;font-weight:800;color:#1a1a1a">${settings.company_name || "Företagsnamn"}</div>`;

  const companyInfo = [settings.address, settings.zip_city, settings.phone ? `Tel: ${settings.phone}` : "", settings.email, settings.website].filter(Boolean).join(" · ");
  const paymentInfo = [settings.bankgiro ? `Bankgiro: ${settings.bankgiro}` : "", settings.plusgiro ? `Plusgiro: ${settings.plusgiro}` : "", settings.f_skatt ? "Godkänd för F-skatt" : ""].filter(Boolean).join(" · ");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offert ${quoteNr}</title>
<style>body{font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#222;font-size:13px;line-height:1.5}@media print{body{padding:20px}}table{width:100%;border-collapse:collapse}</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #6a8193">
  <div>${logoHTML}<div style="font-size:10px;color:#aaa;margin-top:2px">${settings.org_number ? `Org.nr: ${settings.org_number}` : ""}</div><div style="font-size:10px;color:#aaa">${companyInfo}</div></div>
  <div style="text-align:right"><div style="font-size:22px;font-weight:800;color:#6a8193;letter-spacing:1px">OFFERT</div>
  <div style="font-size:11px;color:#888;margin-top:6px"><div>Offertnummer: <strong>${quoteNr}</strong></div><div>Datum: ${today}</div><div>Giltig t.o.m: ${validUntil}</div></div></div>
</div>
<div style="margin-bottom:20px"><div style="font-size:16px;font-weight:700;margin-bottom:4px">${result.job_title || "Kalkyl"}</div><div style="font-size:12px;color:#666">${result.job_summary || ""}</div></div>
<table style="margin-bottom:20px"><thead><tr style="background:#1a1a1a;color:white">
  <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase">Post</th>
  <th style="padding:8px 12px;text-align:center;font-size:10px;text-transform:uppercase">Enhet</th>
  <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase">Antal</th>
  <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase">À-pris</th>
  <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase">Summa</th>
</tr></thead><tbody>${rowsHTML}</tbody></table>
<div style="max-width:350px;margin-left:auto;margin-bottom:24px">
  <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666"><span>Material</span><span>${fmtKr(t.material_total||0)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666"><span>Arbete</span><span>${fmtKr(t.labor_total||0)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666"><span>Summa exkl. moms</span><span>${fmtKr(t.total_ex_vat||0)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666"><span>Moms 25%</span><span>${fmtKr(t.vat||0)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:17px;font-weight:800;border-top:2px solid #1a1a1a;margin-top:6px"><span>Totalt inkl. moms</span><span>${fmtKr(t.total_inc_vat||0)}</span></div>
  ${t.rot_deduction ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#16a34a"><span>ROT-avdrag</span><span>−${fmtKr(t.rot_deduction)}</span></div><div style="display:flex;justify-content:space-between;padding:10px 0;font-size:17px;font-weight:800;color:#16a34a;border-top:2px solid #16a34a;margin-top:4px"><span>Att betala</span><span>${fmtKr(t.customer_pays||t.total_inc_vat||0)}</span></div>` : ""}
</div>
${paymentInfo ? `<div style="margin-top:12px;font-size:10px;color:#aaa;text-align:center">${paymentInfo}</div>` : ""}
${settings.quote_footer ? `<div style="margin-top:20px;padding:14px 16px;background:#f9f9f9;border-radius:6px;font-size:11px;color:#666"><strong>Villkor:</strong><br>${settings.quote_footer.replace(/\n/g,"<br>")}</div>` : ""}
</body></html>`;
}

// ── Namnmodal ─────────────────────────────────────────────────────────────────
function NameModal({ defaultName, onConfirm, onCancel, title, confirmLabel, saving }: {
  defaultName: string; onConfirm: (name: string) => void; onCancel: () => void;
  title: string; confirmLabel: string; saving: boolean;
}) {
  const [name, setName] = useState(defaultName);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "var(--bg-elevated)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "28px 32px", width: 420, maxWidth: "90vw" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>{title}</div>
        <label className="label">Namn på offerten</label>
        <input className="input" value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && name.trim()) onConfirm(name.trim()); if (e.key === "Escape") onCancel(); }}
          autoFocus placeholder="T.ex. Badrumsrenovering Svensson" style={{ marginBottom: 20 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Avbryt</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => name.trim() && onConfirm(name.trim())} disabled={!name.trim() || saving}>
            {saving ? "Sparar..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Huvud-komponent ───────────────────────────────────────────────────────────
function EstimateInner() {
  const searchParams = useSearchParams();
  const viewId = searchParams.get("view");

  // Steg
  const [step, setStep] = useState<"input" | "loading" | "result">("input");

  // Jobbtyp
  const [jobType, setJobType] = useState("badrum");

  // Dynamiska fältvärden: { [key]: value }
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  // Dynamiska check-värden: { [key]: boolean }
  const [checkValues, setCheckValues] = useState<Record<string, boolean>>({});

  // Fritext-beskrivning
  const [description, setDescription] = useState("");

  // Kalkylparametrar
  const [hourlyRate, setHourlyRate] = useState("650");
  const [marginPct, setMarginPct] = useState("15");
  const [includeRot, setIncludeRot] = useState(true);

  // Resultat
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [saved, setSaved] = useState(false);
  const [showSources, setShowSources] = useState(false);

  // Mail
  const [showMailModal, setShowMailModal] = useState(false);
  const [mailStep, setMailStep] = useState<"form" | "choose">("form");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [pendingSendName, setPendingSendName] = useState("");

  // Namnmodaler
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [localId] = useState(() => crypto.randomUUID());

  // Initiera fält när jobbtyp ändras
  useEffect(() => {
    const params = JOB_PARAMS[jobType];
    const fv: Record<string, string> = {};
    const cv: Record<string, boolean> = {};
    params.fields.forEach(f => { fv[f.key] = f.defaultVal; });
    params.checks.forEach(c => { cv[c.key] = c.defaultOn; });
    setFieldValues(fv);
    setCheckValues(cv);
  }, [jobType]);

  // Ladda settings
  useEffect(() => {
    const s = getSettings();
    if (s.hourly_rate) setHourlyRate(String(s.hourly_rate));
    if (s.margin_pct !== undefined) setMarginPct(String(s.margin_pct));
    if (s.include_rot !== undefined) setIncludeRot(s.include_rot);
  }, []);

  // Visa befintlig kalkyl via ?view=id
  useEffect(() => {
    if (viewId) {
      const estimates = getEstimates();
      const found = estimates.find(e => e.id === viewId);
      if (found) {
        setResult(found.data);
        setDescription(found.description);
        setJobType(found.job_type || "badrum");
        setSaved(true);
        setStep("result");
      }
    }
  }, [viewId]);

  // Bygg build_params-objekt att skicka till AI
  function buildAiParams(): Record<string, string> {
    const params = JOB_PARAMS[jobType];
    const out: Record<string, string> = {};

    // Lägg till alla fältvärden
    params.fields.forEach(f => {
      const v = fieldValues[f.key];
      if (v) out[f.key] = f.unit ? `${v} ${f.unit}` : v;
    });

    // Lägg till checkboxar som är på
    const checkedLabels = params.checks
      .filter(c => checkValues[c.key])
      .map(c => c.label);
    if (checkedLabels.length > 0) {
      out["ingår_i_jobbet"] = checkedLabels.join(", ");
    }

    // Lägg till jobbtyp-label
    const jtLabel = JOB_TYPES.find(j => j.id === jobType)?.label || jobType;
    out["jobbtyp"] = jtLabel;

    return out;
  }

  const loadingMessages = [
    "Analyserar jobbeskrivningen...",
    "Beräknar materialåtgång...",
    "Hämtar aktuella priser...",
    "Bygger din kalkyl...",
  ];

  async function handleGenerate() {
    if (!description.trim()) { setError("Beskriv jobbet först."); return; }
    setError(""); setStep("loading"); setSaved(false);
    let msgIdx = 0;
    setLoadingMsg(loadingMessages[0]);
    const interval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, loadingMessages.length - 1);
      setLoadingMsg(loadingMessages[msgIdx]);
    }, 2000);

    // Hämta location från fälten
    const location = fieldValues["location"] || "";
    const buildParams = buildAiParams();

    try {
      const data = await createEstimate({
        description: description.trim(),
        job_type: jobType,
        location: location || undefined,
        hourly_rate: parseFloat(hourlyRate) || 650,
        margin_pct: parseFloat(marginPct) || 15,
        include_rot: includeRot,
        build_params: buildParams,
      });
      clearInterval(interval);
      setResult(data);
      setStep("result");
    } catch (e: any) {
      clearInterval(interval);
      setError(e.message || "Något gick fel.");
      setStep("input");
    }
  }

  async function handleConfirmDraft(name: string) {
    if (!result) return;
    setSavingDraft(true);
    saveEstimate({ id: localId, created: new Date().toISOString(), description: name, job_type: jobType, total_inc_vat: result.totals?.total_inc_vat || 0, customer_pays: result.totals?.customer_pays || result.totals?.total_inc_vat || 0, data: result });
    const { id: sbId } = await saveDraftToSupabase(name, result.totals?.total_inc_vat || 0, result.totals?.customer_pays || result.totals?.total_inc_vat || 0, result);
    if (sbId) setSupabaseId(localId, sbId);
    setSavingDraft(false);
    setShowDraftModal(false);
    setSaved(true);
  }

  function handleDownloadQuote() {
    if (!result) return;
    const settings = getSettings();
    if (!settings.company_name) { alert("Fyll i företagsuppgifter under Inställningar först."); return; }
    const html = generateQuoteHTML(result, settings);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) w.onload = () => setTimeout(() => w.print(), 500);
  }

  function handleClickSend() {
    if (!result) return;
    setPendingSendName(result.job_title || description || "Ny offert");
    setShowSendModal(true);
  }

  function handleConfirmSendName(name: string) {
    setShowSendModal(false);
    setPendingSendName(name);
    setShowMailModal(true);
  }

  async function handleMailCustomer() {
    if (!result || !customerEmail.trim()) return;
    const settings = getSettings();
    if (!settings.company_name) { alert("Fyll i företagsuppgifter under Inställningar först."); return; }
    setSending(true);
    const t = result.totals || {};
    const { id, error: sbErr } = await saveQuoteToSupabase(pendingSendName || result.job_title || description, result.job_summary || description, customerName, customerEmail, t.total_inc_vat || 0, t.customer_pays || t.total_inc_vat || 0, result, settings);
    if (sbErr || !id) { alert("Kunde inte spara offert: " + (sbErr || "Okänt fel")); setSending(false); return; }
    const acceptUrl = `${window.location.origin}/accept?id=${id}`;
    const companyName = settings.company_name || "Vi";
    const subj = `Offert: ${pendingSendName || result.job_title || "Kalkyl"} — ${companyName}`;
    const bd = `Hej ${customerName || ""}!\n\nTack för din förfrågan. Här kommer vår offert för ${pendingSendName || result.job_title || "arbetet"}.\n\n${result.job_summary || ""}\n\nTotalt: ${fmtKr(t.total_inc_vat || 0)}${t.rot_deduction ? `\nROT-avdrag: -${fmtKr(t.rot_deduction)}\nAtt betala: ${fmtKr(t.customer_pays || t.total_inc_vat || 0)}` : ""}\n\nSe hela offerten:\n${acceptUrl}\n\nGiltig i ${settings.quote_validity_days || 30} dagar.\n\nMed vänliga hälsningar\n${settings.contact_name || companyName}${settings.phone ? `\nTel: ${settings.phone}` : ""}${settings.email ? `\n${settings.email}` : ""}`;
    setMailSubject(subj); setMailBody(bd); setSending(false); setMailStep("choose");
  }

  function openGmail() { window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(customerEmail)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`, "_blank"); setSent(true); setShowMailModal(false); setMailStep("form"); }
  function openOutlook() { window.open(`https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(customerEmail)}&subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`, "_blank"); setSent(true); setShowMailModal(false); setMailStep("form"); }
  function openMailto() { window.location.href = `mailto:${customerEmail}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`; setSent(true); setShowMailModal(false); setMailStep("form"); }
  function copyMailContent() { navigator.clipboard.writeText(`Till: ${customerEmail}\nÄmne: ${mailSubject}\n\n${mailBody}`); alert("Kopierat!"); }

  function handleReset() {
    setStep("input"); setResult(null); setDescription(""); setSaved(false); setShowSources(false);
    window.history.replaceState(null, "", "/estimate");
  }

  function getSourceLabel(row: any): string {
    if (row.type === "labor") return `Ditt timpris (${result?.meta?.hourly_rate || 650} kr/h)`;
    if (row.type === "equipment") return "Uppskattat hyrespris";
    return "Uppskattat marknadspris (2025–2026)";
  }

  // ── INPUT ──────────────────────────────────────────────────────────────────
  if (step === "input") {
    const params = JOB_PARAMS[jobType];
    const jtLabel = JOB_TYPES.find(j => j.id === jobType)?.label || "";

    return (
      <ProtectedLayout>
        <Header title="Ny kalkyl" subtitle="Beskriv jobbet — AI:n räknar ut resten" />

        {/* Jobbtyp */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Jobbtyp</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7 }}>
            {JOB_TYPES.map(jt => (
              <button
                key={jt.id}
                onClick={() => setJobType(jt.id)}
                style={{
                  background: jobType === jt.id ? "rgba(106,129,147,0.12)" : "var(--bg-surface)",
                  border: `0.5px solid ${jobType === jt.id ? "rgba(106,129,147,0.5)" : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  padding: "10px 6px 8px",
                  textAlign: "center",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.12s",
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: jobType === jt.id ? "rgba(106,129,147,0.2)" : "rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: jobType === jt.id ? "#6a8193" : "var(--text-faint)",
                }}>
                  {jt.icon}
                </div>
                <span style={{ fontSize: 11, color: jobType === jt.id ? "#8aaabb" : "var(--text-muted)", fontWeight: jobType === jt.id ? 500 : 400 }}>
                  {jt.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Smarta parametrar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", color: "var(--text-faint)", textTransform: "uppercase" }}>
            Smarta parametrar — {jtLabel}
          </div>
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--accent-soft)", border: "0.5px solid var(--accent-border)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "var(--accent-text)", marginBottom: 10 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }} />
          {params.pill}
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          {/* Fält */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: params.checks.length ? 14 : 0 }}>
            {params.fields.map(f => (
              <div key={f.key} style={{ background: "var(--bg-surface)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 7 }}>
                  {f.label}
                </div>
                {f.type === "select" ? (
                  <select
                    className="input"
                    style={{ width: "100%", padding: "6px 8px", fontSize: 13 }}
                    value={fieldValues[f.key] || f.defaultVal}
                    onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                  >
                    {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", background: "var(--bg-elevated)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 10px" }}>
                    <input
                      type={f.type === "number" ? "number" : "text"}
                      placeholder={f.type === "number" ? "0" : "—"}
                      value={fieldValues[f.key] ?? f.defaultVal}
                      onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                      style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text-primary)", width: "100%", minWidth: 0 }}
                    />
                    {f.unit && <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: 4, flexShrink: 0 }}>{f.unit}</span>}
                  </div>
                )}
                <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 5, lineHeight: 1.4, opacity: 0.7 }}>{f.hint}</div>
              </div>
            ))}
          </div>

          {/* Checkboxar */}
          {params.checks.length > 0 && (
            <>
              <div style={{ height: "0.5px", background: "var(--border)", marginBottom: 10 }} />
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>
                Ingår i jobbet
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {params.checks.map(c => (
                  <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", padding: "6px 0" }}>
                    <div
                      onClick={() => setCheckValues(prev => ({ ...prev, [c.key]: !prev[c.key] }))}
                      style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        border: `0.5px solid ${checkValues[c.key] ? "rgba(106,129,147,0.6)" : "var(--border)"}`,
                        background: checkValues[c.key] ? "rgba(106,129,147,0.18)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                      }}
                    >
                      {checkValues[c.key] && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2.5 2.5L8 3" stroke="#6a8193" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: checkValues[c.key] ? "var(--text-secondary)" : "var(--text-muted)" }}>
                      {c.label}
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Jobbeskrivning */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", color: "var(--text-faint)", textTransform: "uppercase" }}>Jobbeskrivning</div>
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <textarea
            className="input textarea"
            placeholder={`Beskriv jobbet i fritext. T.ex: Badrumsrenovering ca 6 kvm. Riva befintligt kakel golv och väggar. Nytt tätskikt, klinker på golv (60×60), kakel på väggar (30×60). Ny dusch med glasvägg, ny toalett och handfat.`}
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
          />
          {error && <div className="login-error" style={{ marginTop: 10 }}>{error}</div>}
        </div>

        {/* Kalkylparametrar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.2px", color: "var(--text-faint)", textTransform: "uppercase" }}>Kalkylparametrar</div>
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label className="label">Timpris (kr/h)</label>
              <input className="input" type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} />
            </div>
            <div>
              <label className="label">Påslag (%)</label>
              <input className="input" type="number" value={marginPct} onChange={e => setMarginPct(e.target.value)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 20 }}>
              <div
                onClick={() => setIncludeRot(!includeRot)}
                style={{
                  width: 36, height: 20, borderRadius: 10, cursor: "pointer", flexShrink: 0, position: "relative",
                  background: includeRot ? "var(--accent)" : "var(--border)",
                  transition: "background 0.15s",
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  position: "absolute", top: 2, transition: "left 0.15s",
                  left: includeRot ? 18 : 2,
                }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>ROT-avdrag</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)" }}>30% på arbete</div>
              </div>
            </div>
          </div>
        </div>

        <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={handleGenerate}>
          Generera kalkyl med AI
        </button>
      </ProtectedLayout>
    );
  }

  // ── LOADING ────────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <ProtectedLayout>
        <div className="loading-overlay">
          <svg width="64" height="64" viewBox="0 0 220 240" fill="none">
            <path d="M 110 10 Q 114 95, 118 115 Q 135 119, 210 122 Q 135 125, 118 129 Q 114 149, 110 234 Q 106 149, 102 129 Q 85 125, 10 122 Q 85 119, 102 115 Q 106 95, 110 10 Z" fill="#ffffff"/>
            <path d="M 110 108 Q 112 118, 114 120 Q 120 121, 130 122 Q 120 123, 114 124 Q 112 126, 110 136 Q 108 126, 106 124 Q 100 123, 90 122 Q 100 121, 106 120 Q 108 118, 110 108 Z" fill="#6a8193"/>
          </svg>
          <div className="loading-text">{loadingMsg}</div>
          <div className="loading-bar"><div className="loading-bar-fill" /></div>
        </div>
      </ProtectedLayout>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────
  if (!result) return null;
  const t = result.totals || {};

  return (
    <ProtectedLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div className="page-title">{result.job_title || "Kalkyl"}</div>
          <div className="page-subtitle">{result.job_summary || description}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>Ny kalkyl</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSources(!showSources)}>
            {showSources ? "Dölj källor" : "Visa priskällor"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadQuote}>📄 Ladda ner offert</button>
          <button className="btn btn-secondary btn-sm" onClick={handleClickSend}
            style={{ background: "var(--accent-soft)", color: "var(--accent-text)", borderColor: "var(--accent-border)" }}>
            {sent ? "✓ Skickad" : "✉ Maila kund"}
          </button>
          <button className={`btn btn-sm ${saved ? "btn-secondary" : "btn-primary"}`}
            onClick={() => !saved && setShowDraftModal(true)} disabled={saved}>
            {saved ? "✓ Utkast sparat" : "Spara utkast"}
          </button>
        </div>
      </div>

      {showSources && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          <strong>Om priskällor:</strong> Materialpriser är uppskattade baserat på svenska marknadspriser 2025–2026.
          Arbetskostnad baseras på ditt timpris ({result.meta?.hourly_rate || 650} kr/h).
          Verifiera alltid mot faktiska grossistpriser innan offert skickas.
        </div>
      )}

      <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
        <table className="est-table">
          <thead>
            <tr>
              <th style={{ width: showSources ? "35%" : "40%" }}>Post</th>
              <th>Enhet</th>
              <th className="right">Antal</th>
              <th className="right">À-pris</th>
              <th className="right">Summa</th>
              {showSources && <th style={{ width: "20%" }}>Källa</th>}
            </tr>
          </thead>
          <tbody>
            {(result.categories || []).map((cat: any, ci: number) => (
              <>
                <tr key={`cat-${ci}`} className="est-cat-row">
                  <td colSpan={showSources ? 6 : 5}>{cat.name}</td>
                </tr>
                {(cat.rows || []).map((row: any, ri: number) => (
                  <tr key={`row-${ci}-${ri}`}>
                    <td>
                      <div style={{ color: "var(--text-primary)", fontWeight: 500 }}>{row.description}</div>
                      {row.note && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{row.note}</div>}
                    </td>
                    <td style={{ color: "var(--text-faint)" }}>{row.unit}</td>
                    <td className="right" style={{ fontFamily: "var(--mono)" }}>{row.quantity}</td>
                    <td className="right" style={{ fontFamily: "var(--mono)" }}>{fmtKr(row.unit_price)}</td>
                    <td className="right" style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{fmtKr(row.total)}</td>
                    {showSources && <td style={{ fontSize: 11, color: "var(--text-faint)", fontStyle: "italic" }}>{getSourceLabel(row)}</td>}
                  </tr>
                ))}
                <tr className="est-subtotal">
                  <td colSpan={showSources ? 5 : 4} style={{ textAlign: "right" }}>Delsumma {cat.name}</td>
                  <td className="right" style={{ fontFamily: "var(--mono)" }}>{fmtKr(cat.subtotal)}</td>
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="est-total-section">
        <div className="est-total-row"><span className="label-text">Material</span><span className="value">{fmtKr(t.material_total || 0)}</span></div>
        <div className="est-total-row"><span className="label-text">Arbete</span><span className="value">{fmtKr(t.labor_total || 0)}</span></div>
        {(t.equipment_total || 0) > 0 && <div className="est-total-row"><span className="label-text">Utrustning</span><span className="value">{fmtKr(t.equipment_total)}</span></div>}
        <div className="est-total-row"><span className="label-text">Delsumma</span><span className="value">{fmtKr(t.subtotal || 0)}</span></div>
        {(t.margin_amount || 0) > 0 && <div className="est-total-row"><span className="label-text">Påslag ({result.meta?.margin_pct || 15}%)</span><span className="value">{fmtKr(t.margin_amount)}</span></div>}
        <div className="est-total-row"><span className="label-text">Summa exkl. moms</span><span className="value">{fmtKr(t.total_ex_vat || 0)}</span></div>
        <div className="est-total-row"><span className="label-text">Moms (25%)</span><span className="value">{fmtKr(t.vat || 0)}</span></div>
        <div className="est-total-row big"><span>Totalt inkl. moms</span><span className="value">{fmtKr(t.total_inc_vat || 0)}</span></div>
        {(t.rot_deduction || 0) > 0 && (
          <>
            <div className="est-total-row" style={{ marginTop: 12 }}>
              <span className="label-text">ROT-avdrag (30% på arbete)</span>
              <span className="est-rot">−{fmtKr(t.rot_deduction)}</span>
            </div>
            <div className="est-total-row big">
              <span>Kunden betalar</span>
              <span className="value" style={{ color: "var(--green)" }}>{fmtKr(t.customer_pays || t.total_inc_vat || 0)}</span>
            </div>
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

      {/* Namnmodal utkast */}
      {showDraftModal && <NameModal defaultName={result.job_title || description || "Nytt utkast"} onConfirm={handleConfirmDraft} onCancel={() => setShowDraftModal(false)} title="Spara utkast" confirmLabel="Spara utkast" saving={savingDraft} />}

      {/* Namnmodal skicka */}
      {showSendModal && <NameModal defaultName={result.job_title || description || "Ny offert"} onConfirm={handleConfirmSendName} onCancel={() => setShowSendModal(false)} title="Namnge offerten" confirmLabel="Fortsätt" saving={false} />}

      {/* Mailmodal */}
      {showMailModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-elevated)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "28px 32px", width: 440, maxWidth: "90vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{mailStep === "form" ? "Skicka offert till kund" : "Välj mailapp"}</div>
              <button onClick={() => { setShowMailModal(false); setMailStep("form"); }} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            {mailStep === "form" ? (
              <>
                <div style={{ padding: "10px 14px", background: "var(--accent-soft)", border: "0.5px solid var(--accent-border)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--accent-text)", marginBottom: 16 }}>
                  <strong>Offert:</strong> {pendingSendName}
                </div>
                <div style={{ marginBottom: 14 }}><label className="label">Kundens namn</label><input className="input" placeholder="Anna Andersson" value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
                <div style={{ marginBottom: 20 }}><label className="label">Kundens e-post *</label><input className="input" type="email" placeholder="kund@email.se" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></div>
                <div style={{ padding: "12px 16px", background: "var(--bg-surface)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
                  Kunden får ett mail med en sammanfattning och en länk för att granska och godkänna offerten.
                </div>
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
