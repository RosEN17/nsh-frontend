"use client";

import { useState, useRef, useEffect } from "react";
import { getPack } from "@/lib/store";
import { apiPost } from "@/lib/api";

type Message = { role: "user" | "ai"; content: string };

const SUGGESTIONS = [
  "Vad låg lokalhyran på i Q4?",
  "Vilka konton avviker mest?",
  "Hur har lönerna utvecklats?",
  "Sammanfatta senaste perioden",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: "Hej! Jag har tillgång till all din bokföringsdata. Ställ en fråga — t.ex. \"vad låg lokalhyran på i Q4?\" eller \"jämför februari med maj förra året\"." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);
  useEffect(() => { if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight; }, [messages]);

  async function send(text?: string) {
    const q = (text || input).trim();
    if (!q || loading) return;
    const pack = getPack();
    if (!pack) {
      setMessages(prev => [...prev, { role: "user", content: q }, { role: "ai", content: "Ingen data laddad. Gå till Data och koppla Fortnox eller ladda upp en fil först." }]);
      setInput(""); return;
    }

    setMessages(prev => [...prev, { role: "user", content: q }]);
    setInput(""); setShowSuggestions(false); setLoading(true);

    try {
      // Send the full pack so the backend has access to all data
      // including detailed_rows, account_rows, period_series etc.
      const res = await apiPost<{ answer: string }>("/api/chat", {
        question: q,
        pack,
      });
      setMessages(prev => [...prev, { role: "ai", content: res.answer }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "ai", content: "Fel: " + e.message }]);
    } finally { setLoading(false); }
  }

  return (
    <>
      {open && (
        <div style={{ position:"fixed",bottom:84,right:24,width:360,background:"#0e0e15",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:14,overflow:"hidden",zIndex:99,boxShadow:"0 12px 48px rgba(0,0,0,0.6)",display:"flex",flexDirection:"column",animation:"chatWidgetIn 0.2s ease" }}>
          <style>{`@keyframes chatWidgetIn{from{opacity:0;transform:translateY(10px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
          <div style={{ padding:"14px 16px",borderBottom:"0.5px solid rgba(255,255,255,0.06)",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div>
              <div style={{ fontSize:13,fontWeight:600,color:"#f0f0f8" }}>Fråga AI om din data</div>
              <div style={{ fontSize:10,color:"#55556a",marginTop:2 }}>All bokföringsdata tillgänglig</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ width:28,height:28,borderRadius:6,border:"none",background:"transparent",color:"#55556a",fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"inherit" }}>✕</button>
          </div>
          <div ref={messagesRef} style={{ flex:1,padding:"14px 16px",overflowY:"auto",maxHeight:340,display:"flex",flexDirection:"column",gap:8 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ padding:"9px 12px",borderRadius:10,fontSize:12,lineHeight:1.6,maxWidth:"85%",wordBreak:"break-word" as const,...(m.role==="user"?{background:"#6c63ff",color:"white",alignSelf:"flex-end" as const,borderBottomRightRadius:4}:{background:"#12121c",color:"#a0a0b8",border:"0.5px solid rgba(255,255,255,0.06)",alignSelf:"flex-start" as const,borderBottomLeftRadius:4}) }}>
                {m.role === "ai" && <span style={{ color:"#9b94ff",marginRight:4 }}>✦</span>}
                {m.content}
              </div>
            ))}
            {loading && <div style={{ padding:"9px 12px",borderRadius:10,fontSize:12,background:"#12121c",border:"0.5px solid rgba(255,255,255,0.06)",alignSelf:"flex-start" as const,color:"#55556a" }}><span style={{ color:"#9b94ff",marginRight:4 }}>✦</span>Tänker...</div>}
          </div>
          {showSuggestions && (
            <div style={{ padding:"0 16px 8px",display:"flex",gap:6,flexWrap:"wrap" }}>
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => send(s)} style={{ padding:"5px 10px",borderRadius:14,fontSize:10,background:"rgba(108,99,255,0.08)",color:"#9b94ff",border:"0.5px solid rgba(108,99,255,0.2)",cursor:"pointer",fontFamily:"inherit" }}>{s}</button>
              ))}
            </div>
          )}
          <div style={{ padding:"10px 14px",borderTop:"0.5px solid rgba(255,255,255,0.06)",display:"flex",gap:8 }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==="Enter") send(); }} placeholder="Ställ en fråga om din data..." style={{ flex:1,padding:"9px 12px",borderRadius:8,border:"0.5px solid rgba(255,255,255,0.1)",background:"#1a1a28",color:"#f0f0f8",fontSize:12,fontFamily:"inherit",outline:"none" }} />
            <button onClick={() => send()} disabled={loading} style={{ width:34,height:34,borderRadius:8,border:"none",background:loading?"#3d3878":"#6c63ff",color:"white",cursor:loading?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinejoin="round" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(!open)} style={{ position:"fixed",bottom:24,right:24,width:48,height:48,borderRadius:"50%",background:open?"#3d3878":"#6c63ff",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:100,boxShadow:open?"none":"0 4px 20px rgba(108,99,255,0.4)",transition:"all 0.2s" }}>
        {open ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>}
      </button>
    </>
  );
}
