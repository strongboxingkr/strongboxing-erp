"use client";
import { useEffect, useState, useCallback } from "react";
import { Star, Copy, Check, Pencil, Trash2, Plus, X, Save } from "lucide-react";
import { Toast, useToast } from "@/app/components/hq/Toast";

interface Branch { id: number; name: string }
interface Template {
  id: number; branch_id: number | null; branch_name: string | null;
  title: string; category: string; content: string;
  favorite_count: number; copy_count: number;
}

const CATS = ["전체","회비","원데이","준비물","PT","기타"];
const CS = { background:"#FFFFFF", border:"1px solid #E5E7EB", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" } as const;
const BC: Record<string,string> = { 목동점:"#8B5CF6",신정점:"#10B981",개봉점:"#3B82F6",철산점:"#EF3B2D",영등포점:"#F59E0B" };

function CopyBtn({ text, id }: { text:string; id:number }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(()=>setCopied(false),1200);
      fetch(`/api/hq/consultation-templates/${id}/copy`,{method:"POST"});
    }} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all"
      style={{ background:copied?"rgba(16,185,129,0.1)":"#F3F4F6", color:copied?"#059669":"#6B7280" }}>
      {copied?<Check size={12}/>:<Copy size={12}/>} {copied?"복사됨":"복사"}
    </button>
  );
}

function TplModal({ branches, item, onClose, onSave }: {
  branches:Branch[]; item:Partial<Template>|null; onClose:()=>void; onSave:()=>void;
}) {
  const isEdit=!!item?.id;
  const [f,setF]=useState({ branch_id:String(item?.branch_id??""), title:item?.title??"", category:item?.category??"회비", content:item?.content??"" });
  const [saving,setSaving]=useState(false);
  const upd=(k:keyof typeof f)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setF(p=>({...p,[k]:e.target.value}));
  const inp="w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-red-400 transition-colors";
  const ist={ borderColor:"#E5E7EB",color:"#111827",background:"#FAFAFA" };
  const lbl="block text-[11px] font-semibold mb-1.5 uppercase tracking-widest";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.3)"}}>
      <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={CS}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-[16px] font-black" style={{color:"#111827"}}>{isEdit?"템플릿 수정":"템플릿 추가"}</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} color="#6B7280"/></button>
        </div>
        <div className="space-y-4">
          <div><label className={lbl} style={{color:"#9CA3AF"}}>지점</label>
            <select className={inp} style={ist} value={f.branch_id} onChange={upd("branch_id")}>
              <option value="">공통</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>카테고리</label>
            <select className={inp} style={ist} value={f.category} onChange={upd("category")}>
              {["회비","원데이","준비물","PT","기타"].map(c=><option key={c}>{c}</option>)}
            </select></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>제목 *</label>
            <input className={inp} style={ist} value={f.title} onChange={upd("title")} placeholder="템플릿 제목"/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>내용 *</label>
            <textarea className={inp} style={ist} rows={7} value={f.content} onChange={upd("content")} placeholder="답변 내용..."/></div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[13px] font-semibold" style={{background:"#F3F4F6",color:"#6B7280"}}>취소</button>
          <button disabled={saving} onClick={async()=>{
            if(!f.title.trim()||!f.content.trim()){alert("제목과 내용은 필수입니다.");return;}
            setSaving(true);
            const body={...f,branch_id:f.branch_id?Number(f.branch_id):null};
            try{
              if(isEdit) await fetch(`/api/hq/consultation-templates/${item!.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
              else await fetch("/api/hq/consultation-templates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
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

export default function ConsultationPage() {
  const [templates,setTemplates]=useState<Template[]>([]);
  const [branches,setBranches]=useState<Branch[]>([]);
  const [loading,setLoading]=useState(true);
  const [cat,setCat]=useState("전체");
  const [search,setSearch]=useState("");
  const [modal,setModal]=useState<{open:boolean;item:Partial<Template>|null}>({open:false,item:null});
  const {toast,notify}=useToast();

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [tr,br]=await Promise.all([
        fetch("/api/hq/consultation-templates").then(r=>r.json()),
        fetch("/api/hq/branches").then(r=>r.json()),
      ]);
      setTemplates(tr.data??[]);setBranches(br.data??[]);
    }catch(e){console.error(e);notify("불러오기 실패",false);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  const toggleFav=async(t:Template)=>{
    await fetch(`/api/hq/consultation-templates/${t.id}/favorite`,{method:"POST"});
    setTemplates(p=>p.map(x=>x.id===t.id?{...x,favorite_count:x.favorite_count>0?0:1}:x));
  };
  const del=async(t:Template)=>{
    if(!confirm(`"${t.title}"을 삭제하시겠습니까?`))return;
    const j=await fetch(`/api/hq/consultation-templates/${t.id}`,{method:"DELETE"}).then(r=>r.json());
    if(j.success){notify("삭제됐습니다.");load();}else notify("삭제 실패",false);
  };

  const filtered=templates
    .filter(t=>cat==="전체"||t.category===cat)
    .filter(t=>!search||t.title.includes(search)||t.content.includes(search));
  const sorted=[...filtered.filter(t=>t.favorite_count>0),...filtered.filter(t=>!t.favorite_count)];

  return (
    <div className="max-w-[1360px] mx-auto space-y-6">
      <Toast toast={toast}/>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-black tracking-tight" style={{color:"#111827"}}>상담센터</h1>
          <p className="mt-0.5 text-[13px]" style={{color:"#6B7280"}}>상담 답변 템플릿을 관리합니다.</p>
        </div>
        <button onClick={()=>setModal({open:true,item:null})}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold shrink-0"
          style={{background:"#EF3B2D",color:"#FFF"}}><Plus size={15}/> 템플릿 추가</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[{label:"전체 답변",value:templates.length,unit:"개"},{label:"즐겨찾기",value:templates.filter(t=>t.favorite_count>0).length,unit:"개"},{label:"총 복사수",value:templates.reduce((s,t)=>s+(t.copy_count||0),0),unit:"회"}].map(s=>(
          <div key={s.label} className="rounded-2xl border px-5 py-4 hover:shadow-md transition-all" style={CS}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{color:"#9CA3AF"}}>{s.label}</p>
            <div className="flex items-end gap-1">
              <span className="text-[28px] font-black leading-none" style={{color:"#111827"}}>{s.value}</span>
              <span className="text-[12px] font-semibold mb-0.5" style={{color:"#6B7280"}}>{s.unit}</span>
            </div>
            <div className="mt-3 h-[2px] w-6 rounded-full" style={{background:"#EF3B2D"}}/>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e=>setSearch(e.target.value)}
          className="rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-red-400 w-48"
          style={{borderColor:"#E5E7EB",background:"#FFF"}} placeholder="검색..."/>
        <div className="flex gap-1.5 flex-wrap">
          {CATS.map(c=>(
            <button key={c} onClick={()=>setCat(c)} className="rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
              style={{background:cat===c?"#EF3B2D":"#F3F4F6",color:cat===c?"#FFF":"#6B7280"}}>{c}</button>
          ))}
        </div>
      </div>

      {loading?(
        <div className="flex items-center justify-center py-20"><p className="text-[13px]" style={{color:"#9CA3AF"}}>불러오는 중…</p></div>
      ):sorted.length===0?(
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-3xl">💬</p><p className="text-[13px]" style={{color:"#9CA3AF"}}>등록된 템플릿이 없습니다.</p>
        </div>
      ):(
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map(t=>{
            const bc=t.branch_name?(BC[t.branch_name]??"#6B7280"):"#9CA3AF";
            return (
              <div key={t.id} className="rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-all" style={CS}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold truncate" style={{color:"#111827"}}>{t.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {t.branch_name&&<span className="text-[10px] font-semibold rounded-md px-2 py-0.5" style={{background:`${bc}14`,color:bc}}>📍{t.branch_name}</span>}
                      <span className="text-[10px] font-semibold rounded-md px-2 py-0.5" style={{background:"#F3F4F6",color:"#6B7280"}}>{t.category}</span>
                      {(t.copy_count||0)>0&&<span className="text-[10px]" style={{color:"#9CA3AF"}}>복사 {t.copy_count}회</span>}
                    </div>
                  </div>
                  <button onClick={()=>toggleFav(t)} className="p-1 rounded-lg hover:bg-gray-100 shrink-0">
                    <Star size={15} fill={t.favorite_count>0?"#F59E0B":"none"} color={t.favorite_count>0?"#F59E0B":"#D1D5DB"}/>
                  </button>
                </div>
                <p className="text-[12px] leading-relaxed line-clamp-4 whitespace-pre-wrap flex-1" style={{color:"#374151"}}>{t.content}</p>
                <div className="flex items-center gap-2 pt-1" style={{borderTop:"1px solid #F3F4F6"}}>
                  <CopyBtn text={t.content} id={t.id}/>
                  <button onClick={()=>setModal({open:true,item:t})}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold hover:bg-gray-100"
                    style={{background:"#F3F4F6",color:"#6B7280"}}><Pencil size={12}/> 수정</button>
                  <button onClick={()=>del(t)} className="flex items-center gap-1 rounded-lg px-2 py-1.5 ml-auto"
                    style={{background:"#FEF2F2",color:"#EF3B2D"}}><Trash2 size={12}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal.open&&<TplModal branches={branches} item={modal.item} onClose={()=>setModal({open:false,item:null})} onSave={()=>{load();notify("저장됐습니다.");}}/>}
    </div>
  );
}
