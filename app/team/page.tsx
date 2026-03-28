"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTeam } from "@/lib/useTeam";

function initials(n: string) {
  return (n||"?").split(" ").map(x=>x[0]).join("").toUpperCase().slice(0,2);
}

export default function TeamPage() {
  const { me, members, company } = useTeam();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting,    setInviting]    = useState(false);
  const [inviteMsg,   setInviteMsg]   = useState("");

  async function inviteMember() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail);
    if (error) {
      setInviteMsg(`Fel: ${error.message}`);
    } else {
      setInviteMsg(`Inbjudan skickad till ${inviteEmail}`);
      setInviteEmail("");
    }
    setInviting(false);
  }

  return (
    <ProtectedLayout>
      <Header reportCount={0} />
      <div className="ns-page" style={{ maxWidth: 640 }}>
        <div className="ns-hero-title">Bolag & Team</div>
        <div className="ns-hero-sub" style={{ marginTop: 3 }}>{company?.name||"—"}</div>

        <div className="settings-card">
          <div className="settings-card-title">Teammedlemmar</div>
          <div className="team-member-list">
            {members.map(m => (
              <div key={m.id} className="team-member-row">
                <div className="hdr-member-avatar">{initials(m.full_name||"?")}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                    {m.full_name||"Okänt namn"}
                    {m.id === me?.id && <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: 6 }}>(du)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{m.role||"—"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-card-title">Bjud in kollega</div>
          <div className="settings-sub">En inbjudan skickas till deras e-post.</div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input className="settings-input" style={{ flex: 1 }}
              type="email" placeholder="kollega@foretag.se"
              value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/>
            <button className="settings-save-btn" style={{ margin: 0, whiteSpace: "nowrap" }}
              onClick={inviteMember} disabled={inviting}>
              {inviting ? "Skickar..." : "Bjud in"}
            </button>
          </div>
          {inviteMsg && (
            <div style={{ fontSize: 12, marginTop: 8,
              color: inviteMsg.startsWith("Fel") ? "var(--red)" : "var(--green)" }}>
              {inviteMsg}
            </div>
          )}
        </div>
      </div>
    </ProtectedLayout>
  );
}
