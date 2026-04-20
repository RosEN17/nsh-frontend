"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { createEstimate } from "@/lib/api";
import { saveEstimate, getEstimates } from "@/lib/store";

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
    rowsHTML += `<tr><td colspan="5" style="padding:10px 16px;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0">${cat.name}</td></tr>`;
    for (const row of cat.rows || []) {
      rowsHTML += `<tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#1e293b">${row.description}${row.note ? `<div style="font-size:11px;color:#94a3b8;margin-top:1px">${row.note}</div>` : ""}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#94a3b8;text-align:center">${row.unit}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;color:#334155">${row.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;color:#334155">${fmtKr(row.unit_price)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-weight:600;color:#0f172a">${fmtKr(row.total)}</td>
      </tr>`;
    }
    rowsHTML += `<tr><td colspan="4" style="padding:8px 16px;text-align:right;font-size:12px;font-weight:500;color:#64748b;border-bottom:1.5px solid #e2e8f0">Delsumma</td><td style="padding:8px 16px;text-align:right;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1.5px solid #e2e8f0">${fmtKr(cat.subtotal)}</td></tr>`;
  }

  const logoHTML = settings.logo_base64
    ? `<img src="${settings.logo_base64}" style="max-height:48px;max-width:180px" />`
    : `<div style="font-size:18px;font-weight:700;color:#0f172a">${settings.company_name || "Företagsnamn"}</div>`;

  const companyLines = [settings.address, settings.zip_city].filter(Boolean).join(", ");
  const contactLine = [settings.phone ? `Tel: ${settings.phone}` : "", settings.email, settings.website].filter(Boolean).join(" · ");
  const paymentParts = [settings.bankgiro ? `Bankgiro: ${settings.bankgiro}` : "", settings.plusgiro ? `Plusgiro: ${settings.plusgiro}` : "", settings.f_skatt ? "Godkänd för F-skatt" : ""].filter(Boolean).join("  ·  ");
  const footerParts = [settings.company_name, settings.org_number ? `Org.nr: ${settings.org_number}` : "", settings.f_skatt ? "Godkänd för F-skatt" : "", companyLines, settings.phone, settings.email, settings.website].filter(Boolean).join(" · ");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offert ${quoteNr}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',-apple-system,Arial,sans-serif;color:#1e293b;font-size:13px;line-height:1.6;max-width:780px;margin:0 auto;padding:48px 40px;background:white}
@media print{body{padding:24px 20px;font-size:12px}table{page-break-inside:auto}tr{page-break-inside:avoid}}
table{width:100%;border-collapse:collapse}
</style></head><body>

<table style="margin-bottom:16px"><tr>
<td style="vertical-align:top;width:55%">
  <div style="margin-bottom:6px">${logoHTML}</div>
  <div style="font-size:11px;color:#94a3b8;line-height:1.8">
    ${settings.org_number ? `Org.nr: ${settings.org_number}` : ""}
    ${companyLines ? `<br>${companyLines}` : ""}
    ${contactLine ? `<br>${contactLine}` : ""}
  </div>
</td>
<td style="vertical-align:top;text-align:right">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:#0f172a;margin-bottom:8px">Offert</div>
  <div style="font-size:11px;color:#94a3b8;line-height:1.8">
    Nr: <span style="color:#0f172a;font-weight:600">${quoteNr}</span><br>
    Datum: ${today}<br>
    Giltig t.o.m: ${validUntil}
  </div>
</td>
</tr></table>

<div style="height:1.5px;background:#0f172a;margin:0 0 24px"></div>

<div style="display:flex;gap:20px;margin-bottom:24px">
  ${settings.contact_name ? `<div style="flex:1;padding:14px 16px;background:#f8fafc;border-radius:6px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:5px">Kontaktperson</div>
    <div style="font-size:13px;color:#0f172a;font-weight:500">${settings.contact_name}${settings.contact_title ? ` — ${settings.contact_title}` : ""}</div>
    <div style="font-size:11px;color:#64748b">${[settings.phone, settings.email].filter(Boolean).join(" · ")}</div>
  </div>` : ""}
  <div style="flex:1;padding:14px 16px;border:1px dashed #e2e8f0;border-radius:6px">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:5px">Kund</div>
    <div style="font-size:12px;color:#cbd5e1;line-height:2">________________________________<br>________________________________</div>
  </div>
</div>

<div style="margin-bottom:20px">
  <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px">${result.job_title || "Kalkyl"}</div>
  <div style="font-size:12px;color:#64748b">${result.job_summary || ""}</div>
</div>

<table style="margin-bottom:0">
<thead><tr style="background:#0f172a">
  <th style="padding:9px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:500">Post</th>
  <th style="padding:9px 12px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:500">Enhet</th>
  <th style="padding:9px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:500">Antal</th>
  <th style="padding:9px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:500">À-pris</th>
  <th style="padding:9px 16px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;font-weight:500">Summa</th>
</tr></thead>
<tbody>${rowsHTML}</tbody>
</table>

<div style="padding:24px 0">
  <div style="max-width:280px;margin-left:auto">
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#64748b"><span>Material</span><span style="color:#334155">${fmtKr(t.material_total || 0)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#64748b"><span>Arbete</span><span style="color:#334155">${fmtKr(t.labor_total || 0)}</span></div>
    ${t.equipment_total ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#64748b"><span>Utrustning</span><span style="color:#334155">${fmtKr(t.equipment_total)}</span></div>` : ""}
    ${t.margin_amount ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#64748b"><span>Påslag (${result.meta?.margin_pct || 15}%)</span><span style="color:#334155">${fmtKr(t.margin_amount)}</span></div>` : ""}
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#64748b"><span>Moms 25%</span><span style="color:#334155">${fmtKr(t.vat || 0)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:15px;font-weight:700;color:#0f172a;border-top:1.5px solid #0f172a;margin-top:6px"><span>Totalt inkl. moms</span><span>${fmtKr(t.total_inc_vat || 0)}</span></div>
    ${t.rot_deduction ? `
    <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#16a34a"><span>ROT-avdrag (30% på arbete)</span><span>−${fmtKr(t.rot_deduction)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:15px;font-weight:700;color:#16a34a;border-top:1.5px solid #16a34a;margin-top:4px"><span>Att betala</span><span>${fmtKr(t.customer_pays || t.total_inc_vat || 0)}</span></div>
    ` : ""}
  </div>
</div>

${result.estimated_days ? `<div style="padding:10px 16px;background:#f8fafc;border-radius:6px;font-size:12px;color:#334155;margin-bottom:12px">Uppskattad tidsåtgång: ca ${result.estimated_days} arbetsdagar</div>` : ""}

${(result.warnings || []).length > 0 ? `<div style="padding:10px 16px;background:#fefce8;border-left:3px solid #ca8a04;border-radius:0;font-size:11px;color:#713f12;margin-bottom:12px"><strong>Observera:</strong><ul style="margin:4px 0 0 16px;padding:0">${result.warnings.map((w: string) => `<li>${w}</li>`).join("")}</ul></div>` : ""}

${settings.quote_footer ? `<div style="padding:12px 16px;background:#f8fafc;border-radius:6px;font-size:11px;color:#64748b;line-height:1.7;margin-bottom:24px"><span style="font-weight:600;color:#334155">Villkor:</span> ${settings.quote_footer.replace(/\n/g, "<br>")}</div>` : ""}

<div style="display:flex;gap:40px;margin-bottom:28px">
  <div style="flex:1">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:36px">Leverantör</div>
    <div style="border-top:1px solid #cbd5e1;padding-top:6px;font-size:11px;color:#475569">${settings.contact_name || settings.company_name || "________________________"}${settings.contact_title ? `, ${settings.contact_title}` : ""}</div>
  </div>
  <div style="flex:1">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:36px">Kund (godkännande)</div>
    <div style="border-top:1px solid #cbd5e1;padding-top:6px;font-size:11px;color:#cbd5e1">Namn: __________________ Datum: __________</div>
  </div>
</div>

${paymentParts ? `<div style="text-align:center;font-size:10px;color:#94a3b8;margin-bottom:16px">${paymentParts}</div>` : ""}

<div style="padding:12px 0;border-top:0.5px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8">${footerParts}</div>

</body></html>`;
}

function EstimateInner() {
  const searchParams = useSearchParams();
  const viewId = searchParams.get("view");

  const [step, setStep] = useState<"input" | "loading" | "result">("input");
  const [jobType, setJobType] = useState("");
  const [description, setDescription] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [location, setLocation] = useState("");
  const [hourlyRate, setHourlyRate] = useState("650");
  const [marginPct, setMarginPct] = useState("15");
  const [includeRot, setIncludeRot] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [saved, setSaved] = useState(false);
  const [showSources, setShowSources] = useState(false);

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
      const data = await createEstimate({
        description: description.trim(),
        job_type: jobType || undefined,
        area_sqm: areaSqm ? parseFloat(areaSqm) : undefined,
        location: location || undefined,
        hourly_rate: parseFloat(hourlyRate) || 650,
        margin_pct: parseFloat(marginPct) || 15,
        include_rot: includeRot,
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

  function handleReset() {
    setStep("input"); setResult(null); setDescription(""); setJobType(""); setAreaSqm(""); setSaved(false); setShowSources(false);
    setProjectImages([]); setProjectDocs([]);
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
          <svg width="64" height="64" viewBox="0 0 200 200" fill="none">
            <path d="M100 0C100 0,120 75,125 80C130 85,200 100,200 100C200 100,130 115,125 120C120 125,100 200,100 200C100 200,80 125,75 120C70 115,0 100,0 100C0 100,70 85,75 80C80 75,100 0,100 0Z" fill="white"/>
            <path d="M100 72C100 72,108 90,112 94C116 98,134 100,134 100C134 100,116 102,112 106C108 110,100 128,100 128C100 128,92 110,88 106C84 102,66 100,66 100C66 100,84 98,88 94C92 90,100 72,100 72Z" fill="#f97316"/>
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
