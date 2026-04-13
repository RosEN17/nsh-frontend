"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { useState } from "react";

export default function SettingsPage() {
  const [lang,    setLang]    = useState("sv");
  const [format,  setFormat]  = useState("tkr");
  const [notifs,  setNotifs]  = useState(true);
  const [saved,   setSaved]   = useState(false);

  function save() {
    localStorage.setItem("ns_settings", JSON.stringify({ lang, format, notifs }));
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  }

  return (
    <ProtectedLayout>
      <Header />
      <div className="ns-page" style={{ maxWidth: 520 }}>
        <div className="ns-hero-title">Inställningar</div>
        <div className="ns-hero-sub" style={{ marginTop: 3 }}>Anpassa din upplevelse</div>

        <div className="settings-card">
          <div className="settings-card-title">Språk</div>
          <div className="settings-radio-group">
            {[["sv","Svenska"],["en","English"]].map(([v,l])=>(
              <label key={v} className="settings-radio">
                <input type="radio" name="lang" value={v} checked={lang===v} onChange={()=>setLang(v)}/>
                <span className="settings-radio-dot"/>
                {l}
              </label>
            ))}
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-title">Sifferformat</div>
          <div className="settings-radio-group">
            {[["tkr","tkr (tusen kronor)"],["msek","MSEK (miljoner)"],["sek","SEK (kronor)"]].map(([v,l])=>(
              <label key={v} className="settings-radio">
                <input type="radio" name="format" value={v} checked={format===v} onChange={()=>setFormat(v)}/>
                <span className="settings-radio-dot"/>
                {l}
              </label>
            ))}
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-title">Notiser</div>
          <label className="settings-toggle">
            <input type="checkbox" checked={notifs} onChange={e=>setNotifs(e.target.checked)}/>
            <div className="settings-toggle-track">
              <div className="settings-toggle-thumb"/>
            </div>
            AI Alerts i sidomenyn
          </label>
        </div>

        <button className="settings-save-btn" onClick={save}>
          {saved ? "✓ Sparat" : "Spara inställningar"}
        </button>
      </div>
    </ProtectedLayout>
  );
}
