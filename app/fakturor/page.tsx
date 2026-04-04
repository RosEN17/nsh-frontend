"use client";

import { useState, useRef, useEffect } from "react";
import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { getReportItems } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { useTeam } from "@/lib/useTeam";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE?.trim() || "";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n/1_000_000).toFixed(1)} MSEK`;
  if (abs >= 1_000)     return `${Math.round(n/1_000)} tkr`;
  return `${Math.round(n)} kr`;
}
function timeAgo(ts: string) {
  const d = Math.floor((Date.now()-new Date(ts).getTime())/1000);
  if (d<60) return "Just nu";
  if (d<3600) return `${Math.floor(d/60)}m sedan`;
  if (d<86400) return `${Math.floor(d/3600)}h sedan`;
  return new Date(ts).toLocaleDateString("sv-SE");
}
function initials(n: string) {
  return (n||"?").split(" ").map(x=>x[0]).join("").toUpperCase().slice(0,2);
}
function Spinner() {
  return <span style={{display:"inline-block",width:13,height:13,flexShrink:0,
    border:"2px solid rgba(255,255,255,0.25)",borderTopColor:"#fff",
    borderRadius:"50%",animation:"nsSpin .7s linear infinite"}}/>;
}

type Analysis = {
  supplier:string; invoice_number:string; invoice_date:string; due_date:string;
  total_amount:number|null; vat_amount:number|null; net_amount:number|null;
  currency:string; line_items:{description:string;amount:number;quantity?:number}[];
  ai_summary:string; anomalies:string[]; category:string; confidence:number;
};
type LocalInv = {
  id:string; file:File; status:"analyzing"|"done"|"error";
  analysis:Analysis|null; error:string|null; source:"upload"; created_at:string;
};
type InboundInv = {
  id:string; from_email:string; subject:string; filename:string;
  analysis:Analysis|null; status:"new"|"handled"; source:"inbound"; created_at:string;
};
type AnyInv = LocalInv | InboundInv;

// ── Send to colleague modal ───────────────────────────────────────
function SendModal({inv,members,me,onClose}:{inv:AnyInv;members:any[];me:any;onClose:()=>void}) {
  const [toId,setToId]=useState("");
  const [note,setNote]=useState("");
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const a=inv.analysis;
  const subj=a?`Faktura från ${a.supplier} — ${fmt(a.total_amount)}`
    :inv.source==="inbound"?(inv as InboundInv).subject:(inv as LocalInv).file.name;

  async function send() {
    if(!toId||!me?.id) return;
    setSending(true);
    await supabase.from("inbox_messages").insert({
      from_id:me.id, to_id:toId,
      subject:`📄 ${subj}`, body:note||null, read:false
    });
    setSending(false); setSent(true);
    setTimeout(()=>onClose(), 1200);
  }

  return (
    <div className="inv-modal-overlay" onClick={onClose}>
      <div className="inv-modal" onClick={e=>e.stopPropagation()}>
        <div className="inv-modal-header">
          <div className="inv-modal-title">Skicka till kollega</div>
          <button className="inv-info-close" onClick={onClose}>✕</button>
        </div>
        <div className="inv-modal-subject">
          <div className="inv-modal-label">Faktura</div>
          <div className="inv-modal-val">{subj}</div>
        </div>
        <div className="inv-modal-field">
          <label className="inv-modal-label">Välj kollega</label>
          {members.filter(m=>m.id!==me?.id).length===0 ? (
            <div style={{fontSize:12,color:"var(--text-faint)"}}>
              Inga kollegor — bjud in via Bolag & Team.
            </div>
          ) : (
            <div className="inv-member-list">
              {members.filter(m=>m.id!==me?.id).map(m=>(
                <button key={m.id} className={`inv-member-opt${toId===m.id?" selected":""}`}
                  onClick={()=>setToId(m.id)}>
                  <div className="inv-member-av">{initials(m.full_name||"?")}</div>
                  <div>
                    <div style={{fontSize:12,color:"var(--text-primary)"}}>{m.full_name}</div>
                    <div style={{fontSize:11,color:"var(--text-faint)"}}>{m.role}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="inv-modal-field">
          <label className="inv-modal-label">Notering (valfritt)</label>
          <textarea className="inv-modal-textarea" rows={3}
            placeholder="Vad behöver kollegan granska?"
            value={note} onChange={e=>setNote(e.target.value)}/>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button className="conn-secondary-btn" onClick={onClose}>Avbryt</button>
          <button className="inv-send-btn" onClick={send} disabled={!toId||sending||sent}>
            {sent?"✓ Skickat!":sending?<><Spinner/>Skickar...</>:"Skicka →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────
function DetailPanel({inv,members,me,onClose,onSend}:{
  inv:AnyInv; members:any[]; me:any; onClose:()=>void; onSend:()=>void;
}) {
  const a=inv.analysis;
  const title=a?.supplier||("file" in inv?(inv as LocalInv).file.name:(inv as InboundInv).filename);
  return (
    <div className="inv-detail-panel">
      <div className="inv-info-header">
        <div>
          {a?.invoice_number&&<div className="inv-info-konto">{a.invoice_number}</div>}
          <div className="inv-info-title">{title}</div>
        </div>
        <button className="inv-info-close" onClick={onClose}>✕</button>
      </div>
      {a&&(
        <>
          <div className="inv-kpi-row">
            {[
              {label:"Leverantör",val:a.supplier||"—"},
              {label:"Fakturadatum",val:a.invoice_date||"—"},
              {label:"Förfaller",val:a.due_date||"—"},
              {label:"Netto",val:fmt(a.net_amount)},
              {label:"Moms",val:fmt(a.vat_amount)},
              {label:"Totalt",val:fmt(a.total_amount)},
              {label:"Kategori",val:a.category||"—"},
              {label:"Valuta",val:a.currency||"SEK"},
            ].map(k=>(
              <div key={k.label} className="inv-kpi">
                <div className="inv-kpi-label">{k.label}</div>
                <div className="inv-kpi-val">{k.val}</div>
              </div>
            ))}
          </div>
          <div className="inv-ai-section">
            <div className="inv-ai-header">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M8 1C8 1,9.5 6.5,15 8C9.5 9.5,8 15,8 15C8 15,6.5 9.5,1 8C6.5 6.5,8 1,8 1Z" fill="#9b94ff"/>
              </svg>
              <span>AI-analys</span>
              <span className="inv-confidence">{Math.round(a.confidence*100)}% säkerhet</span>
            </div>
            <div className="inv-ai-text">{a.ai_summary}</div>
          </div>
          {a.anomalies?.length>0&&(
            <div className="inv-anomalies">
              <div className="inv-anomaly-title">Avvikelser att granska</div>
              {a.anomalies.map((x,i)=>(
                <div key={i} className="inv-anomaly-row">
                  <span className="inv-anomaly-dot"/>{x}
                </div>
              ))}
            </div>
          )}
          {a.line_items?.length>0&&(
            <div className="inv-lines">
              <div className="inv-lines-title">Rader</div>
              <table className="inv-lines-table">
                <thead><tr><th>Beskrivning</th><th>Antal</th><th style={{textAlign:"right"}}>Belopp</th></tr></thead>
                <tbody>
                  {a.line_items.map((item,i)=>(
                    <tr key={i}>
                      <td>{item.description}</td>
                      <td>{item.quantity??"—"}</td>
                      <td style={{textAlign:"right"}}>{fmt(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      <div className="inv-detail-actions">
        <button className="inv-colleague-btn" onClick={onSend}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
            <path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
            <path d="M11 8l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Skicka till kollega
        </button>
        <button className="inv-fortnox-btn inv-fortnox-disabled" disabled
          title="Aktiveras när Fortnox är kopplat">
          <span className="inv-fortnox-logo">F</span>
          Delegera till Fortnox
          <span style={{fontSize:10,marginLeft:4}}>🔒</span>
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function FakturorPage() {
  const reportItems=getReportItems();
  const {me,members,company}=useTeam();
  const inputRef=useRef<HTMLInputElement>(null);
  const [tab,setTab]=useState<"inkorg"|"uppladdade"|"athantera">("inkorg");
  const [dragging,setDragging]=useState(false);
  const [uploads,setUploads]=useState<LocalInv[]>([]);
  const [inbound,setInbound]=useState<InboundInv[]>([]);
  const [error,setError]=useState<string|null>(null);
  const [selected,setSelected]=useState<AnyInv|null>(null);
  const [sendModal,setSendModal]=useState<AnyInv|null>(null);

  // Ladda inkomna fakturor från Supabase
  useEffect(()=>{
    if(!company?.id) return;
    supabase.from("inbound_invoices").select("*")
      .eq("company_id",company.id)
      .order("created_at",{ascending:false})
      .then(({data})=>{
        if(data) setInbound(data.map((d:any)=>({
          id:d.id, from_email:d.from_email, subject:d.subject,
          filename:d.filename, analysis:d.analysis,
          status:d.status, source:"inbound" as const, created_at:d.created_at,
        })));
      }).catch(()=>{});
  },[company?.id]);

  async function analyzeFile(file:File):Promise<Analysis|null> {
    const fd=new FormData(); fd.append("file",file);
    const res=await fetch(`${API_BASE}/api/analyze-invoice`,{method:"POST",body:fd});
    if(!res.ok){const e=await res.json().catch(()=>({})); throw new Error((e as any).detail||"Fel");}
    return res.json();
  }

  async function handleFiles(files:FileList|File[]) {
    setError(null);
    const pdfs=Array.from(files).filter(f=>f.type==="application/pdf"||f.name.toLowerCase().endsWith(".pdf"));
    if(pdfs.length===0){setError("Endast PDF-filer stöds.");return;}
    const newInvs:LocalInv[]=pdfs.map(f=>({
      id:Math.random().toString(36).slice(2), file:f,
      status:"analyzing", analysis:null, error:null,
      source:"upload", created_at:new Date().toISOString(),
    }));
    setUploads(prev=>[...newInvs,...prev]);
    setTab("uppladdade");
    for(const inv of newInvs){
      try {
        const analysis=await analyzeFile(inv.file);
        setUploads(prev=>prev.map(i=>i.id===inv.id?{...i,status:"done",analysis}:i));
      } catch(e:any){
        setUploads(prev=>prev.map(i=>i.id===inv.id?{...i,status:"error",error:e.message}:i));
      }
    }
  }

  const athantera=[
    ...uploads.filter(i=>i.status==="done"&&(i.analysis?.anomalies?.length??0)>0),
    ...inbound.filter(i=>i.status==="new"),
  ];
  const totalAmt=uploads.filter(i=>i.status==="done").reduce((s,i)=>s+(i.analysis?.total_amount??0),0);

  function renderRow(inv:AnyInv) {
    const isLocal=inv.source==="upload";
    const a=inv.analysis;
    const isSel=selected?.id===inv.id;
    const title=a?.supplier||(isLocal?(inv as LocalInv).file.name:(inv as InboundInv).from_email);
    const sub=isLocal
      ?(a?.invoice_date?`${a.invoice_date} · ${a.category||""}`:(inv as LocalInv).file.name)
      :`${(inv as InboundInv).subject} · ${timeAgo(inv.created_at)}`;

    return (
      <div key={inv.id} className={`inv-row${isSel?" inv-row-selected":""}`}>
        <div className="inv-row-top" onClick={()=>setSelected(isSel?null:inv)}>
          <div className="inv-row-left">
            <div className={`inv-pdf-icon${!isLocal?" inv-pdf-icon-mail":""}`}>
              {!isLocal?(
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                  <path d="M2 7h3l1.5 2h3L11 7h3" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                </svg>
              ):(
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M3 2h6l4 4v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                  <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
              )}
            </div>
            <div style={{minWidth:0}}>
              <div className="inv-row-title">{title}</div>
              <div className="inv-row-sub">{sub}</div>
            </div>
          </div>
          <div className="inv-row-right">
            {isLocal&&(inv as LocalInv).status==="analyzing"&&(
              <div className="inv-status-analyzing"><Spinner/>Analyserar...</div>
            )}
            {isLocal&&(inv as LocalInv).status==="error"&&(
              <span className="inv-status-error">Fel</span>
            )}
            {a&&(
              <>
                {(a.anomalies?.length??0)>0&&(
                  <span className="inv-anomaly-badge">{a.anomalies.length} avvikelse{a.anomalies.length>1?"r":""}</span>
                )}
                <span className="inv-total">{fmt(a.total_amount)}</span>
              </>
            )}
            {!isLocal&&(inv as InboundInv).status==="new"&&(
              <span className="inv-new-badge">Ny</span>
            )}
            <button className="inv-expand-btn" onClick={e=>{e.stopPropagation();setSelected(isSel?null:inv);}}>
              {isSel?"Stäng":"Granska"}
            </button>
            <button className="inv-send-icon-btn" title="Skicka till kollega"
              onClick={e=>{e.stopPropagation();setSendModal(inv);}}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                <path d="M1 13c0-2.5 2-4 5-4s5 1.5 5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
                <path d="M11 8l2 2 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        {isSel&&(
          <DetailPanel inv={inv} members={members} me={me}
            onClose={()=>setSelected(null)} onSend={()=>setSendModal(inv)}/>
        )}
      </div>
    );
  }

  const shownList=tab==="inkorg"?inbound:tab==="uppladdade"?uploads:athantera;

  return (
    <ProtectedLayout>
      <style>{`@keyframes nsSpin{to{transform:rotate(360deg)}}`}</style>
      <Header reportCount={reportItems.length}/>
      <div className="ns-page">
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16}}>
          <div>
            <div className="ns-hero-title">Fakturor</div>
            <div className="ns-hero-sub" style={{marginTop:3}}>
              AI granskar och flaggar avvikelser automatiskt
            </div>
          </div>
          <button className="ns-btn-primary" onClick={()=>inputRef.current?.click()}
            style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V8M12 8l-3 3M12 8l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 16v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Ladda upp PDF
          </button>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple
            style={{display:"none"}} onChange={e=>e.target.files&&handleFiles(e.target.files)}/>
        </div>

        {error&&<div className="ns-error-banner"><strong>Fel:</strong> {error}</div>}

        <div className="var-summary-row">
          <div className="var-summary-pill" style={{borderColor:"var(--border)"}}>
            <span className="var-pill-num">{inbound.length}</span>
            <span className="var-pill-label">Inkomna via mail</span>
          </div>
          <div className="var-summary-pill" style={{borderColor:"var(--border)"}}>
            <span className="var-pill-num">{uploads.filter(i=>i.status==="done").length}</span>
            <span className="var-pill-label">Uppladdade</span>
          </div>
          {athantera.length>0&&(
            <div className="var-summary-pill var-pill-neg">
              <span className="var-pill-num">{athantera.length}</span>
              <span className="var-pill-label">Att hantera</span>
            </div>
          )}
          {uploads.some(i=>i.status==="done")&&(
            <div className="var-summary-pill" style={{borderColor:"var(--border)"}}>
              <span className="var-pill-num">{fmt(totalAmt)}</span>
              <span className="var-pill-label">Totalt belopp</span>
            </div>
          )}
        </div>

        <div className="inv-tabs">
          {([
            {key:"inkorg",     label:"Inkorg",      count:inbound.filter(i=>i.status==="new").length},
            {key:"uppladdade", label:"Uppladdade",  count:uploads.length},
            {key:"athantera",  label:"Att hantera", count:athantera.length},
          ] as const).map(t=>(
            <button key={t.key} className={`inv-tab${tab===t.key?" active":""}`}
              onClick={()=>{setTab(t.key);setSelected(null);}}>
              {t.label}
              {t.count>0&&(
                <span className={`inv-tab-count${t.key==="athantera"?" red":""}`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {tab==="uppladdade"&&(
          <div className={`ns-dropzone ns-dropzone-compact${dragging?" dragging":""}`}
            onDragOver={e=>{e.preventDefault();setDragging(true);}}
            onDragLeave={()=>setDragging(false)}
            onDrop={e=>{e.preventDefault();setDragging(false);handleFiles(e.dataTransfer.files);}}
            onClick={()=>inputRef.current?.click()}>
            <div className="ns-dropzone-empty">
              <span className="ns-dropzone-icon" style={{fontSize:18}}>⬆</span>
              <div className="ns-dropzone-label" style={{fontSize:13}}>Dra PDF-fakturor hit</div>
              <div className="ns-dropzone-sub">eller klicka — flera filer stöds</div>
            </div>
          </div>
        )}

        {tab==="inkorg"&&inbound.length===0&&(
          <div className="sb-empty-state">
            <div className="sb-empty-title">Inga inkomna fakturor</div>
            <div className="sb-empty-sub">
              Skicka fakturor till{" "}
              <span style={{color:"var(--accent-text)",fontWeight:500}}>
                fakturor@inbound.nordsheet.com
              </span>
              {" "}så dyker de upp här automatiskt.
            </div>
          </div>
        )}

        {tab==="athantera"&&athantera.length===0&&(
          <div className="sb-empty-state">
            <div className="sb-empty-title">Inga fakturor att hantera</div>
            <div className="sb-empty-sub">AI har inte flaggat några avvikelser.</div>
          </div>
        )}

        {shownList.length>0&&(
          <div className="inv-list">{shownList.map(inv=>renderRow(inv as AnyInv))}</div>
        )}

        {sendModal&&(
          <SendModal inv={sendModal} members={members} me={me} onClose={()=>setSendModal(null)}/>
        )}
      </div>
    </ProtectedLayout>
  );
}
