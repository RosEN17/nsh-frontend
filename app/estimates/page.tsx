"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getUserQuotes, QuoteRecord } from "@/lib/quotes";
import { getEstimates, deleteEstimate, renameEstimate, SavedEstimate } from "@/lib/store";

function fmtKr(n: number): string {
  return new Intl.NumberFormat("sv-SE", { style: "decimal", maximumFractionDigits: 0 }).format(n) + " kr";
}

type Tab = "draft" | "sent" | "accepted";

export default function EstimatesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("draft");
  const [drafts, setDrafts] = useState<SavedEstimate[]>([]);
  const [sentQuotes, setSentQuotes] = useState<QuoteRecord[]>([]);
  const [acceptedQuotes, setAcceptedQuotes] = useState<QuoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    // Hämta utkast från localStorage
    setDrafts(getEstimates());

    // Hämta skickade/godkända från Supabase
    getUserQuotes().then((quotes) => {
      setSentQuotes(quotes.filter((q) => q.status === "sent"));
      setAcceptedQuotes(quotes.filter((q) => q.status === "accepted"));
      setLoading(false);
    });
  }, []);

  function handleDelete(id: string, name: string) {
    if (!confirm(`Ta bort "${name}"?`)) return;
    deleteEstimate(id);
    setDrafts(getEstimates());
  }

  function handleView(est: SavedEstimate) {
    router.push("/estimate?view=" + est.id);
  }

  function startRename(est: SavedEstimate) {
    setEditingId(est.id);
    setEditName(est.description);
  }

  function saveRename(id: string) {
    if (editName.trim()) {
      renameEstimate(id, editName.trim());
      setDrafts(getEstimates());
    }
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === "Enter") saveRename(id);
    if (e.key === "Escape") setEditingId(null);
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "draft", label: "Utkast", count: drafts.length },
    { id: "sent", label: "Skickade", count: sentQuotes.length },
    { id: "accepted", label: "Godkända", count: acceptedQuotes.length },
  ];

  const currentList = tab === "draft" ? drafts : tab === "sent" ? sentQuotes : acceptedQuotes;

  function statusBadge(status: string) {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      draft: { bg: "rgba(148,163,184,0.15)", color: "#94a3b8", label: "Utkast" },
      sent: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", label: "Skickad" },
      accepted: { bg: "rgba(34,197,94,0.15)", color: "#22c55e", label: "Godkänd" },
    };
    const s = styles[status] || styles.draft;
    return (
      <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
        {s.label}
      </span>
    );
  }

  return (
    <ProtectedLayout>
      <Header title="Mina offerter" subtitle="Hantera utkast, skickade och godkända offerter" />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg-surface)", padding: 4, borderRadius: "var(--radius)" }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: "calc(var(--radius) - 2px)",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: tab === t.id ? 600 : 400,
              background: tab === t.id ? "var(--bg-elevated)" : "transparent",
              color: tab === t.id ? "var(--text-primary)" : "var(--text-muted)",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {t.label}
            <span style={{
              fontSize: 11,
              padding: "1px 7px",
              borderRadius: 10,
              background: tab === t.id ? "var(--accent-soft)" : "rgba(148,163,184,0.1)",
              color: tab === t.id ? "var(--accent-text)" : "var(--text-faint)",
              fontWeight: 600,
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && tab !== "draft" ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          Laddar offerter...
        </div>
      ) : currentList.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">{tab === "draft" ? "📝" : tab === "sent" ? "📤" : "✅"}</div>
            <div className="empty-title">
              {tab === "draft" && "Inga utkast"}
              {tab === "sent" && "Inga skickade offerter"}
              {tab === "accepted" && "Inga godkända offerter"}
            </div>
            <div className="empty-desc">
              {tab === "draft" && "Kalkyler du sparar som utkast visas här."}
              {tab === "sent" && "Offerter du skickat till kunder visas här."}
              {tab === "accepted" && "Offerter som kunder godkänt visas här."}
            </div>
            <button className="btn btn-primary" onClick={() => router.push("/estimate")}>
              Skapa ny kalkyl
            </button>
          </div>
        </div>
      ) : (
        <div>
          {tab === "draft" && drafts.map((est) => (
            <div key={est.id} className="est-list-item" style={{ position: "relative" }}>
              <div className="est-list-icon" onClick={() => handleView(est)} style={{ cursor: "pointer" }}>📐</div>
              <div className="est-list-info" style={{ flex: 1, minWidth: 0 }}>
                {editingId === est.id ? (
                  <input
                    className="input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => saveRename(est.id)}
                    onKeyDown={(e) => handleKeyDown(e, est.id)}
                    autoFocus
                    style={{ padding: "4px 8px", fontSize: 14, fontWeight: 600 }}
                  />
                ) : (
                  <div className="est-list-title" onClick={() => handleView(est)} style={{ cursor: "pointer" }}>
                    {est.description}
                  </div>
                )}
                <div className="est-list-meta">
                  {new Date(est.created).toLocaleDateString("sv-SE")}
                  {est.job_type && ` · ${est.job_type}`}
                </div>
              </div>
              <div style={{ marginRight: 8 }}>{statusBadge("draft")}</div>
              <div className="est-list-amount" style={{ marginRight: 8 }}>{fmtKr(est.customer_pays)}</div>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => startRename(est)} title="Döp om" style={{ color: "var(--text-faint)", fontSize: 14, padding: "6px 8px" }}>✏️</button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(est.id, est.description)} title="Ta bort" style={{ color: "var(--text-faint)", fontSize: 14, padding: "6px 8px" }}>🗑️</button>
              </div>
            </div>
          ))}

          {tab === "sent" && sentQuotes.map((q) => (
            <div key={q.id} className="est-list-item">
              <div className="est-list-icon">📤</div>
              <div className="est-list-info" style={{ flex: 1, minWidth: 0 }}>
                <div className="est-list-title">{q.title}</div>
                <div className="est-list-meta">
                  {new Date(q.created_at).toLocaleDateString("sv-SE")}
                  {q.customer_name && ` · ${q.customer_name}`}
                  {q.customer_email && ` · ${q.customer_email}`}
                </div>
              </div>
              <div style={{ marginRight: 8 }}>{statusBadge("sent")}</div>
              <div className="est-list-amount">{fmtKr(q.customer_pays || q.total_inc_vat || 0)}</div>
            </div>
          ))}

          {tab === "accepted" && acceptedQuotes.map((q) => (
            <div key={q.id} className="est-list-item">
              <div className="est-list-icon">✅</div>
              <div className="est-list-info" style={{ flex: 1, minWidth: 0 }}>
                <div className="est-list-title">{q.title}</div>
                <div className="est-list-meta">
                  {q.accepted_at && `Godkänd ${new Date(q.accepted_at).toLocaleDateString("sv-SE")}`}
                  {q.customer_name && ` · ${q.customer_name}`}
                  {q.customer_email && ` · ${q.customer_email}`}
                </div>
              </div>
              <div style={{ marginRight: 8 }}>{statusBadge("accepted")}</div>
              <div className="est-list-amount">{fmtKr(q.customer_pays || q.total_inc_vat || 0)}</div>
            </div>
          ))}
        </div>
      )}
    </ProtectedLayout>
  );
}
