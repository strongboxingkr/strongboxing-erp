"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, X, Save, Trash2, Pencil, CheckCircle2, Circle } from "lucide-react";
import { Toast, useToast } from "@/app/components/hq/Toast";

interface Branch { id: number; name: string }
interface Task {
  id: number; branch_id: number | null; branch_name: string | null;
  title: string; assignee: string | null; due_date: string | null;
  priority: string; category: string; is_done: number; done_at: string | null; memo: string | null;
}

const PRIORITIES = ["높음","보통","낮음"];
const CATEGORIES = ["운영","청소","시설","마케팅","기타"];
const PRI_COLOR: Record<string,{bg:string;color:string}> = {
  높음:{bg:"#FEF2F2",color:"#EF3B2D"},
  보통:{bg:"#FFFBEB",color:"#D97706"},
  낮음:{bg:"#F0FDF4",color:"#059669"},
};
const BC: Record<string,string> = { 목동점:"#8B5CF6",신정점:"#10B981",개봉점:"#3B82F6",철산점:"#EF3B2D",영등포점:"#F59E0B" };
const CS = { background:"#FFFFFF", border:"1px solid #E5E7EB", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" } as const;

function TaskModal({ branches, item, onClose, onSave }: {
  branches:Branch[]; item:Partial<Task>|null; onClose:()=>void; onSave:()=>void;
}) {
  const isEdit=!!item?.id;
  const [f,setF]=useState({
    branch_id:String(item?.branch_id??""), title:item?.title??"",
    assignee:item?.assignee??"", due_date:item?.due_date?.slice(0,10)??"",
    priority:item?.priority??"보통", category:item?.category??"운영", memo:item?.memo??"",
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
          <p className="text-[16px] font-black" style={{color:"#111827"}}>{isEdit?"업무 수정":"업무 추가"}</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} color="#6B7280"/></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={lbl} style={{color:"#9CA3AF"}}>지점</label>
            <select className={inp} style={ist} value={f.branch_id} onChange={upd("branch_id")}>
              <option value="">공통</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>카테고리</label>
            <select className={inp} style={ist} value={f.category} onChange={upd("category")}>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select></div>
          <div className="sm:col-span-2"><label className={lbl} style={{color:"#9CA3AF"}}>업무명 *</label>
            <input className={inp} style={ist} value={f.title} onChange={upd("title")} placeholder="업무 제목"/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>담당자</label>
            <input className={inp} style={ist} value={f.assignee} onChange={upd("assignee")} placeholder="이름"/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>마감일</label>
            <input type="date" className={inp} style={ist} value={f.due_date} onChange={upd("due_date")}/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>우선순위</label>
            <select className={inp} style={ist} value={f.priority} onChange={upd("priority")}>
              {PRIORITIES.map(p=><option key={p}>{p}</option>)}
            </select></div>
          <div className="sm:col-span-2"><label className={lbl} style={{color:"#9CA3AF"}}>메모</label>
            <textarea className={inp} style={ist} rows={3} value={f.memo} onChange={upd("memo")} placeholder="내부 메모..."/></div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[13px] font-semibold" style={{background:"#F3F4F6",color:"#6B7280"}}>취소</button>
          <button disabled={saving} onClick={async()=>{
            if(!f.title.trim()){alert("업무명은 필수입니다.");return;}
            setSaving(true);
            const body={...f,branch_id:f.branch_id?Number(f.branch_id):null};
            try{
              if(isEdit) await fetch(`/api/hq/staff-tasks/${item!.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
              else await fetch("/api/hq/staff-tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
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

export default function StaffPage() {
  const [tasks,setTasks]=useState<Task[]>([]);
  const [branches,setBranches]=useState<Branch[]>([]);
  const [loading,setLoading]=useState(true);
  const [catFilter,setCatFilter]=useState("전체");
  const [branchFilter,setBranchFilter]=useState("전체");
  const [showDone,setShowDone]=useState(false);
  const [modal,setModal]=useState<{open:boolean;item:Partial<Task>|null}>({open:false,item:null});
  const {toast,notify}=useToast();

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [tr,br]=await Promise.all([
        fetch("/api/hq/staff-tasks").then(r=>r.json()),
        fetch("/api/hq/branches").then(r=>r.json()),
      ]);
      setTasks(tr.data??[]);setBranches(br.data??[]);
    }catch(e){console.error(e);notify("불러오기 실패",false);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  const toggle=async(t:Task)=>{
    const newDone=!t.is_done;
    setTasks(p=>p.map(x=>x.id===t.id?{...x,is_done:newDone?1:0}:x));
    await fetch(`/api/hq/staff-tasks/${t.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({is_done:newDone})});
  };

  const del=async(t:Task)=>{
    if(!confirm(`"${t.title}"을 삭제하시겠습니까?`))return;
    const j=await fetch(`/api/hq/staff-tasks/${t.id}`,{method:"DELETE"}).then(r=>r.json());
    if(j.success){notify("삭제됐습니다.");load();}else notify("삭제 실패",false);
  };

  const filtered=tasks
    .filter(t=>catFilter==="전체"||t.category===catFilter)
    .filter(t=>branchFilter==="전체"||(t.branch_name===branchFilter))
    .filter(t=>showDone?true:!t.is_done);

  const todo=tasks.filter(t=>!t.is_done).length;
  const done=tasks.filter(t=>t.is_done).length;
  const overdue=tasks.filter(t=>!t.is_done&&t.due_date&&new Date(t.due_date)<new Date()).length;

  return (
    <div className="max-w-[1360px] mx-auto space-y-6">
      <Toast toast={toast}/>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-black tracking-tight" style={{color:"#111827"}}>직원 업무</h1>
          <p className="mt-0.5 text-[13px]" style={{color:"#6B7280"}}>지점별 업무 현황을 관리합니다.</p>
        </div>
        <button onClick={()=>setModal({open:true,item:null})}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold shrink-0"
          style={{background:"#EF3B2D",color:"#FFF"}}><Plus size={15}/> 업무 추가</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[{label:"미완료",value:todo,color:"#EF3B2D"},{label:"완료",value:done,color:"#059669"},{label:"기한초과",value:overdue,color:"#D97706"}].map(s=>(
          <div key={s.label} className="rounded-2xl border px-5 py-4 hover:shadow-md transition-all" style={CS}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{color:"#9CA3AF"}}>{s.label}</p>
            <div className="flex items-end gap-1">
              <span className="text-[28px] font-black leading-none" style={{color:s.color}}>{s.value}</span>
              <span className="text-[12px] font-semibold mb-0.5" style={{color:"#6B7280"}}>개</span>
            </div>
            <div className="mt-3 h-[2px] w-6 rounded-full" style={{background:s.color}}/>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {["전체",...CATEGORIES].map(c=>(
          <button key={c} onClick={()=>setCatFilter(c)}
            className="rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
            style={{background:catFilter===c?"#EF3B2D":"#F3F4F6",color:catFilter===c?"#FFF":"#6B7280"}}>{c}</button>
        ))}
        <div className="w-px mx-1" style={{background:"#E5E7EB"}}/>
        {["전체",...branches.map(b=>b.name)].map(b=>(
          <button key={b} onClick={()=>setBranchFilter(b)}
            className="rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
            style={{background:branchFilter===b?"#111827":"#F3F4F6",color:branchFilter===b?"#FFF":"#6B7280"}}>{b}</button>
        ))}
        <div className="w-px mx-1" style={{background:"#E5E7EB"}}/>
        <button onClick={()=>setShowDone(p=>!p)}
          className="rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
          style={{background:showDone?"#111827":"#F3F4F6",color:showDone?"#FFF":"#6B7280"}}>완료 포함</button>
      </div>

      {loading?(
        <div className="flex items-center justify-center py-20"><p className="text-[13px]" style={{color:"#9CA3AF"}}>불러오는 중…</p></div>
      ):filtered.length===0?(
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-3xl">✅</p><p className="text-[13px]" style={{color:"#9CA3AF"}}>업무가 없습니다.</p>
        </div>
      ):(
        <div className="space-y-2">
          {filtered.map(t=>{
            const pc=PRI_COLOR[t.priority]??{bg:"#F3F4F6",color:"#6B7280"};
            const bc=t.branch_name?(BC[t.branch_name]??"#6B7280"):"#9CA3AF";
            const isOverdue=!t.is_done&&t.due_date&&new Date(t.due_date)<new Date();
            return (
              <div key={t.id} className="rounded-2xl px-4 py-3.5 flex items-center gap-3 hover:shadow-sm transition-all"
                style={{...CS,opacity:t.is_done?0.6:1}}>
                <button onClick={()=>toggle(t)} className="shrink-0">
                  {t.is_done
                    ?<CheckCircle2 size={20} color="#059669" fill="#059669"/>
                    :<Circle size={20} color="#D1D5DB"/>}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{color:"#111827",textDecoration:t.is_done?"line-through":"none"}}>{t.title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-semibold rounded-md px-2 py-0.5" style={{background:pc.bg,color:pc.color}}>{t.priority}</span>
                    {t.branch_name&&<span className="text-[10px] font-semibold rounded-md px-2 py-0.5" style={{background:`${bc}14`,color:bc}}>📍{t.branch_name}</span>}
                    <span className="text-[10px] rounded-md px-2 py-0.5" style={{background:"#F3F4F6",color:"#6B7280"}}>{t.category}</span>
                    {t.assignee&&<span className="text-[10px]" style={{color:"#9CA3AF"}}>👤{t.assignee}</span>}
                    {t.due_date&&<span className="text-[10px]" style={{color:isOverdue?"#EF3B2D":"#9CA3AF"}}>
                      📅{t.due_date.slice(0,10)}{isOverdue?" (기한초과)":""}
                    </span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={()=>setModal({open:true,item:t})} className="p-1.5 rounded-lg hover:bg-gray-100" style={{color:"#9CA3AF"}}><Pencil size={13}/></button>
                  <button onClick={()=>del(t)} className="p-1.5 rounded-lg" style={{color:"#EF3B2D",background:"#FEF2F2"}}><Trash2 size={13}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal.open&&<TaskModal branches={branches} item={modal.item} onClose={()=>setModal({open:false,item:null})} onSave={()=>{load();notify("저장됐습니다.");}}/>}
    </div>
  );
}
