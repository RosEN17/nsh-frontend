"use client";

import { useState, useEffect } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";

const SETTINGS_KEY = "byggkalk_settings";

interface Settings {
  company_name: string;
  hourly_rate: number;
  margin_pct: number;
  include_rot: boolean;
  org_number: string;
  phone: string;
}

const defaults: Settings = {
  company_name: "",
  hourly_rate: 650,
  margin_pct: 15,
  include_rot: true,
  org_number: "",
  phone: "",
};

function loadSettings(): Settings {
  if (typeof window === "undefined") return defaults;
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") }; }
  catch { return defaults; }
}

export default function SettingsPage() {
  const [s, setS] = useState<Settings>(defaults);
  const [saved, setSaved] = useState(false);

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

  return (
    <ProtectedLayout>
      <Header title="Inställningar" subtitle="Standardvärden för nya kalkyler" />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Företagsuppgifter</div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div>
            <label className="label">Företagsnamn</label>
            <input className="input" value={s.company_name} onChange={(e) => upd("company_name", e.target.value)} placeholder="AB Bygg & Renovering" />
          </div>
          <div>
            <label className="label">Org-nummer</label>
            <input className="input" value={s.org_number} onChange={(e) => upd("org_number", e.target.value)} placeholder="556xxx-xxxx" />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input className="input" value={s.phone} onChange={(e) => upd("phone", e.target.value)} placeholder="070-xxx xx xx" />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Standardvärden för kalkyler</div>
        <div className="grid-3" style={{ gap: 12 }}>
          <div>
            <label className="label">Timpris (kr/h)</label>
            <input className="input" type="number" value={s.hourly_rate} onChange={(e) => upd("hourly_rate", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="label">Påslag (%)</label>
            <input className="input" type="number" value={s.margin_pct} onChange={(e) => upd("margin_pct", parseInt(e.target.value) || 0)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 22 }}>
            <input type="checkbox" checked={s.include_rot} onChange={(e) => upd("include_rot", e.target.checked)} style={{ accentColor: "var(--accent)", width: 16, height: 16 }} />
            <span style={{ fontSize: 13, color: "var(--text-primary)" }}>ROT-avdrag som standard</span>
          </div>
        </div>
      </div>

      <button className="btn btn-primary" onClick={handleSave}>
        {saved ? "✓ Sparat" : "Spara inställningar"}
      </button>
    </ProtectedLayout>
  );
}
