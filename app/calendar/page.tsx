"use client";

import ProtectedLayout from "@/components/ProtectedLayout";
import Header from "@/components/Header";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTeam } from "@/lib/useTeam";

type CalItem = {
  id: string; variance_label: string; variance_konto: string;
  variance_impact: number | null; follow_up_date: string;
  note: string | null; status: string;
};

function fmt(n: number|null) {
  if (!n) return "—";
  const abs = Math.abs(n);
  if (abs>=1_000_000) return `${(n/1_000_000).toFixed(1)} MSEK`;
  if (abs>=1_000) return `${Math.round(n/1_000)} tkr`;
  return `${Math.round(n)}`;
}

const MONTHS = ["Januari","Februari","Mars","April","Maj","Juni","Juli","Augusti","September","Oktober","November","December"];
const DAYS   = ["Mån","Tis","Ons","Tor","Fre","Lör","Sön"];

export default function CalendarPage() {
  const { company } = useTeam();
  const [items,   setItems]   = useState<CalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting,setDeleting]= useState<string|null>(null);

  const now       = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  useEffect(() => {
    if (!company?.id) return;
    supabase.from("calendar_items").select("*")
      .eq("company_id", company.id)
      .order("follow_up_date", { ascending: true })
      .then(({ data }) => { setItems(data||[]); setLoading(false); });
  }, [company?.id]);

  async function deleteItem(id: string) {
    setDeleting(id);
    await supabase.from("calendar_items").delete().eq("id", id);
    setItems(prev => prev.filter(i => i.id !== id));
    setDeleting(null);
  }

  async function markDone(id: string) {
    await supabase.from("calendar_items").update({ status: "Klar" }).eq("id", id);
    setItems(prev => prev.map(i => i.id===id ? {...i, status:"Klar"} : i));
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  const startDow = (firstDay.getDay()+6)%7; // Mon=0
  const daysInMonth = lastDay.getDate();

  const cells: (number|null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({length: daysInMonth}, (_,i)=>i+1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const itemsByDate: Record<string, CalItem[]> = {};
  items.forEach(item => {
    const d = item.follow_up_date;
    if (!itemsByDate[d]) itemsByDate[d] = [];
    itemsByDate[d].push(item);
  });

  const todayStr = now.toISOString().split("T")[0];

  function dateStr(day: number) {
    return `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }

  const upcoming = items.filter(i => i.follow_up_date >= todayStr && i.status !== "Klar")
    .slice(0, 5);

  return (
    <ProtectedLayout>
      <Header reportCount={0} />
      <div className="ns-page">
        <div className="ns-hero-title">Kalender</div>
        <div className="ns-hero-sub" style={{ marginTop: 3 }}>
          Uppföljningar kopplade till avvikelser
        </div>

        <div className="cal-layout">
          {/* Calendar */}
          <div className="cal-main">
            <div className="cal-header">
              <button className="cal-nav-btn" onClick={() => {
                if (month===0) { setMonth(11); setYear(y=>y-1); }
                else setMonth(m=>m-1);
              }}>←</button>
              <div className="cal-month-title">{MONTHS[month]} {year}</div>
              <button className="cal-nav-btn" onClick={() => {
                if (month===11) { setMonth(0); setYear(y=>y+1); }
                else setMonth(m=>m+1);
              }}>→</button>
            </div>

            <div className="cal-grid">
              {DAYS.map(d => <div key={d} className="cal-day-header">{d}</div>)}
              {cells.map((day, i) => {
                if (!day) return <div key={i} className="cal-cell empty"/>;
                const ds    = dateStr(day);
                const dayItems = itemsByDate[ds] || [];
                const isToday  = ds === todayStr;
                return (
                  <div key={i} className={`cal-cell${isToday?" today":""}${dayItems.length?" has-items":""}`}>
                    <div className="cal-day-num">{day}</div>
                    {dayItems.slice(0,2).map(item => (
                      <div key={item.id}
                        className={`cal-event${item.status==="Klar"?" cal-event-done":""}`}
                        title={item.variance_label}>
                        {item.variance_label.slice(0,12)}
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <div className="cal-event-more">+{dayItems.length-2}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming panel */}
          <div className="cal-panel">
            <div className="cal-panel-title">Kommande uppföljningar</div>
            {loading ? (
              <div style={{fontSize:12,color:"var(--text-faint)"}}>Laddar...</div>
            ) : upcoming.length === 0 ? (
              <div className="sb-empty-state" style={{padding:"20px 0"}}>
                <div className="sb-empty-title">Inga uppföljningar</div>
                <div className="sb-empty-sub">Schemalägg från Variances-sidan.</div>
              </div>
            ) : upcoming.map(item => (
              <div key={item.id} className="cal-panel-item">
                <div className="cal-panel-date">
                  {new Date(item.follow_up_date).toLocaleDateString("sv-SE",{day:"numeric",month:"short"})}
                </div>
                <div className="cal-panel-body">
                  <div className="cal-panel-label">{item.variance_label}</div>
                  {item.variance_impact !== null && (
                    <div className={`cal-panel-impact ${item.variance_impact>=0?"impact-pos":"impact-neg"}`}>
                      {fmt(item.variance_impact)}
                    </div>
                  )}
                  {item.note && <div className="cal-panel-note">{item.note}</div>}
                </div>
                <div className="cal-panel-actions">
                  <button className="cal-done-btn" onClick={()=>markDone(item.id)}>✓</button>
                  <button className="cal-del-btn" onClick={()=>deleteItem(item.id)}
                    disabled={deleting===item.id}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
