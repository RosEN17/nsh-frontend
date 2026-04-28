"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { createEstimate } from "@/lib/api";
import { saveEstimate, getEstimates, setSupabaseId } from "@/lib/store";
import { saveQuoteToSupabase, saveDraftToSupabase } from "@/lib/quotes";
import RowFeedbackModal, { type RowEdit, type QuoteRow } from "@/components/RowFeedbackModal";

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
  const companyName = settings.company_name || "Företagsnamn";
  const hourlyRate = result.meta?.hourly_rate || settings.hourly_rate || 650;

  // ── Tabellrader ─────────────────────────────────────────
  let rowsHTML = "";
  for (const cat of result.categories || []) {
    rowsHTML += `<tr style="background:#f5f5f5"><td colspan="5" style="padding:10px 12px;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;border-bottom:1px solid #e0e0e0;color:#444">${cat.name}</td></tr>`;
    for (const row of cat.rows || []) {
      rowsHTML += `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;color:#222">${row.description}${row.note ? `<br><span style="font-size:10px;color:#999">${row.note}</span>` : ""}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:11px;color:#888;text-align:center">${row.unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:'Courier New',monospace">${row.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:'Courier New',monospace">${fmtKr(row.unit_price)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;text-align:right;font-family:'Courier New',monospace;font-weight:600">${fmtKr(row.total)}</td>
      </tr>`;
    }
    rowsHTML += `<tr style="background:#fafafa"><td colspan="4" style="padding:8px 12px;text-align:right;font-weight:600;font-size:11px;border-bottom:2px solid #ddd;color:#555">Delsumma</td><td style="padding:8px 12px;text-align:right;font-weight:700;font-size:12px;font-family:'Courier New',monospace;border-bottom:2px solid #ddd">${fmtKr(cat.subtotal)}</td></tr>`;
  }

  // ── Logotyp & info ──────────────────────────────────────
  const logoHTML = settings.logo_base64
    ? `<img src="${settings.logo_base64}" style="max-height:55px;max-width:180px;object-fit:contain" />`
    : `<div style="font-size:22px;font-weight:800;color:#1a1a1a;letter-spacing:-0.5px">${companyName}</div>`;

  const companyInfoLines = [
    settings.address,
    settings.zip_city,
    settings.phone ? `Tel: ${settings.phone}` : "",
    settings.email,
    settings.website,
  ].filter(Boolean);

  const paymentParts = [
    settings.bankgiro ? `Bankgiro: ${settings.bankgiro}` : "",
    settings.plusgiro ? `Plusgiro: ${settings.plusgiro}` : "",
    settings.iban ? `IBAN: ${settings.iban}` : "",
    settings.f_skatt ? "Godkänd för F-skatt" : "",
  ].filter(Boolean);

  // ── Anbudstext ──────────────────────────────────────────
  const anbudsText = settings.quote_intro ||
    "Vi tackar för er förfrågan och erbjuder oss härmed att utföra arbeten på rubricerat projekt i enlighet med erhållet förfrågningsunderlag/platsbesök";

  // ── Förutsättningar ─────────────────────────────────────
  const defaultPrereqs = [
    "Att fri framkomlighet finns och att störande arbete kan utföras dagtid 07.00–17.00",
    "Att ni fritt tillhandahåller el och vatten",
    "Att container/säckar för avfall ska kunna ställas i nära anslutning till respektive hus",
    "Att 2 meter grusad och plan mark finns runt grund för byggnation ställning",
  ];
  const prereqLines = settings.quote_prerequisites
    ? settings.quote_prerequisites.split("\n").filter(Boolean)
    : defaultPrereqs;

  // ── Reservationer ───────────────────────────────────────
  const defaultReservations = [
    "Byggström tillhandahålls av byggherren",
    "Anslutningsavgifter samt utsättning ingår ej",
    "Byggvatten ingår ej i denna offert, skall finnas minst 10 meter från respektive lgh under arbete",
    "Markarbeten ingår ej i denna offert",
    "Offert kan komma justeras efter mottagning bygghandlingar",
    "Vi förutsätter full framkomlighet för samtliga transporter",
    "Om vår offert bedöms som intressant förutsätter vi att dialog förs med oss innan avtal tecknas",
    "Sprängning ingår ej i detta anbud",
  ];
  const reservationLines = settings.quote_reservations
    ? settings.quote_reservations.split("\n").filter(Boolean)
    : defaultReservations;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Offert ${quoteNr}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 820px; margin: 0 auto; padding: 40px; color: #222; font-size: 13px; line-height: 1.6; }
  @media print { body { padding: 20px; font-size: 11px; } }
  table { width: 100%; border-collapse: collapse; }
  h2 { font-size: 16px; font-weight: 700; margin: 0 0 12px; color: #1a1a1a; }
  .section { margin-bottom: 28px; }
  .divider { border: none; border-top: 1px solid #e0e0e0; margin: 24px 0; }
  .label { font-weight: 700; margin-bottom: 3px; }
</style>
</head>
<body>

<!-- ══ HEADER ══ -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:3px solid #6a8193">
  <div>
    ${logoHTML}
    ${settings.logo_base64 && companyName ? `<div style="font-size:11px;color:#555;margin-top:5px;font-weight:600">${companyName}</div>` : ""}
    ${settings.org_number ? `<div style="font-size:10px;color:#888;margin-top:1px">Org.nr: ${settings.org_number}</div>` : ""}
    <div style="font-size:10px;color:#888;margin-top:2px;line-height:1.7">
      ${companyInfoLines.join("<br>")}
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:26px;font-weight:800;color:#6a8193;letter-spacing:1px">OFFERT</div>
    <div style="font-size:12px;color:#555;margin-top:8px;line-height:1.8">
      <div>Offertnummer: <strong>${quoteNr}</strong></div>
      <div>Datum: ${today}</div>
      <div>Giltig t.o.m: <strong>${validUntil}</strong></div>
      ${settings.contact_name ? `<div style="margin-top:4px">Kontakt: ${settings.contact_name}${settings.contact_title ? `, ${settings.contact_title}` : ""}</div>` : ""}
    </div>
  </div>
</div>

<!-- ══ KUND ══ -->
<div style="display:flex;gap:40px;margin-bottom:24px">
  <div style="flex:1;padding:14px 16px;border:1px dashed #ccc;border-radius:4px;font-size:12px;color:#999">
    <div style="font-weight:700;color:#666;margin-bottom:8px">KUND</div>
    Namn: ________________________________<br><br>
    Adress: ________________________________<br><br>
    Telefon: ________________________________
  </div>
  <div style="flex:1;padding:14px 16px;background:#f9f9f9;border-radius:4px;font-size:12px">
    <div style="font-weight:700;color:#666;margin-bottom:8px">AVSER</div>
    <div style="font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:4px">${result.job_title || "Kalkyl"}</div>
    <div style="color:#666;line-height:1.5">${result.job_summary || ""}</div>
  </div>
</div>

<!-- ══ INLEDNING & FÖRUTSÄTTNINGAR ══ -->
<div class="section">
  <p style="margin:0 0 14px;color:#333;line-height:1.7">${anbudsText}</p>
  <p style="margin:0 0 6px;font-weight:700;color:#1a1a1a">Anbudssumma förutsätter:</p>
  <ul style="margin:0;padding-left:20px;color:#333;line-height:1.9">
    ${prereqLines.map((l: string) => `<li>${l}</li>`).join("")}
  </ul>
</div>

<hr class="divider">

<!-- ══ KALKYLRADER ══ -->
<div class="section">
  <h2>Specifikation</h2>
  <table style="margin-bottom:20px">
    <thead>
      <tr style="background:#1a1a1a;color:white">
        <th style="padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;width:40%">Post</th>
        <th style="padding:9px 12px;text-align:center;font-size:10px;text-transform:uppercase">Enhet</th>
        <th style="padding:9px 12px;text-align:right;font-size:10px;text-transform:uppercase">Antal</th>
        <th style="padding:9px 12px;text-align:right;font-size:10px;text-transform:uppercase">À-pris</th>
        <th style="padding:9px 12px;text-align:right;font-size:10px;text-transform:uppercase">Summa</th>
      </tr>
    </thead>
    <tbody>${rowsHTML}</tbody>
  </table>

  <!-- Summering -->
  <div style="max-width:360px;margin-left:auto">
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #eee"><span>Material</span><span style="font-family:'Courier New',monospace">${fmtKr(t.material_total || 0)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #eee"><span>Arbete</span><span style="font-family:'Courier New',monospace">${fmtKr(t.labor_total || 0)}</span></div>
    ${(t.equipment_total || 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #eee"><span>Utrustning</span><span style="font-family:'Courier New',monospace">${fmtKr(t.equipment_total)}</span></div>` : ""}
    ${(t.margin_amount || 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #eee"><span>Påslag</span><span style="font-family:'Courier New',monospace">${fmtKr(t.margin_amount)}</span></div>` : ""}
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #eee"><span>Summa exkl. moms</span><span style="font-family:'Courier New',monospace">${fmtKr(t.total_ex_vat || 0)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666;border-bottom:1px solid #eee"><span>Moms 25%</span><span style="font-family:'Courier New',monospace">${fmtKr(t.vat || 0)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:18px;font-weight:800;border-top:2px solid #1a1a1a;margin-top:4px"><span>Totalt inkl. moms</span><span style="font-family:'Courier New',monospace">${fmtKr(t.total_inc_vat || 0)}</span></div>
    ${t.rot_deduction ? `
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#16a34a"><span>ROT-avdrag (30% på arbete)</span><span style="font-family:'Courier New',monospace">−${fmtKr(t.rot_deduction)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:18px;font-weight:800;color:#16a34a;border-top:2px solid #16a34a;margin-top:4px"><span>Att betala</span><span style="font-family:'Courier New',monospace">${fmtKr(t.customer_pays || t.total_inc_vat || 0)}</span></div>
    ` : ""}
  </div>
</div>

${result.estimated_days ? `<div style="padding:10px 16px;background:#f0f9ff;border-left:3px solid #3b82f6;font-size:12px;color:#1e40af;margin-bottom:16px">Uppskattad tidsåtgång: ca ${result.estimated_days} arbetsdagar</div>` : ""}

<hr class="divider">

<!-- ══ RESERVATIONER ══ -->
<div class="section">
  <p style="margin:0 0 6px;font-weight:700;color:#1a1a1a">Reservationer:</p>
  <ul style="margin:0;padding-left:20px;color:#333;line-height:1.9">
    ${reservationLines.map((l: string) => `<li>${l}</li>`).join("")}
  </ul>
</div>

<hr class="divider">

<!-- ══ FÖRUTSÄTTNINGAR & VILLKOR ══ -->
<div class="section">
  <h2>Förutsättningar &amp; villkor</h2>

  <div style="margin-bottom:14px">
    <div class="label">Betalningsvillkor</div>
    <div>${settings.payment_terms || "30 dagar."}</div>
  </div>

  <div style="margin-bottom:14px">
    <div class="label">Offertens giltighetstid</div>
    <div>Offertens giltighetstid gäller ${validDays} dagar från ovanstående datum.</div>
  </div>

  <div style="margin-bottom:14px">
    <div class="label">Tillkommande arbeten</div>
    <div>
      Arbetad tid debiteras med ${hourlyRate.toLocaleString("sv-SE")},00 exkl. moms<br>
      Underentreprenörers arbeten debiteras mot redovisad kostnad +12%<br>
      Material debiteras mot redovisad kostnad +12%
    </div>
  </div>

  ${settings.quote_footer ? `
  <div style="margin-bottom:14px">
    <div class="label">Övriga villkor</div>
    <div>${settings.quote_footer.replace(/\n/g, "<br>")}</div>
  </div>` : ""}

  <div style="margin-bottom:14px">
    <div class="label">Personuppgifter</div>
    <div style="color:#444;line-height:1.7">
      Vid godkännande av denna offert accepterar du att vi behandlar dina personuppgifter för att kunna fullfölja vårt åtagande gentemot dig som kund.
      Den information vi behandlar för er är information som berörs och är nödvändig för byggprojektets administration.
      Personuppgifterna lagras och hanteras med tekniska och organisatoriska säkerhetsåtgärder för att skydda hanteringen av personuppgifter
      och lever upp till de krav som ställs enligt EU:s dataskyddsförordning (GDPR).
      <br><br>
      Vi kommer om ni begär det att radera eller anonymisera och oavsett anledning därtill, inklusive att radera samtliga kopior som inte enligt GDPR
      måste sparas. Vi kommer inte att överföra personuppgifter till land utanför EU/ESS.
    </div>
  </div>
</div>

<hr class="divider">

<!-- ══ UNDERSKRIFTER ══ -->
<div style="display:flex;justify-content:space-between;margin-bottom:32px">
  <div style="width:45%">
    <div style="font-size:11px;color:#888;margin-bottom:36px">Leverantör</div>
    <div style="border-top:1px solid #bbb;padding-top:8px;font-size:12px;color:#444">
      ${settings.contact_name || companyName}${settings.contact_title ? `<br>${settings.contact_title}` : ""}
    </div>
  </div>
  <div style="width:45%">
    <div style="font-size:11px;color:#888;margin-bottom:36px">Kund (godkännande)</div>
    <div style="border-top:1px solid #bbb;padding-top:8px;font-size:12px;color:#888">
      Namn: ________________________<br>
      Datum: ________________________
    </div>
  </div>
</div>

<!-- ══ SIDFOT — FÖRETAGSUPPGIFTER ══ -->
<div style="border-top:2px solid #6a8193;padding-top:16px;margin-top:8px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;font-size:11px;color:#555">
    <div>
      <div style="font-weight:700;color:#1a1a1a;font-size:12px;margin-bottom:4px">${companyName}</div>
      ${settings.org_number ? `<div>Org.nr: ${settings.org_number}</div>` : ""}
      ${settings.f_skatt ? `<div>Godkänd för F-skatt</div>` : ""}
      ${settings.address ? `<div>${settings.address}${settings.zip_city ? `, ${settings.zip_city}` : ""}</div>` : ""}
    </div>
    <div style="text-align:center">
      ${settings.phone ? `<div>Tel: ${settings.phone}</div>` : ""}
      ${settings.email ? `<div>${settings.email}</div>` : ""}
      ${settings.website ? `<div>${settings.website}</div>` : ""}
    </div>
    <div style="text-align:right">
      ${settings.bankgiro ? `<div>Bankgiro: ${settings.bankgiro}</div>` : ""}
      ${settings.plusgiro ? `<div>Plusgiro: ${settings.plusgiro}</div>` : ""}
      ${settings.iban ? `<div>IBAN: ${settings.iban}</div>` : ""}
    </div>
  </div>
</div>

</body>
</html>`;
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

  // Radjustering och feedback
  const [editingRow, setEditingRow] = useState<{ row: QuoteRow; cat: string; catIdx: number; rowIdx: number } | null>(null);
  const [allEdits, setAllEdits] = useState<Record<string, RowEdit>>({});
  const [localCategories, setLocalCategories] = useState<any[]>([]);

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

  // Filuploads
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [drawingFiles, setDrawingFiles] = useState<File[]>([]);

  // Kakel pris per kvm
  const [tilePricePerSqm, setTilePricePerSqm] = useState<string>("");

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

    // Kakel pris per kvm om angivet
    if (tilePricePerSqm && parseFloat(tilePricePerSqm) > 0) {
      out["tile_price_per_sqm"] = `${tilePricePerSqm} kr/kvm inkl. moms`;
    }

    return out;
  }

  const loadingMessages = [
    "Analyserar jobbeskrivningen...",
    "Beräknar materialåtgång...",
    "Hämtar aktuella priser...",
    "Bygger din kalkyl...",
  ];

  // Konvertera en File till base64 data-URL
  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleGenerate() {
    if (!description.trim()) { setError("Beskriv jobbet först."); return; }
    setError(""); setStep("loading"); setSaved(false);
    let msgIdx = 0;
    setLoadingMsg(loadingMessages[0]);
    const interval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, loadingMessages.length - 1);
      setLoadingMsg(loadingMessages[msgIdx]);
    }, 2000);

    const location = fieldValues["location"] || "";
    const buildParams = buildAiParams();

    try {
      // Konvertera projektbilder till base64
      const imagePayload = await Promise.all(
        imageFiles.map(async (f) => ({
          name: f.name,
          data: await fileToBase64(f),
        }))
      );

      // Konvertera PDF-underlag till base64
      const pdfPayload = await Promise.all(
        pdfFiles.map(async (f) => ({
          name: f.name,
          data: await fileToBase64(f),
        }))
      );

      // Konvertera ritningar — bilder skickas som images, PDFs som documents
      const drawingImages = await Promise.all(
        drawingFiles
          .filter((f) => !f.name.toLowerCase().endsWith(".pdf"))
          .map(async (f) => ({ name: f.name, data: await fileToBase64(f) }))
      );
      const drawingPdfs = await Promise.all(
        drawingFiles
          .filter((f) => f.name.toLowerCase().endsWith(".pdf"))
          .map(async (f) => ({ name: f.name, data: await fileToBase64(f) }))
      );

      const data = await createEstimate({
        description: description.trim(),
        job_type: jobType,
        location: location || undefined,
        hourly_rate: parseFloat(hourlyRate) || 650,
        margin_pct: parseFloat(marginPct) || 15,
        include_rot: includeRot,
        build_params: buildParams,
        images: [...imagePayload, ...drawingImages],
        documents: [...pdfPayload, ...drawingPdfs],
      });
      clearInterval(interval);
      setResult(data);
      setLocalCategories(JSON.parse(JSON.stringify(data.categories || [])));
      setAllEdits({});
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

          {/* Kakel pris per kvm — visas för badrum och kök */}
          {(jobType === "badrum" || jobType === "kok") && (
            <div style={{ marginBottom: params.checks.length ? 14 : 0, marginTop: params.fields.length > 0 ? 10 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", letterSpacing: "1px", textTransform: "uppercase" }}>
                  Kakel & Klinker
                </div>
                <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
              </div>
              <div style={{ background: "var(--bg-surface)", border: `0.5px solid ${tilePricePerSqm ? "rgba(106,129,147,0.5)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 7 }}>
                    Kakelpris inkl. moms
                  </div>
                  <div style={{ display: "flex", alignItems: "center", background: "var(--bg-elevated)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 10px" }}>
                    <input
                      type="number"
                      placeholder="t.ex. 600"
                      value={tilePricePerSqm}
                      onChange={e => setTilePricePerSqm(e.target.value)}
                      style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: "var(--text-primary)", width: "100%", minWidth: 0 }}
                    />
                    <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: 4, flexShrink: 0 }}>kr/kvm</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 5, lineHeight: 1.4, opacity: 0.7 }}>
                    AI använder detta pris för kakel och klinker i kalkylen
                  </div>
                </div>
                {tilePricePerSqm && parseFloat(tilePricePerSqm) > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <div style={{ fontSize: 11, color: "#6a8193", fontWeight: 500 }}>
                      {parseFloat(tilePricePerSqm).toLocaleString("sv-SE")} kr/kvm
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-faint)" }}>
                      exkl. moms: {Math.round(parseFloat(tilePricePerSqm) / 1.25).toLocaleString("sv-SE")} kr
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Checkboxar */}
          {params.checks.length > 0 && (
            <>
              <div style={{ height: "0.5px", background: "var(--border)", marginBottom: 10 }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-faint)", letterSpacing: "1px", textTransform: "uppercase" }}>
                  Ingår i jobbet
                </div>
                {/* Ritningar upload */}
                <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", background: "var(--bg-surface)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "4px 10px", fontSize: 11, color: "var(--text-muted)", transition: "border-color 0.12s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(106,129,147,0.5)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M2 14V10M14 14V10M8 2v8M5 5l3-3 3 3" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M2 14h12" strokeLinecap="round"/>
                  </svg>
                  <span>Ladda upp ritningar</span>
                  {drawingFiles.length > 0 && (
                    <span style={{ background: "rgba(106,129,147,0.2)", color: "#6a8193", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 600, marginLeft: 2 }}>
                      {drawingFiles.length}
                    </span>
                  )}
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.dwg,.dxf" multiple style={{ display: "none" }}
                    onChange={e => {
                      const files = Array.from(e.target.files || []);
                      setDrawingFiles(prev => [...prev, ...files]);
                      e.target.value = "";
                    }} />
                </label>
              </div>
              {drawingFiles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                  {drawingFiles.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "var(--bg-surface)", border: "0.5px solid var(--border)", borderRadius: "var(--radius)", padding: "3px 8px", fontSize: 11, color: "var(--text-muted)" }}>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="1" width="10" height="13" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h4" strokeLinecap="round"/></svg>
                      <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <button onClick={() => setDrawingFiles(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 13 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
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

          {/* Filuppladdning — underlag och bilder */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {/* PDF med underlag */}
            <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", background: "var(--bg-surface)", border: `0.5px solid ${pdfFiles.length > 0 ? "rgba(106,129,147,0.5)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 12, color: pdfFiles.length > 0 ? "#8aaabb" : "var(--text-muted)", transition: "all 0.12s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(106,129,147,0.5)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = pdfFiles.length > 0 ? "rgba(106,129,147,0.5)" : "var(--border)")}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="2" y="1" width="9" height="13" rx="1.5"/>
                <path d="M8 1v4h4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5 8h6M5 10.5h4" strokeLinecap="round"/>
              </svg>
              <span style={{ fontWeight: 500 }}>PDF med underlag</span>
              {pdfFiles.length > 0 && (
                <span style={{ background: "rgba(106,129,147,0.2)", color: "#6a8193", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>
                  {pdfFiles.length} fil{pdfFiles.length > 1 ? "er" : ""}
                </span>
              )}
              <input type="file" accept=".pdf" multiple style={{ display: "none" }}
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  setPdfFiles(prev => [...prev, ...files]);
                  e.target.value = "";
                }} />
            </label>

            {/* Projektbilder */}
            <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", background: "var(--bg-surface)", border: `0.5px solid ${imageFiles.length > 0 ? "rgba(106,129,147,0.5)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "8px 12px", fontSize: 12, color: imageFiles.length > 0 ? "#8aaabb" : "var(--text-muted)", transition: "all 0.12s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(106,129,147,0.5)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = imageFiles.length > 0 ? "rgba(106,129,147,0.5)" : "var(--border)")}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="1" y="3" width="14" height="10" rx="1.5"/>
                <circle cx="5.5" cy="7" r="1.5"/>
                <path d="M1 11l4-3 3 3 2-2 5 4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontWeight: 500 }}>Projektbilder</span>
              {imageFiles.length > 0 && (
                <span style={{ background: "rgba(106,129,147,0.2)", color: "#6a8193", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>
                  {imageFiles.length} bild{imageFiles.length > 1 ? "er" : ""}
                </span>
              )}
              <input type="file" accept=".png,.jpg,.jpeg,.webp" multiple style={{ display: "none" }}
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  setImageFiles(prev => [...prev, ...files]);
                  e.target.value = "";
                }} />
            </label>
          </div>

          {/* Visa uppladdade filer */}
          {(pdfFiles.length > 0 || imageFiles.length > 0) && (
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 5 }}>
              {pdfFiles.map((f, i) => (
                <div key={`pdf-${i}`} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(239,68,68,0.06)", border: "0.5px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius)", padding: "3px 8px", fontSize: 11, color: "var(--text-muted)" }}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#ef4444" strokeWidth="1.4"><rect x="2" y="1" width="10" height="13" rx="1.5"/><path d="M5 6h6M5 9h6M5 12h4" strokeLinecap="round"/></svg>
                  <span style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <button onClick={() => setPdfFiles(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                </div>
              ))}
              {imageFiles.map((f, i) => (
                <div key={`img-${i}`} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(106,129,147,0.06)", border: "0.5px solid rgba(106,129,147,0.2)", borderRadius: "var(--radius)", padding: "3px 8px", fontSize: 11, color: "var(--text-muted)" }}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="#6a8193" strokeWidth="1.4"><rect x="1" y="2" width="14" height="12" rx="1.5"/><circle cx="5" cy="7" r="1.5"/><path d="M1 11l4-3 3 3 2-2 6 4" strokeLinecap="round"/></svg>
                  <span style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <button onClick={() => setImageFiles(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}>×</button>
                </div>
              ))}
            </div>
          )}
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
            {(localCategories.length > 0 ? localCategories : result.categories || []).map((cat: any, ci: number) => (
              <>
                <tr key={`cat-${ci}`} className="est-cat-row">
                  <td colSpan={showSources ? 6 : 5}>{cat.name}</td>
                </tr>
                {(cat.rows || []).map((row: any, ri: number) => {
                  const editKey = `${cat.name}__${row.description}`;
                  const isEdited = !!allEdits[editKey];
                  return (
                    <tr key={`row-${ci}-${ri}`} style={{ background: isEdited ? "rgba(106,129,147,0.06)" : undefined }}>
                      <td>
                        <div style={{ color: "var(--text-primary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                          {row.description}
                          {isEdited && (
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#6a8193", background: "rgba(106,129,147,0.15)", borderRadius: 10, padding: "1px 6px", flexShrink: 0 }}>
                              justerad
                            </span>
                          )}
                        </div>
                        {row.note && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{row.note}</div>}
                      </td>
                      <td style={{ color: "var(--text-faint)" }}>{row.unit}</td>

                      {/* ANTAL — klickbar cell */}
                      <td className="right">
                        <button
                          onClick={() => setEditingRow({ row: row as QuoteRow, cat: cat.name, catIdx: ci, rowIdx: ri })}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontFamily: "var(--mono)", fontSize: 13,
                            color: isEdited && allEdits[editKey]?.field === "quantity" ? "#6a8193" : "var(--text-primary)",
                            fontWeight: isEdited && allEdits[editKey]?.field === "quantity" ? 700 : 400,
                            padding: "2px 4px", borderRadius: 4,
                            textDecoration: "underline dotted",
                            textUnderlineOffset: 3,
                          }}
                          title="Justera antal"
                        >
                          {row.quantity}
                        </button>
                      </td>

                      {/* À-PRIS — klickbar cell */}
                      <td className="right">
                        <button
                          onClick={() => setEditingRow({ row: row as QuoteRow, cat: cat.name, catIdx: ci, rowIdx: ri })}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontFamily: "var(--mono)", fontSize: 13,
                            color: isEdited && allEdits[editKey]?.field === "unit_price" ? "#6a8193" : "var(--text-primary)",
                            fontWeight: isEdited && allEdits[editKey]?.field === "unit_price" ? 700 : 400,
                            padding: "2px 4px", borderRadius: 4,
                            textDecoration: "underline dotted",
                            textUnderlineOffset: 3,
                          }}
                          title="Justera à-pris"
                        >
                          {fmtKr(row.unit_price)}
                        </button>
                      </td>

                      <td className="right" style={{ fontFamily: "var(--mono)", fontWeight: 600 }}>{fmtKr(row.total)}</td>
                      {showSources && <td style={{ fontSize: 11, color: "var(--text-faint)", fontStyle: "italic" }}>{getSourceLabel(row)}</td>}
                    </tr>
                  );
                })}
                <tr className="est-subtotal">
                  <td colSpan={showSources ? 5 : 4} style={{ textAlign: "right" }}>Delsumma {cat.name}</td>
                  <td className="right" style={{ fontFamily: "var(--mono)" }}>{fmtKr(cat.subtotal)}</td>
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── RADJUSTERINGS-MODAL ── */}
      {editingRow && (
        <RowFeedbackModal
          quoteNumber={result.job_title || "okänt"}
          row={editingRow.row}
          category={editingRow.cat}
          jobType={jobType}
          region={fieldValues["location"] || ""}
          allEdits={allEdits}
          onSave={(updatedRow, updatedEdits) => {
            // Uppdatera raden i localCategories
            setLocalCategories(prev => {
              const next = JSON.parse(JSON.stringify(prev));
              next[editingRow.catIdx].rows[editingRow.rowIdx] = updatedRow;
              // Räkna om delsumma
              next[editingRow.catIdx].subtotal = next[editingRow.catIdx].rows
                .reduce((s: number, r: any) => s + (r.total || 0), 0);
              return next;
            });
            setAllEdits(updatedEdits);
            setEditingRow(null);
          }}
          onClose={() => setEditingRow(null)}
        />
      )}

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
