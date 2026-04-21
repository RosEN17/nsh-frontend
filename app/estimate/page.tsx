"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { createEstimate } from "@/lib/api";
import { saveEstimate, getEstimates } from "@/lib/store";
import { saveQuoteToSupabase } from "@/lib/quotes";

const JOB_TYPES = [
  { id: "badrum", label: "Badrum", icon: "🚿" },
  { id: "kok", label: "Kök", icon: "🍳" },
  { id: "tak", label: "Tak", icon: "🏠" },
  { id: "fasad", label: "Fasad", icon: "🧱" },
  { id: "golv", label: "Golv", icon: "🪵" },
  { id: "malning", label: "Målning", icon: "🎨" },
  { id: "el", label: "El", icon: "⚡" },
  { id: "vvs", label: "VVS", icon: "🔧" },
  { id: "tillbyggnad", label: "Tillbyggnad", icon: "🏗️" },
  { id: "ovrigt", label: "Övrigt", icon: "📋" },
];

function fmtKr(n: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "decimal", maximumFractionDigits: 0 }).format(n) + " kr";
}

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return "📄";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (["xls", "xlsx"].includes(ext)) return "📊";
  if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) return "🖼️";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  return "📎";
}

function isImage(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext);
}

function SectionRuler({ label }: { label: string }) {
  return (
    <div className="section-ruler">
      <span className="section-ruler-label">{label}</span>
      <div className="section-ruler-line" />
    </div>
  );
}

interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
}

function UploadPanel({
  images, setImages, docs, setDocs,
}: {
  images: UploadedFile[];
  setImages: (f: UploadedFile[]) => void;
  docs: UploadedFile[];
  setDocs: (f: UploadedFile[]) => void;
}) {
  const [imgDrag, setImgDrag] = useState(false);
  const [docDrag, setDocDrag] = useState(false);

  function handleImgFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).filter(f => isImage(f.name));
    const newItems: UploadedFile[] = arr.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      preview: URL.createObjectURL(f),
    }));
    setImages([...images, ...newItems]);
  }

  function handleDocFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files).filter(f => !isImage(f.name));
    const newItems: UploadedFile[] = arr.map(f => ({
      id: crypto.randomUUID(),
      file: f,
    }));
    setDocs([...docs, ...newItems]);
  }

  function removeImage(id: string) {
    setImages(images.filter(i => i.id !== id));
  }
  function removeDoc(id: string) {
    setDocs(docs.filter(d => d.id !== id));
  }

  return (
    <>
      <SectionRuler label="Projektbilder" />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Ladda upp bilder på projektet</div>
        <div
          className={`upload-zone${imgDrag ? " drag-over" : ""}`}
          onDragOver={e => { e.preventDefault(); setImgDrag(true); }}
          onDragLeave={() => setImgDrag(false)}
          onDrop={e => { e.preventDefault(); setImgDrag(false); handleImgFiles(e.dataTransfer.files); }}
        >
          <input type="file" accept="image/*" multiple onChange={e => handleImgFiles(e.target.files)} />
          <div className="upload-zone-icon">📸</div>
          <div className="upload-zone-title">Dra och släpp bilder här</div>
          <div className="upload-zone-hint">JPG, PNG, WEBP, HEIC — välj flera filer samtidigt</div>
        </div>

        {images.length > 0 && (
          <div className="img-preview-grid">
            {images.map(img => (
              <div key={img.id} className="img-preview-wrap">
                {img.preview && <img src={img.preview} alt={img.file.name} />}
                <button className="img-preview-remove" onClick={() => removeImage(img.id)} title="Ta bort">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <SectionRuler label="Anbudsunderlag & dokument" />
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Ladda upp anbudsunderlag, ritningar eller andra dokument</div>
        <div
          className={`upload-zone${docDrag ? " drag-over" : ""}`}
          onDragOver={e => { e.preventDefault(); setDocDrag(true); }}
          onDragLeave={() => setDocDrag(false)}
          onDrop={e => { e.preventDefault(); setDocDrag(false); handleDocFiles(e.dataTransfer.files); }}
        >
          <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.dwg,.txt,.csv" multiple onChange={e => handleDocFiles(e.target.files)} />
          <div className="upload-zone-icon">📂</div>
          <div className="upload-zone-title">Dra och släpp dokument här</div>
          <div className="upload-zone-hint">PDF, Word, Excel, ZIP, DWG — max 20 MB per fil</div>
        </div>

        {docs.length > 0 && (
          <div className="file-list">
            {docs.map(doc => (
              <div key={doc.id} className="file-item">
                <span className="file-item-icon">{getFileIcon(doc.file.name)}</span>
                <div className="file-item-info">
                  <div className="file-item-name">{doc.file.name}</div>
                  <div className="file-item-meta">{fmtFileSize(doc.file.size)}</div>
                </div>
                <button className="file-item-remove" onClick={() => removeDoc(doc.id)} title="Ta bort">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M2 2l10 10M12 2L2 12" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
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

  const companyInfo = [
    settings.address,
    settings.zip_city,
    settings.phone ? `Tel: ${settings.phone}` : "",
    settings.email,
    settings.website,
  ].filter(Boolean).join(" · ");

  const paymentInfo = [
    settings.bankgiro ? `Bankgiro: ${settings.bankgiro}` : "",
    settings.plusgiro ? `Plusgiro: ${settings.plusgiro}` : "",
    settings.iban ? `IBAN: ${settings.iban}` : "",
    settings.f_skatt ? "Godkänd för F-skatt" : "",
  ].filter(Boolean).join(" · ");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offert ${quoteNr}</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#222;font-size:13px;line-height:1.5}
@media print{body{padding:20px;font-size:11px} .no-print{display:none!important}}
table{width:100%;border-collapse:collapse}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #fa832d">
  <div>
    ${logoHTML}
    ${settings.logo_base64 && settings.company_name ? `<div style="font-size:10px;color:#888;margin-top:4px">${settings.company_name}</div>` : ""}
    <div style="font-size:10px;color:#aaa;margin-top:2px">${settings.org_number ? `Org.nr: ${settings.org_number}` : ""}</div>
    <div style="font-size:10px;color:#aaa">${companyInfo}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:22px;font-weight:800;color:#fa832d;letter-spacing:1px">OFFERT</div>
    <div style="font-size:11px;color:#888;margin-top:6px">
      <div>Offertnummer: <strong>${quoteNr}</strong></div>
      <div>Datum: ${today}</div>
      <div>Giltig t.o.m: ${validUntil}</div>
    </div>
  </div>
</div>
${settings.contact_name ? `
<div style="margin-bottom:20px;padding:12px 16px;background:#f9f9f9;border-radius:6px;font-size:12px">
  <strong>Er kontaktperson:</strong> ${settings.contact_name}${settings.contact_title ? ` — ${settings.contact_title}` : ""}
  ${settings.phone ? ` · ${settings.phone}` : ""}${settings.email ? ` · ${settings.email}` : ""}
</div>` : ""}
<div style="margin-bottom:20px;padding:12px 16px;border:1px dashed #ddd;border-radius:6px;font-size:12px;color:#999">
  <strong style="color:#666">Kund:</strong><br>
  ____________________________________<br>
  ____________________________________<br>
  ____________________________________
</div>
<div style="margin-bottom:20px">
  <div style="font-size:16px;font-weight:700;margin-bottom:4px">${result.job_title || "Kalkyl"}</div>
  <div style="font-size:12px;color:#666">${result.job_summary || ""}</div>
</div>
<table style="margin-bottom:20px">
<thead><tr style="background:#1a1a1a;color:white">
  <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px">Post</th>
  <th style="padding:8px 12px;text-align:center;font-size:10px;text-transform:uppercase">Enhet</th>
  <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase">Antal</th>
  <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase">À-pris</th>
  <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase">Summa</th>
</tr></thead>
<tbody>${rowsHTML}</tbody>
</table>
<div style="max-width:350px;margin-left:auto;margin-bottom:24px">
  <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666"><span>Material</span><span style="font-family:'Courier New',monospace">${fmtKr(t.material_total || 0)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666"><span>Arbete</span><span style="font-family:'Courier New',monospace">${fmtKr(t.labor_total || 0)}</span></div>
  ${t.equipment_total ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666"><span>Utrustning</span><span style="font-family:'Courier New',monospace">${fmtKr(t.equipment_total)}</span></div>` : ""}
  ${t.margin_amount ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666"><span>Påslag (${result.meta?.margin_pct || 15}%)</span><span style="font-family:'Courier New',monospace">${fmtKr(t.margin_amount)}</span></div>` : ""}
  <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666"><span>Summa exkl. moms</span><span style="font-family:'Courier New',monospace">${fmtKr(t.total_ex_vat || 0)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#666"><span>Moms 25%</span><span style="font-family:'Courier New',monospace">${fmtKr(t.vat || 0)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:17px;font-weight:800;border-top:2px solid #1a1a1a;margin-top:6px"><span>Totalt inkl. moms</span><span style="font-family:'Courier New',monospace">${fmtKr(t.total_inc_vat || 0)}</span></div>
  ${t.rot_deduction ? `
  <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#16a34a"><span>ROT-avdrag (30% på arbete)</span><span style="font-family:'Courier New',monospace">−${fmtKr(t.rot_deduction)}</span></div>
  <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:17px;font-weight:800;color:#16a34a;border-top:2px solid #16a34a;margin-top:4px"><span>Att betala</span><span style="font-family:'Courier New',monospace">${fmtKr(t.customer_pays || t.total_inc_vat || 0)}</span></div>
  ` : ""}
</div>
${result.estimated_days ? `<div style="padding:10px 16px;background:#f0f9ff;border-left:3px solid #3b82f6;font-size:12px;color:#1e40af;margin-bottom:12px">Uppskattad tidsåtgång: ca ${result.estimated_days} arbetsdagar</div>` : ""}
${(result.warnings || []).length > 0 ? `<div style="padding:10px 16px;background:#fff7ed;border-left:3px solid #fa832d;font-size:11px;color:#9a3412;margin-bottom:12px"><strong>Observera:</strong><ul style="margin:4px 0 0 16px;padding:0">${result.warnings.map((w: string) => `<li>${w}</li>`).join("")}</ul></div>` : ""}
${settings.quote_footer ? `
<div style="margin-top:20px;padding:14px 16px;background:#f9f9f9;border-radius:6px;font-size:11px;color:#666">
  <strong style="color:#444">Villkor:</strong><br>
  ${settings.quote_footer.replace(/\n/g, "<br>")}
</div>` : ""}
${paymentInfo ? `<div style="margin-top:12px;font-size:10px;color:#aaa;text-align:center">${paymentInfo}</div>` : ""}
<div style="margin-top:40px;display:flex;justify-content:space-between">
  <div style="width:45%">
    <div style="font-size:11px;color:#888;margin-bottom:40px">Leverantör</div>
    <div style="border-top:1px solid #ccc;padding-top:6px;font-size:11px;color:#666">
      ${settings.contact_name || settings.company_name || "________________________"}
      ${settings.contact_title ? `<br>${settings.contact_title}` : ""}
    </div>
  </div>
  <div style="width:45%">
    <div style="font-size:11px;color:#888;margin-bottom:40px">Kund (godkännande)</div>
    <div style="border-top:1px solid #ccc;padding-top:6px;font-size:11px;color:#666">
      Namn: ________________________<br>
      Datum: ________________________
    </div>
  </div>
</div>
<div style="margin-top:30px;padding-top:12px;border-top:1px solid #eee;text-align:center;font-size:9px;color:#bbb">
  ${settings.company_name || ""}${settings.org_number ? ` · Org.nr: ${settings.org_number}` : ""}${settings.f_skatt ? " · Godkänd för F-skatt" : ""}
  ${settings.address ? `<br>${settings.address}${settings.zip_city ? `, ${settings.zip_city}` : ""}` : ""}
  ${settings.phone ? ` · ${settings.phone}` : ""}${settings.email ? ` · ${settings.email}` : ""}${settings.website ? ` · ${settings.website}` : ""}
</div>
</body></html>`;
}

function EstimateInner() {
  const searchParams = useSearchParams();
  const viewId = searchParams.get("view");

  const [step, setStep] = useState<"input" | "loading" | "result">("input");
  const [jobType, setJobType] = useState("");
  const [description, setDescription] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [ceilingHeight, setCeilingHeight] = useState("");
  const [buildYear, setBuildYear] = useState("");
  const [numRooms, setNumRooms] = useState("");
  const [floors, setFloors] = useState("");
  const [extraParams, setExtraParams] = useState("");
  const [location, setLocation] = useState("");
  const [hourlyRate, setHourlyRate] = useState("650");
  const [marginPct, setMarginPct] = useState("15");
  const [includeRot, setIncludeRot] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [saved, setSaved] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [showMailModal, setShowMailModal] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [projectImages, setProjectImages] = useState<UploadedFile[]>([]);
  const [projectDocs, setProjectDocs] = useState<UploadedFile[]>([]);

  useEffect(() => {
    if (viewId) {
      const estimates = getEstimates();
      const found = estimates.find(e => e.id === viewId);
      if (found) {
        setResult(found.data);
        setDescription(found.description);
        setJobType(found.job_type || "");
        setSaved(true);
        setStep("result");
      }
    }
  }, [viewId]);

  useEffect(() => {
    const s = getSettings();
    if (s.hourly_rate) setHourlyRate(String(s.hourly_rate));
    if (s.margin_pct !== undefined) setMarginPct(String(s.margin_pct));
    if (s.include_rot !== undefined) setIncludeRot(s.include_rot);
  }, []);

  const loadingMessages = [
    "Analyserar jobbeskrivningen...",
    "Beräknar materialåtgång...",
    "Hämtar aktuella priser...",
    "Bygger din kalkyl...",
  ];

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
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
    try {
      // Konvertera bilder till base64
      const imageData: { name: string; data: string }[] = [];
      for (const img of projectImages) {
        const b64 = await fileToBase64(img.file);
        imageData.push({ name: img.file.name, data: b64 });
      }

      // Konvertera dokument till base64 (bara text-baserade)
      const docData: { name: string; data: string }[] = [];
      for (const doc of projectDocs) {
        if (doc.file.size < 5 * 1024 * 1024) { // Max 5MB
          const b64 = await fileToBase64(doc.file);
          docData.push({ name: doc.file.name, data: b64 });
        }
      }

      // Bygg ihop byggparametrar
      const buildParams: Record<string, string> = {};
      if (ceilingHeight) buildParams.ceiling_height = ceilingHeight + " m";
      if (buildYear) buildParams.build_year = buildYear;
      if (numRooms) buildParams.num_rooms = numRooms;
      if (floors) buildParams.floors = floors;
      if (extraParams) buildParams.extra = extraParams;

      const data = await createEstimate({
        description: description.trim(),
        job_type: jobType || undefined,
        area_sqm: areaSqm ? parseFloat(areaSqm) : undefined,
        location: location || undefined,
        hourly_rate: parseFloat(hourlyRate) || 650,
        margin_pct: parseFloat(marginPct) || 15,
        include_rot: includeRot,
        build_params: Object.keys(buildParams).length > 0 ? buildParams : undefined,
        images: imageData.length > 0 ? imageData : undefined,
        documents: docData.length > 0 ? docData : undefined,
      });
      clearInterval(interval); setResult(data); setStep("result");
    } catch (e: any) {
      clearInterval(interval); setError(e.message || "Något gick fel."); setStep("input");
    }
  }

  function handleSave() {
    if (!result) return;
    saveEstimate({
      id: crypto.randomUUID(),
      created: new Date().toISOString(),
      description: result.job_title || description,
      job_type: jobType,
      total_inc_vat: result.totals?.total_inc_vat || 0,
      customer_pays: result.totals?.customer_pays || result.totals?.total_inc_vat || 0,
      data: result,
    });
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

  async function handleMailCustomer() {
    if (!result) return;
    if (!customerEmail.trim()) { alert("Fyll i kundens e-postadress."); return; }
    const settings = getSettings();
    if (!settings.company_name) { alert("Fyll i företagsuppgifter under Inställningar först."); return; }

    setSending(true);
    const t = result.totals || {};

    // Spara offert i Supabase
    const { id, error } = await saveQuoteToSupabase(
      result.job_title || description,
      result.job_summary || description,
      customerName,
      customerEmail,
      t.total_inc_vat || 0,
      t.customer_pays || t.total_inc_vat || 0,
      result,
      settings
    );

    if (error || !id) {
      alert("Kunde inte spara offert: " + (error || "Okänt fel"));
      setSending(false);
      return;
    }

    // Skapa acceptera-länk
    const acceptUrl = `${window.location.origin}/accept?id=${id}`;
    const companyName = settings.company_name || "Vi";
    const totalText = fmtKr(t.customer_pays || t.total_inc_vat || 0);

    // Öppna mailto med offertinfo
    const subject = encodeURIComponent(`Offert: ${result.job_title || "Kalkyl"} — ${companyName}`);
    const body = encodeURIComponent(
      `Hej ${customerName || ""}!\n\n` +
      `Tack för din förfrågan. Här kommer vår offert för ${result.job_title || "arbetet"}.\n\n` +
      `Sammanfattning:\n` +
      `${result.job_summary || ""}\n\n` +
      `Totalt: ${fmtKr(t.total_inc_vat || 0)}\n` +
      (t.rot_deduction ? `ROT-avdrag: -${fmtKr(t.rot_deduction)}\nAtt betala: ${totalText}\n\n` : `\n`) +
      `Klicka här för att se hela offerten och godkänna:\n${acceptUrl}\n\n` +
      `Offerten är giltig i ${settings.quote_validity_days || 30} dagar.\n\n` +
      `Med vänliga hälsningar\n${settings.contact_name || companyName}\n` +
      (settings.phone ? `Tel: ${settings.phone}\n` : "") +
      (settings.email ? `${settings.email}\n` : "")
    );

    window.open(`mailto:${customerEmail}?subject=${subject}&body=${body}`, "_self");

    setSending(false);
    setSent(true);
    setShowMailModal(false);
  }

  function handleReset() {
    setStep("input"); setResult(null); setDescription(""); setJobType(""); setAreaSqm(""); setSaved(false); setShowSources(false);
    setProjectImages([]); setProjectDocs([]); setCeilingHeight(""); setBuildYear(""); setNumRooms(""); setFloors(""); setExtraParams("");
    window.history.replaceState(null, "", "/estimate");
  }

  function getSourceLabel(row: any): string {
    if (row.type === "labor") return "Ditt timpris (" + (result?.meta?.hourly_rate || 650) + " kr/h)";
    if (row.type === "equipment") return "Uppskattat hyrespris";
    return "Uppskattat marknadspris (2025–2026)";
  }

  if (step === "input") {
    return (
      <ProtectedLayout>
        <Header title="Ny kalkyl" subtitle="Beskriv jobbet — AI:n räknar ut resten" />

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Jobbtyp (valfritt)</div>
          <div className="job-types">
            {JOB_TYPES.map((jt) => (
              <button key={jt.id} className={`job-type-btn${jobType === jt.id ? " active" : ""}`} onClick={() => setJobType(jobType === jt.id ? "" : jt.id)}>
                <span className="icon">{jt.icon}</span>
                <span className="name">{jt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <SectionRuler label="Jobbeskrivning" />
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Beskriv jobbet</div>
          <textarea
            className="input textarea"
            placeholder="T.ex: Badrumsrenovering 8 kvm. Riva befintligt kakel golv och väggar. Nytt tätskikt, klinker på golv (60x60), kakel på väggar (30x60). Ny dusch med glasvägg, ny toalett och handfat."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
          />
          {error && <div className="login-error" style={{ marginTop: 10 }}>{error}</div>}
        </div>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="card card-sm">
            <label className="label">Yta (kvm)</label>
            <input className="input" type="number" placeholder="T.ex. 8" value={areaSqm} onChange={(e) => setAreaSqm(e.target.value)} />
          </div>
          <div className="card card-sm">
            <label className="label">Plats</label>
            <input className="input" placeholder="Stad eller postnr" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </div>

        <SectionRuler label="Byggparametrar (valfritt)" />
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <div className="card card-sm">
            <label className="label">Takhöjd (m)</label>
            <input className="input" type="number" step="0.1" placeholder="2.5" value={ceilingHeight} onChange={(e) => setCeilingHeight(e.target.value)} />
          </div>
          <div className="card card-sm">
            <label className="label">Byggår</label>
            <input className="input" type="number" placeholder="1975" value={buildYear} onChange={(e) => setBuildYear(e.target.value)} />
          </div>
          <div className="card card-sm">
            <label className="label">Antal rum</label>
            <input className="input" type="number" placeholder="1" value={numRooms} onChange={(e) => setNumRooms(e.target.value)} />
          </div>
          <div className="card card-sm">
            <label className="label">Våningar</label>
            <input className="input" type="number" placeholder="1" value={floors} onChange={(e) => setFloors(e.target.value)} />
          </div>
        </div>
        <div className="card card-sm" style={{ marginBottom: 16 }}>
          <label className="label">Övriga detaljer</label>
          <textarea className="input textarea" rows={2} placeholder="T.ex: Befintlig golvvärme, bärande vägg, asbest misstänks, vattenburen värme..." value={extraParams} onChange={(e) => setExtraParams(e.target.value)} />
        </div>

        <SectionRuler label="Kalkylparametrar" />
        <div className="grid-3" style={{ marginBottom: 20 }}>
          <div className="card card-sm">
            <label className="label">Timpris (kr/h)</label>
            <input className="input" type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
          </div>
          <div className="card card-sm">
            <label className="label">Påslag (%)</label>
            <input className="input" type="number" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
          </div>
          <div className="card card-sm" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={includeRot} onChange={(e) => setIncludeRot(e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>ROT-avdrag</div>
              <div style={{ fontSize: 11, color: "var(--text-faint)" }}>30% på arbete</div>
            </div>
          </div>
        </div>

        <UploadPanel images={projectImages} setImages={setProjectImages} docs={projectDocs} setDocs={setProjectDocs} />

        <SectionRuler label="Generera" />
        <button className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 4 }} onClick={handleGenerate}>
          Generera kalkyl med AI
        </button>

        {(projectImages.length > 0 || projectDocs.length > 0) && (
          <div className="info-box" style={{ marginTop: 12 }}>
            {projectImages.length > 0 && `${projectImages.length} bild${projectImages.length > 1 ? "er" : ""} bifogad${projectImages.length > 1 ? "e" : ""}`}
            {projectImages.length > 0 && projectDocs.length > 0 && " · "}
            {projectDocs.length > 0 && `${projectDocs.length} dokument bifogad${projectDocs.length > 1 ? "e" : ""}`}
            {" "}— filer sparas lokalt med kalkylen
          </div>
        )}
      </ProtectedLayout>
    );
  }

  if (step === "loading") {
    return (
      <ProtectedLayout>
        <div className="loading-overlay">
          <svg width="64" height="64" viewBox="0 0 220 240" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 110 10 Q 114 95, 118 115 Q 135 119, 210 122 Q 135 125, 118 129 Q 114 149, 110 234 Q 106 149, 102 129 Q 85 125, 10 122 Q 85 119, 102 115 Q 106 95, 110 10 Z" fill="#ffffff"/>
            <path d="M 110 108 Q 112 118, 114 120 Q 120 121, 130 122 Q 120 123, 114 124 Q 112 126, 110 136 Q 108 126, 106 124 Q 100 123, 90 122 Q 100 121, 106 120 Q 108 118, 110 108 Z" fill="#fa832d"/>
          </svg>
          <div className="loading-text">{loadingMsg}</div>
          <div className="loading-bar"><div className="loading-bar-fill" /></div>
        </div>
      </ProtectedLayout>
    );
  }

  if (!result) return null;
  const t = result.totals || {};

  return (
    <ProtectedLayout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div className="page-title">{result.job_title || "Kalkyl"}</div>
          <div className="page-subtitle">{result.job_summary || description}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>Ny kalkyl</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSources(!showSources)}>
            {showSources ? "Dölj källor" : "Visa priskällor"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleDownloadQuote}>📄 Ladda ner offert</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowMailModal(true)} style={{ background: "var(--accent-soft)", color: "var(--accent-text)", borderColor: "var(--accent-border)" }}>
            {sent ? "✓ Skickad" : "✉ Maila kund"}
          </button>
          <button className={`btn btn-sm ${saved ? "btn-secondary" : "btn-primary"}`} onClick={handleSave} disabled={saved}>
            {saved ? "✓ Sparad" : "Spara"}
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
        {(t.equipment_total || 0) > 0 && (
          <div className="est-total-row"><span className="label-text">Utrustning</span><span className="value">{fmtKr(t.equipment_total)}</span></div>
        )}
        <div className="est-total-row"><span className="label-text">Delsumma</span><span className="value">{fmtKr(t.subtotal || 0)}</span></div>
        {(t.margin_amount || 0) > 0 && (
          <div className="est-total-row"><span className="label-text">Påslag ({result.meta?.margin_pct || 15}%)</span><span className="value">{fmtKr(t.margin_amount)}</span></div>
        )}
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

      {result.estimated_days && (
        <div className="info-box" style={{ marginTop: 16 }}>
          Uppskattad tidsåtgång: ca {result.estimated_days} arbetsdagar
        </div>
      )}
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
      {/* Mail modal */}
      {showMailModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-elevated)", border: "0.5px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "28px 32px", width: 420, maxWidth: "90vw" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Skicka offert till kund</div>
              <button onClick={() => setShowMailModal(false)} style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Kundens namn</label>
              <input className="input" placeholder="Anna Andersson" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="label">Kundens e-post *</label>
              <input className="input" type="email" placeholder="kund@email.se" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </div>
            <div style={{ padding: "12px 16px", background: "var(--bg-surface)", borderRadius: "var(--radius)", fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
              Kunden får ett mail med en sammanfattning och en länk för att granska och godkänna offerten. När kunden godkänner skapas ett projekt automatiskt.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowMailModal(false)}>Avbryt</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleMailCustomer} disabled={sending || !customerEmail.trim()}>
                {sending ? "Förbereder..." : "Öppna mail"}
              </button>
            </div>
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
