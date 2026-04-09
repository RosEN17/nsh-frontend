"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getPack, getFileMeta } from "@/lib/store";

export default function FilerPage() {
  const router = useRouter();
  const pack = getPack();
  const fileMeta = getFileMeta();

  // Om ingen data finns — skicka direkt till connect
  useEffect(() => {
    if (!pack && !fileMeta) {
      router.replace("/connect");
    }
  }, [pack, fileMeta, router]);

  return (
    <ProtectedLayout>
      <Header reportCount={0} />
      <div className="ns-page">
        <div className="ns-hero-title">Importerad data</div>
        <div className="ns-hero-sub" style={{ marginTop: 4 }}>
          Hantera din datakälla
        </div>

        {/* ── Current data source ── */}
        <div style={{
          background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
          borderRadius: 10, padding: "18px 22px", marginTop: 20, marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 10 }}>
            Aktiv datakälla
          </div>

          {pack?.source === "fortnox" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: "#0E6B56",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 16, color: "#fff", flexShrink: 0,
              }}>F</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Fortnox</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                  {pack.periods?.length || 0} perioder · {pack.account_rows?.length || 0} konton
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                background: "var(--green-soft)", color: "var(--green)",
                border: "0.5px solid rgba(34,197,94,0.2)",
              }}>● Aktiv</span>
            </div>
          ) : fileMeta ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>📄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{fileMeta.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                  {fileMeta.sizeKb} KB · uppladdad {fileMeta.uploadedAt}
                  {pack && ` · ${pack.periods?.length || 0} perioder`}
                </div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 20,
                background: "var(--green-soft)", color: "var(--green)",
                border: "0.5px solid rgba(34,197,94,0.2)",
              }}>● Aktiv</span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>
              Ingen data importerad
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => router.push("/dashboard")} className="ns-btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            disabled={!pack}>
            Gå till Dashboard →
          </button>

          <button onClick={() => router.push("/connect")} style={{
            height: 36, padding: "0 16px", borderRadius: "var(--radius)",
            border: "0.5px solid var(--border-strong)", background: "transparent",
            color: "var(--text-muted)", fontSize: 12, fontWeight: 500,
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {pack ? "Byt datakälla" : "Importera data"}
          </button>

          {pack && (
            <button onClick={() => router.push("/variances")} style={{
              height: 36, padding: "0 16px", borderRadius: "var(--radius)",
              border: "0.5px solid var(--border-strong)", background: "transparent",
              color: "var(--text-muted)", fontSize: 12, fontWeight: 500,
              cursor: "pointer", fontFamily: "inherit",
            }}>
              Avvikelser →
            </button>
          )}
        </div>

        {/* ── Data summary ── */}
        {pack && (
          <div style={{
            marginTop: 24, padding: "14px 18px", borderRadius: 10,
            background: "var(--bg-elevated)", border: "0.5px solid var(--border)",
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 12 }}>
              Data i minnet
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {[
                { label: "Perioder", value: pack.periods?.length || 0 },
                { label: "Konton", value: pack.account_rows?.length || 0 },
                { label: "Aktuell period", value: pack.current_period || "—" },
                { label: "Detaljrader", value: pack.detailed_rows?.length || 0 },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 3 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {pack.narrative && (
              <div style={{
                marginTop: 14, padding: "8px 12px", borderRadius: 6,
                background: "rgba(108,99,255,0.04)", border: "0.5px solid rgba(108,99,255,0.1)",
                fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5,
              }}>
                {pack.narrative}
              </div>
            )}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
