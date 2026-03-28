"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useTeam } from "@/lib/useTeam";

export default function ProfilePage() {
  const { me, company } = useTeam();
  const [form,    setForm]    = useState({ full_name: "", role: "" });
  const [email,   setEmail]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [pwForm,  setPwForm]  = useState({ current: "", next: "", confirm: "" });
  const [pwMsg,   setPwMsg]   = useState("");

  useEffect(() => {
    if (me) setForm({ full_name: me.full_name||"", role: me.role||"" });
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email||""));
  }, [me]);

  async function saveProfile() {
    if (!me?.id) return;
    setSaving(true);
    await supabase.from("profiles").update(form).eq("id", me.id);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function changePassword() {
    if (pwForm.next !== pwForm.confirm) { setPwMsg("Lösenorden matchar inte."); return; }
    if (pwForm.next.length < 8) { setPwMsg("Minst 8 tecken."); return; }
    const { error } = await supabase.auth.updateUser({ password: pwForm.next });
    setPwMsg(error ? `Fel: ${error.message}` : "Lösenord uppdaterat!");
    if (!error) setPwForm({ current: "", next: "", confirm: "" });
  }

  function initials(n: string) {
    return (n||"?").split(" ").map(x=>x[0]).join("").toUpperCase().slice(0,2);
  }

  return (
    <ProtectedLayout>
      <Header reportCount={0} />
      <div className="ns-page" style={{ maxWidth: 560 }}>
        <div className="ns-hero-title">Min profil</div>
        <div className="ns-hero-sub" style={{ marginTop: 3 }}>{company?.name||"—"}</div>

        {/* Avatar */}
        <div className="profile-avatar-section">
          <div className="profile-avatar">{initials(form.full_name)}</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
              {form.full_name || "Ditt namn"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-faint)", marginTop: 2 }}>
              {form.role || "Din roll"}
            </div>
          </div>
        </div>

        {/* Profile form */}
        <div className="settings-card">
          <div className="settings-card-title">Personuppgifter</div>
          <div className="settings-field">
            <label className="settings-label">Namn</label>
            <input className="settings-input" value={form.full_name}
              onChange={e=>setForm(p=>({...p,full_name:e.target.value}))} placeholder="Ditt fullständiga namn"/>
          </div>
          <div className="settings-field">
            <label className="settings-label">Roll</label>
            <input className="settings-input" value={form.role}
              onChange={e=>setForm(p=>({...p,role:e.target.value}))} placeholder="T.ex. Controller, CFO"/>
          </div>
          <div className="settings-field">
            <label className="settings-label">E-post</label>
            <input className="settings-input" value={email} disabled
              style={{ opacity: .5, cursor: "not-allowed" }}/>
          </div>
          <button className="settings-save-btn" onClick={saveProfile} disabled={saving}>
            {saved ? "✓ Sparat" : saving ? "Sparar..." : "Spara ändringar"}
          </button>
        </div>

        {/* Password */}
        <div className="settings-card">
          <div className="settings-card-title">Byt lösenord</div>
          <div className="settings-field">
            <label className="settings-label">Nytt lösenord</label>
            <input className="settings-input" type="password" value={pwForm.next}
              onChange={e=>setPwForm(p=>({...p,next:e.target.value}))} placeholder="Minst 8 tecken"/>
          </div>
          <div className="settings-field">
            <label className="settings-label">Bekräfta lösenord</label>
            <input className="settings-input" type="password" value={pwForm.confirm}
              onChange={e=>setPwForm(p=>({...p,confirm:e.target.value}))} placeholder="Upprepa lösenordet"/>
          </div>
          {pwMsg && <div style={{fontSize:12,color:pwMsg.startsWith("Fel")||pwMsg.includes("matchar")||pwMsg.includes("Minst")?"var(--red)":"var(--green)",marginBottom:8}}>{pwMsg}</div>}
          <button className="settings-save-btn" onClick={changePassword}>Byt lösenord</button>
        </div>
      </div>
    </ProtectedLayout>
  );
}
