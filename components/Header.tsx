"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useTeam } from "@/lib/useTeam";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

export default function Header({ reportCount }: { reportCount?: number } = {}) {

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "flex-end",
      padding: "0 0 16px", gap: 12,
    }}>
      <div ref={dropRef} style={{ position: "relative" }}>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 12px", borderRadius: 8,
          border: "0.5px solid rgba(255,255,255,0.06)",
          background: "transparent", color: "#a0a0b8", fontSize: 12,
          cursor: "pointer", fontFamily: "inherit",
        }}>
          <span style={{ color: "#f0f0f8", fontWeight: 500 }}>{company?.name || "Mitt bolag"}</span>
          <div style={{
            width: 26, height: 26, borderRadius: "50%",
            background: "rgba(108,99,255,0.12)", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 600, color: "#9b94ff",
          }}>{initials(me?.full_name || "?")}</div>
        </button>

        {menuOpen && (
          <div style={{
            position: "absolute", top: "100%", right: 0, marginTop: 6, zIndex: 50,
            background: "#12121c", border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: 6, minWidth: 180,
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}>
            <div style={{ padding: "8px 12px", fontSize: 11, color: "#55556a", borderBottom: "0.5px solid rgba(255,255,255,0.04)", marginBottom: 4 }}>
              {me?.full_name || "Anvandare"}
            </div>
            <button onClick={signOut} style={{
              width: "100%", padding: "8px 12px", border: "none",
              background: "transparent", color: "#a0a0b8", fontSize: 12,
              cursor: "pointer", textAlign: "left", borderRadius: 6,
              fontFamily: "inherit",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
            >Logga ut</button>
          </div>
        )}
      </div>
    </div>
  );
}
