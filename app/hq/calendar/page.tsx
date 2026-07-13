"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, X, Save, Trash2, Pencil, CalendarDays } from "lucide-react";
import { Toast, useToast } from "@/app/components/hq/Toast";

interface Branch { id: number; name: string }
interface CalEvent {
  id: number; branch_id: number | null; branch_name: string | null;
  title: string; event_type: string; start_date: string; end_date: string | null;
  description: string | null; is_public: number;
}

const EVENT_TYPES = ["운영","마케팅","행사","점검","기타"];
const ET_COLOR: Record<string,string> = {운영:"#3B82F6",마케팅:"#8B5CF6",행사:"#EF3B2D",점검:"#D97706",기타:"#6B7280"};
const BC: Record<string,string> = { 목동점:"#8B5CF6",신정점:"#10B981",개봉점:"#3B82F6",철산점:"#EF3B2D",영등포점:"#F59E0B" };
const CS = { background:"#FFFFFF", border:"1px solid #E5E7EB", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" } as const;

function EventModal({ branches, item, onClose, onSave }: {
  branches:Branch[]; item:Partial<CalEvent>|null; onClose:()=>void; onSave:()=>void;
}) {
  const isEdit=!!item?.id;
  const [f,setF]=useState({
    branch_id:String(item?.branch_id??""), title:item?.title??"",
    event_type:item?.event_type??"운영",
    start_date:item?.start_date?.slice(0,10)??"",
    end_date:item?.end_date?.slice(0,10)??"",
    description:item?.description??"",
    is_public:item?.is_public??1,
  });
  const [saving,setSaving]=useState(false);
  const upd=(k:keyof typeof f)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setF(p=>({...p,[k]:e.target.value}));
  const inp="w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-red-400 transition-colors";
  const ist={borderColor:"#E5E7EB",color:"#111827",background:"#FAFAFA"};
  const lbl="block text-[11px] font-semibold mb-1.5 uppercase tracking-widest";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.3)"}}>
      <div className="w-full max-w-lg rounded-2xl p-6" style={CS}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-[16px] font-black" style={{color:"#111827"}}>{isEdit?"일정 수정":"일정 추가"}</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} color="#6B7280"/></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={lbl} style={{color:"#9CA3AF"}}>지점</label>
            <select className={inp} style={ist} value={f.branch_id} onChange={upd("branch_id")}>
              <option value="">공통/전체</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>유형</label>
            <select className={inp} style={ist} value={f.event_type} onChange={upd("event_type")}>
              {EVENT_TYPES.map(t=><option key={t}>{t}</option>)}
            </select></div>
          <div className="sm:col-span-2"><label className={lbl} style={{color:"#9CA3AF"}}>제목 *</label>
            <input className={inp} style={ist} value={f.title} onChange={upd("title")} placeholder="일정 제목"/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>시작일 *</label>
            <input type="date" className={inp} style={ist} value={f.start_date} onChange={upd("start_date")}/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>종료일</label>
            <input type="date" className={inp} style={ist} value={f.end_date} onChange={upd("end_date")}/></div>
          <div className="sm:col-span-2"><label className={lbl} style={{color:"#9CA3AF"}}>설명</label>
            <textarea className={inp} style={ist} rows={3} value={f.description} onChange={upd("description")} placeholder="일정 설명..."/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>공개</label>
            <select className={inp} style={ist} value={String(f.is_public)} onChange={e=>setF(p=>({...p,is_public:Number(e.target.value)}))}>
              <option value="1">공개</option><option value="0">내부</option>
            </select></div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[13px] font-semibold" style={{background:"#F3F4F6",color:"#6B7280"}}>취소</button>
          <button disabled={saving} onClick={async()=>{
            if(!f.title.trim()||!f.start_date){alert("제목과 시작일은 필수입니다.");return;}
            setSaving(true);
            const body={...f,branch_id:f.branch_id?Number(f.branch_id):null};
            try{
              if(isEdit) await fetch(`/api/hq/calendar-events/${item!.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
              else await fetch("/api/hq/calendar-events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
              onSave();onClose();
            }finally{setSaving(false);}
          }} className="flex items-center gap-2 rounded-xl px-5 py-2 text-[13px] font-bold disabled:opacity-50"
            style={{background:"#EF3B2D",color:"#FFF"}}>
            <Save size={14}/>{saving?"저장 중...":"저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [events,setEvents]=useState<CalEvent[]>([]);
  const [branches,setBranches]=useState<Branch[]>([]);
  const [loading,setLoading]=useState(true);
  const [typeFilter,setTypeFilter]=useState("전체");
  const [branchFilter,setBranchFilter]=useState("전체");
  const [modal,setModal]=useState<{open:boolean;item:Partial<CalEvent>|null}>({open:false,item:null});
  const {toast,notify}=useToast();

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [er,br]=await Promise.all([
        fetch("/api/hq/calendar-events").then(r=>r.json()),
        fetch("/api/hq/branches").then(r=>r.json()),
      ]);
      setEvents(er.data??[]);setBranches(br.data??[]);
    }catch(e){console.error(e);notify("불러오기 실패",false);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  const del=async(e:CalEvent)=>{
    if(!confirm(`"${e.title}"을 삭제하시겠습니까?`))return;
    const j=await fetch(`/api/hq/calendar-events/${e.id}`,{method:"DELETE"}).then(r=>r.json());
    if(j.success){notify("삭제됐습니다.");load();}else notify("삭제 실패",false);
  };

  const now=new Date();
  const upcoming=events.filter(e=>new Date(e.start_date)>=now);
  const past=events.filter(e=>new Date(e.start_date)<now);

  const filtered=events
    .filter(e=>typeFilter==="전체"||e.event_type===typeFilter)
    .filter(e=>branchFilter==="전체"||(e.branch_name===branchFilter)||(!e.branch_name&&branchFilter==="공통"));

  const sorted=[...filtered].sort((a,b)=>new Date(a.start_date).getTime()-new Date(b.start_date).getTime());

  return (
    <div className="max-w-[1360px] mx-auto space-y-6">
      <Toast toast={toast}/>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-black tracking-tight" style={{color:"#111827"}}>일정 관리</h1>
          <p className="mt-0.5 text-[13px]" style={{color:"#6B7280"}}>지점별 행사, 점검, 마케팅 일정을 관리합니다.</p>
        </div>
        <button onClick={()=>setModal({open:true,item:null})}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold shrink-0"
          style={{background:"#EF3B2D",color:"#FFF"}}><Plus size={15}/> 일정 추가</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[{label:"전체 일정",value:events.length},{label:"예정",value:upcoming.length},{label:"지난 일정",value:past.length}].map(s=>(
          <div key={s.label} className="rounded-2xl border px-5 py-4 hover:shadow-md transition-all" style={CS}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{color:"#9CA3AF"}}>{s.label}</p>
            <div className="flex items-end gap-1">
              <span className="text-[28px] font-black leading-none" style={{color:"#111827"}}>{s.value}</span>
              <span className="text-[12px] font-semibold mb-0.5" style={{color:"#6B7280"}}>개</span>
            </div>
            <div className="mt-3 h-[2px] w-6 rounded-full" style={{background:"#EF3B2D"}}/>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {["전체",...EVENT_TYPES].map(t=>(
          <button key={t} onClick={()=>setTypeFilter(t)}
            className="rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
            style={{background:typeFilter===t?"#EF3B2D":"#F3F4F6",color:typeFilter===t?"#FFF":"#6B7280"}}>{t}</button>
        ))}
        <div className="w-px mx-1" style={{background:"#E5E7EB"}}/>
        {["전체","공통",...branches.map(b=>b.name)].map(b=>(
          <button key={b} onClick={()=>setBranchFilter(b)}
            className="rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
            style={{background:branchFilter===b?"#111827":"#F3F4F6",color:branchFilter===b?"#FFF":"#6B7280"}}>{b}</button>
        ))}
      </div>

      {loading?(
        <div className="flex items-center justify-center py-20"><p className="text-[13px]" style={{color:"#9CA3AF"}}>불러오는 중…</p></div>
      ):sorted.length===0?(
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <CalendarDays size={36} color="#E5E7EB"/><p className="text-[13px]" style={{color:"#9CA3AF"}}>등록된 일정이 없습니다.</p>
        </div>
      ):(
        <div className="space-y-2">
          {sorted.map(e=>{
            const tc=ET_COLOR[e.event_type]??"#6B7280";
            const bc=e.branch_name?(BC[e.branch_name]??"#6B7280"):"#9CA3AF";
            const isPast=new Date(e.start_date)<now;
            return (
              <div key={e.id} className="rounded-2xl px-5 py-4 flex items-start gap-4 hover:shadow-sm transition-all"
                style={{...CS,opacity:isPast?0.7:1}}>
                <div className="shrink-0 w-12 text-center">
                  <p className="text-[10px] font-bold" style={{color:tc}}>{e.start_date.slice(5,7)}월</p>
                  <p className="text-[22px] font-black leading-tight" style={{color:"#111827"}}>{e.start_date.slice(8,10)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold" style={{color:"#111827"}}>{e.title}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold rounded-md px-2 py-0.5" style={{background:`${tc}14`,color:tc}}>{e.event_type}</span>
                    {e.branch_name&&<span className="text-[10px] font-semibold rounded-md px-2 py-0.5" style={{background:`${bc}14`,color:bc}}>📍{e.branch_name}</span>}
                    {!e.branch_name&&<span className="text-[10px] rounded-md px-2 py-0.5" style={{background:"#F3F4F6",color:"#9CA3AF"}}>전체 지점</span>}
                    {e.end_date&&<span className="text-[10px]" style={{color:"#9CA3AF"}}>~ {e.end_date.slice(0,10)}</span>}
                    <span className="text-[10px] rounded-md px-2 py-0.5" style={{background:e.is_public?"#F0FDF4":"#F3F4F6",color:e.is_public?"#059669":"#9CA3AF"}}>{e.is_public?"공개":"내부"}</span>
                  </div>
                  {e.description&&<p className="text-[12px] mt-2 leading-relaxed" style={{color:"#6B7280"}}>{e.description}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={()=>setModal({open:true,item:e})} className="p-1.5 rounded-lg hover:bg-gray-100" style={{color:"#9CA3AF"}}><Pencil size={13}/></button>
                  <button onClick={()=>del(e)} className="p-1.5 rounded-lg" style={{color:"#EF3B2D",background:"#FEF2F2"}}><Trash2 size={13}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal.open&&<EventModal branches={branches} item={modal.item} onClose={()=>setModal({open:false,item:null})} onSave={()=>{load();notify("저장됐습니다.");}}/>}
    </div>
  );
}
