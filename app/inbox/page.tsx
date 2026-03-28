"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTeam } from "@/lib/useTeam";

type Message = {
  id: string; subject: string; body: string | null;
  read: boolean; created_at: string;
  from_id: string; to_id: string;
};

function timeAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)   return "Just nu";
  if (diff < 3600) return `${Math.floor(diff/60)}m sedan`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h sedan`;
  return new Date(ts).toLocaleDateString("sv-SE");
}

function initials(name: string) {
  return (name||"?").split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2);
}

export default function InboxPage() {
  const { me, members } = useTeam();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<"inbox"|"sent">("inbox");

  useEffect(() => {
    if (!me?.id) return;
    async function load() {
      const col = tab === "inbox" ? "to_id" : "from_id";
      const { data } = await supabase.from("inbox_messages")
        .select("*").eq(col, me!.id)
        .order("created_at", { ascending: false });
      setMessages(data || []);
      setLoading(false);

      if (tab === "inbox") {
        await supabase.from("inbox_messages")
          .update({ read: true }).eq("to_id", me!.id).eq("read", false);
      }
    }
    load();
  }, [me?.id, tab]);

  function getSender(msg: Message) {
    return members.find(m => m.id === (tab === "inbox" ? msg.from_id : msg.to_id));
  }

  return (
    <ProtectedLayout>
      <Header reportCount={0} />
      <div className="ns-page">
        <div className="ns-hero-title">Inkorg</div>
        <div className="ns-hero-sub" style={{ marginTop: 3 }}>Meddelanden från teamet</div>

        <div className="inbox-tabs">
          <button className={`inbox-tab${tab==="inbox"?" active":""}`} onClick={()=>setTab("inbox")}>Inkorg</button>
          <button className={`inbox-tab${tab==="sent"?" active":""}`} onClick={()=>setTab("sent")}>Skickade</button>
        </div>

        {loading ? (
          <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Laddar...</div>
        ) : messages.length === 0 ? (
          <div className="sb-empty-state">
            <div className="sb-empty-title">Inga meddelanden</div>
            <div className="sb-empty-sub">
              {tab === "inbox" ? "Du har inga inkommande meddelanden." : "Du har inte skickat några meddelanden."}
            </div>
          </div>
        ) : (
          <div className="inbox-list">
            {messages.map(msg => {
              const person = getSender(msg);
              return (
                <div key={msg.id} className={`inbox-item${!msg.read && tab==="inbox"?" unread":""}`}>
                  <div className="inbox-avatar">{initials(person?.full_name||"?")}</div>
                  <div className="inbox-body">
                    <div className="inbox-top">
                      <span className="inbox-from">{person?.full_name||"Okänd"}</span>
                      <span className="inbox-time">{timeAgo(msg.created_at)}</span>
                    </div>
                    <div className="inbox-subject">{msg.subject}</div>
                    {msg.body && <div className="inbox-preview">{msg.body}</div>}
                  </div>
                  {!msg.read && tab==="inbox" && <div className="inbox-unread-dot"/>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
