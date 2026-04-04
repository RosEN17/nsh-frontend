"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTeam } from "@/lib/useTeam";

type Msg = {
  id:string; subject:string; body:string|null;
  read:boolean; created_at:string; from_id:string; to_id:string;
};

function timeAgo(ts:string) {
  const d=Math.floor((Date.now()-new Date(ts).getTime())/1000);
  if(d<60) return "Just nu";
  if(d<3600) return `${Math.floor(d/60)}m sedan`;
  if(d<86400) return `${Math.floor(d/3600)}h sedan`;
  return new Date(ts).toLocaleDateString("sv-SE");
}
function initials(n:string) {
  return (n||"?").split(" ").map(x=>x[0]).join("").toUpperCase().slice(0,2);
}

export default function InboxPage() {
  const {me,members}=useTeam();
  const [messages,setMessages]=useState<Msg[]>([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState<"inbox"|"sent">("inbox");

  useEffect(()=>{
    if(!me?.id) return;
    setLoading(true);
    const col=tab==="inbox"?"to_id":"from_id";
    supabase.from("inbox_messages").select("*").eq(col,me.id)
      .order("created_at",{ascending:false})
      .then(({data})=>{
        setMessages(data||[]);
        setLoading(false);
        if(tab==="inbox"){
          supabase.from("inbox_messages")
            .update({read:true}).eq("to_id",me.id).eq("read",false);
        }
      }).catch(()=>setLoading(false));
  },[me?.id,tab]);

  function getPerson(msg:Msg) {
    const id=tab==="inbox"?msg.from_id:msg.to_id;
    return members.find(m=>m.id===id);
  }

  const isFaktura=(msg:Msg)=>msg.subject.startsWith("📄");

  return (
    <ProtectedLayout>
      <Header reportCount={0}/>
      <div className="ns-page">
        <div className="ns-hero-title">Inkorg</div>
        <div className="ns-hero-sub" style={{marginTop:3}}>Meddelanden från teamet</div>

        <div className="inbox-tabs">
          <button className={`inbox-tab${tab==="inbox"?" active":""}`} onClick={()=>setTab("inbox")}>
            Inkorg
            {messages.filter(m=>!m.read).length>0&&tab==="inbox"&&(
              <span style={{marginLeft:6,background:"var(--accent)",color:"#fff",
                fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:10}}>
                {messages.filter(m=>!m.read).length}
              </span>
            )}
          </button>
          <button className={`inbox-tab${tab==="sent"?" active":""}`} onClick={()=>setTab("sent")}>
            Skickade
          </button>
        </div>

        {loading?(
          <div style={{fontSize:13,color:"var(--text-faint)"}}>Laddar...</div>
        ):messages.length===0?(
          <div className="sb-empty-state">
            <div className="sb-empty-title">Inga meddelanden</div>
            <div className="sb-empty-sub">
              {tab==="inbox"?"Du har inga inkommande meddelanden.":"Du har inte skickat något."}
            </div>
          </div>
        ):(
          <div className="inbox-list">
            {messages.map(msg=>{
              const person=getPerson(msg);
              const isInvoice=isFaktura(msg);
              return (
                <div key={msg.id} className={`inbox-item${!msg.read&&tab==="inbox"?" unread":""}`}>
                  <div className={`inbox-avatar${isInvoice?" inbox-avatar-inv":""}`}>
                    {isInvoice?"📄":initials(person?.full_name||"?")}
                  </div>
                  <div className="inbox-body">
                    <div className="inbox-top">
                      <span className="inbox-from">
                        {person?.full_name||"Okänd"}
                        {isInvoice&&(
                          <span style={{marginLeft:6,fontSize:10,background:"rgba(108,99,255,0.15)",
                            color:"var(--accent-text)",padding:"1px 6px",borderRadius:4,fontWeight:600}}>
                            Faktura
                          </span>
                        )}
                      </span>
                      <span className="inbox-time">{timeAgo(msg.created_at)}</span>
                    </div>
                    <div className="inbox-subject">{msg.subject}</div>
                    {msg.body&&<div className="inbox-preview">{msg.body}</div>}
                    {isInvoice&&(
                      <a href="/fakturor" className="inbox-invoice-link">
                        Gå till Fakturor →
                      </a>
                    )}
                  </div>
                  {!msg.read&&tab==="inbox"&&<div className="inbox-unread-dot"/>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProtectedLayout>
  );
}
