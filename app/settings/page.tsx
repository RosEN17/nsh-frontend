"use client";

import { useState, useEffect, useRef } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";

const SETTINGS_KEY = "byggkalk_settings";

interface Settings {
  company_name: string;
  org_number: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  zip_city: string;
  bankgiro: string;
  plusgiro: string;
  iban: string;
  f_skatt: boolean;
  contact_name: string;
  contact_title: string;
  hourly_rate: number;
  margin_pct: number;
  include_rot: boolean;
  quote_validity_days: number;
  quote_footer: string;
  logo_base64: string;
}

const defaults: Settings = {
  company_name: "",
  org_number: "",
  phone: "",
  email: "",
  website: "",
  address: "",
  zip_city: "",
  bankgiro: "",
  plusgiro: "",
  iban: "",
  f_skatt: true,
  contact_name: "",
  contact_title: "",
  hourly_rate: 650,
  margin_pct: 15,
  include_rot: true,
  quote_validity_days: 30,
  quote_footer: "Betalningsvillkor: 30 dagar netto. Vid försenad betalning debiteras dröjsmålsränta enligt räntelagen.",
  logo_base64: "",
};

function loadSettings(): Settings {
  if (typeof window === "undefined") return defaults;
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") }; }
  catch { return defaults; }
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings>(defaults);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setS(loadSettings()); }, []);

  function handleSave() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function upd(key: keyof Settings, val: any) {
    setS(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500000) { alert("Loggan får vara max 500KB"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      upd("logo_base64", ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    upd("logo_base64", "");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <ProtectedLayout>
      <Header title="Inställningar" subtitle="Företagsuppgifter, logga och standardvärden" />

      {/* Logo */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Företagslogga</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {s.logo_base64 ? (
            <div style={{ position: "relative" }}>
              <img src={s.logo_base64} alt="Logga" style={{ maxHeight: 64, maxWidth: 200, borderRadius: "var(--radius)", border: "0.5px solid var(--border)" }} />
              <button onClick={removeLogo} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "var(--red)", color: "white", border: "none", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          ) : (
            <div style={{ width: 120, height: 64, border: "1px dashed var(--border-strong)", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 11 }}>Ingen logga</div>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogoUpload} style={{ display: "none" }} />
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              {s.logo_base64 ? "Byt logga" : "Ladda upp logga"}
            </button>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>PNG, JPG eller SVG. Max 500KB.</div>
          </div>
        </div>
      </div>

      {/* Company info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Företagsuppgifter</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="grid-2" style={{ gap: 12 }}>
            <div>
              <label className="label">Företagsnamn *</label>
              <input className="input" value={s.company_name} onChange={(e) => upd("company_name", e.target.value)} placeholder="AB Bygg & Renovering" />
            </div>
            <div>
              <label className="label">Org-nummer *</label>
              <input className="input" value={s.org_number} onChange={(e) => upd("org_number", e.target.value)} placeholder="556xxx-xxxx" />
            </div>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div>
              <label className="label">Adress</label>
              <input className="input" value={s.address} onChange={(e) => upd("address", e.target.value)} placeholder="Byggvägen 1" />
            </div>
            <div>
              <label className="label">Postnr & ort</label>
              <input className="input" value={s.zip_city} onChange={(e) => upd("zip_city", e.target.value)} placeholder="123 45 Stockholm" />
            </div>
          </div>
          <div className="grid-3" style={{ gap: 12 }}>
            <div>
              <label className="label">Telefon</label>
              <input className="input" value={s.phone} onChange={(e) => upd("phone", e.target.value)} placeholder="070-xxx xx xx" />
            </div>
            <div>
              <label className="label">E-post</label>
              <input className="input" value={s.email} onChange={(e) => upd("email", e.target.value)} placeholder="info@foretag.se" />
            </div>
            <div>
              <label className="label">Hemsida</label>
              <input className="input" value={s.website} onChange={(e) => upd("website", e.target.value)} placeholder="www.foretag.se" />
            </div>
          </div>
        </div>
      </div>

      {/* Kontaktperson */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Kontaktperson på offert</div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div>
            <label className="label">Namn</label>
            <input className="input" value={s.contact_name} onChange={(e) => upd("contact_name", e.target.value)} placeholder="Anna Andersson" />
          </div>
          <div>
            <label className="label">Titel</label>
            <input className="input" value={s.contact_title} onChange={(e) => upd("contact_title", e.target.value)} placeholder="Projektledare" />
          </div>
        </div>
      </div>

      {/* Betalning */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Betalningsuppgifter</div>
        <div className="grid-3" style={{ gap: 12 }}>
          <div>
            <label className="label">Bankgiro</label>
            <input className="input" value={s.bankgiro} onChange={(e) => upd("bankgiro", e.target.value)} placeholder="xxxx-xxxx" />
          </div>
          <div>
            <label className="label">Plusgiro</label>
            <input className="input" value={s.plusgiro} onChange={(e) => upd("plusgiro", e.target.value)} placeholder="xxxx xx-x" />
          </div>
          <div>
            <label className="label">IBAN</label>
            <input className="input" value={s.iban} onChange={(e) => upd("iban", e.target.value)} placeholder="SE00 0000 0000 0000 0000 0000" />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <input type="checkbox" checked={s.f_skatt} onChange={(e) => upd("f_skatt", e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>Innehar F-skattsedel</span>
        </div>
      </div>

      {/* Kalkyl-defaults */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Standardvärden för kalkyler</div>
        <div className="grid-4" style={{ gap: 12 }}>
          <div>
            <label className="label">Timpris (kr/h)</label>
            <input className="input" type="number" value={s.hourly_rate} onChange={(e) => upd("hourly_rate", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="label">Påslag (%)</label>
            <input className="input" type="number" value={s.margin_pct} onChange={(e) => upd("margin_pct", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="label">Offert giltig (dagar)</label>
            <input className="input" type="number" value={s.quote_validity_days} onChange={(e) => upd("quote_validity_days", parseInt(e.target.value) || 30)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 22 }}>
            <input type="checkbox" checked={s.include_rot} onChange={(e) => upd("include_rot", e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
            <span style={{ fontSize: 13, color: "var(--text-primary)" }}>ROT-avdrag</span>
          </div>
        </div>
      </div>

      {/* Offertvillkor */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Villkor på offert</div>
        <textarea className="input textarea" value={s.quote_footer} onChange={(e) => upd("quote_footer", e.target.value)} rows={3} placeholder="Betalningsvillkor, garantier, etc." />
      </div>

      <div className="info-box" style={{ marginBottom: 16 }}>
        Alla uppgifter visas automatiskt på offerter du laddar ner. Fält markerade med * är obligatoriska för en giltig offert.
      </div>

      <button className="btn btn-primary" onClick={handleSave}>
        {saved ? "✓ Sparat" : "Spara inställningar"}
      </button>
    </ProtectedLayout>
  );
}
