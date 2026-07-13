"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, X, Save, Trash2, Pencil, ExternalLink } from "lucide-react";
import { Toast, useToast } from "@/app/components/hq/Toast";

interface Branch { id: number; name: string }
interface Asset {
  id: number; branch_id: number | null; branch_name: string | null;
  name: string; category: string; file_url: string | null;
  description: string | null; tags: string | null;
}

const CATEGORIES = ["로고","현수막","배너","SNS 이미지","영상","문서","기타"];
const BC: Record<string,string> = { 목동점:"#8B5CF6",신정점:"#10B981",개봉점:"#3B82F6",철산점:"#EF3B2D",영등포점:"#F59E0B" };
const CS = { background:"#FFFFFF", border:"1px solid #E5E7EB", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" } as const;

function AssetModal({ branches, item, onClose, onSave }: {
  branches:Branch[]; item:Partial<Asset>|null; onClose:()=>void; onSave:()=>void;
}) {
  const isEdit=!!item?.id;
  const [f,setF]=useState({
    branch_id:String(item?.branch_id??""), name:item?.name??"",
    category:item?.category??"기타", file_url:item?.file_url??"",
    description:item?.description??"", tags:item?.tags??"",
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
          <p className="text-[16px] font-black" style={{color:"#111827"}}>{isEdit?"에셋 수정":"에셋 추가"}</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} color="#6B7280"/></button>
        </div>
        <div className="space-y-4">
          <div><label className={lbl} style={{color:"#9CA3AF"}}>지점</label>
            <select className={inp} style={ist} value={f.branch_id} onChange={upd("branch_id")}>
              <option value="">공통</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>카테고리</label>
            <select className={inp} style={ist} value={f.category} onChange={upd("category")}>
              {CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>이름 *</label>
            <input className={inp} style={ist} value={f.name} onChange={upd("name")} placeholder="에셋 이름"/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>파일 URL / 드라이브 링크</label>
            <input className={inp} style={ist} value={f.file_url} onChange={upd("file_url")} placeholder="https://drive.google.com/..."/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>설명</label>
            <textarea className={inp} style={ist} rows={3} value={f.description} onChange={upd("description")} placeholder="에셋 설명..."/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>태그</label>
            <input className={inp} style={ist} value={f.tags} onChange={upd("tags")} placeholder="예: 여름,행사,2024"/></div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[13px] font-semibold" style={{background:"#F3F4F6",color:"#6B7280"}}>취소</button>
          <button disabled={saving} onClick={async()=>{
            if(!f.name.trim()){alert("이름은 필수입니다.");return;}
            setSaving(true);
            const body={...f,branch_id:f.branch_id?Number(f.branch_id):null};
            try{
              if(isEdit) await fetch(`/api/hq/assets/${item!.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
              else await fetch("/api/hq/assets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
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

export default function AssetsPage() {
  const [assets,setAssets]=useState<Asset[]>([]);
  const [branches,setBranches]=useState<Branch[]>([]);
  const [loading,setLoading]=useState(true);
  const [catFilter,setCatFilter]=useState("전체");
  const [branchFilter,setBranchFilter]=useState("전체");
  const [search,setSearch]=useState("");
  const [modal,setModal]=useState<{open:boolean;item:Partial<Asset>|null}>({open:false,item:null});
  const {toast,notify}=useToast();

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [ar,br]=await Promise.all([
        fetch("/api/hq/assets").then(r=>r.json()),
        fetch("/api/hq/branches").then(r=>r.json()),
      ]);
      setAssets(ar.data??[]);setBranches(br.data??[]);
    }catch(e){console.error(e);notify("불러오기 실패",false);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  const del=async(a:Asset)=>{
    if(!confirm(`"${a.name}"을 삭제하시겠습니까?`))return;
    const j=await fetch(`/api/hq/assets/${a.id}`,{method:"DELETE"}).then(r=>r.json());
    if(j.success){notify("삭제됐습니다.");load();}else notify("삭제 실패",false);
  };

  const filtered=assets
    .filter(a=>catFilter==="전체"||a.category===catFilter)
    .filter(a=>branchFilter==="전체"||(a.branch_name===branchFilter))
    .filter(a=>!search||a.name.includes(search)||(a.tags??"").includes(search));

  return (
    <div className="max-w-[1360px] mx-auto space-y-6">
      <Toast toast={toast}/>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-black tracking-tight" style={{color:"#111827"}}>에셋 관리</h1>
          <p className="mt-0.5 text-[13px]" style={{color:"#6B7280"}}>마케팅 자료, 로고, 이미지, 영상 파일을 관리합니다.</p>
        </div>
        <button onClick={()=>setModal({open:true,item:null})}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold shrink-0"
          style={{background:"#EF3B2D",color:"#FFF"}}><Plus size={15}/> 에셋 추가</button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input value={search} onChange={e=>setSearch(e.target.value)}
          className="rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-red-400 w-48"
          style={{borderColor:"#E5E7EB",background:"#FFF"}} placeholder="이름, 태그 검색..."/>
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
      </div>

      {loading?(
        <div className="flex items-center justify-center py-20"><p className="text-[13px]" style={{color:"#9CA3AF"}}>불러오는 중…</p></div>
      ):filtered.length===0?(
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-3xl">📁</p><p className="text-[13px]" style={{color:"#9CA3AF"}}>등록된 에셋이 없습니다.</p>
        </div>
      ):(
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(a=>{
            const bc=a.branch_name?(BC[a.branch_name]??"#6B7280"):"#9CA3AF";
            return (
              <div key={a.id} className="rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-all" style={CS}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold truncate" style={{color:"#111827"}}>{a.name}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold rounded-md px-2 py-0.5" style={{background:"#F3F4F6",color:"#6B7280"}}>{a.category}</span>
                      {a.branch_name&&<span className="text-[10px] font-semibold rounded-md px-2 py-0.5" style={{background:`${bc}14`,color:bc}}>📍{a.branch_name}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={()=>setModal({open:true,item:a})} className="p-1.5 rounded-lg hover:bg-gray-100" style={{color:"#9CA3AF"}}><Pencil size={13}/></button>
                    <button onClick={()=>del(a)} className="p-1.5 rounded-lg" style={{color:"#EF3B2D",background:"#FEF2F2"}}><Trash2 size={13}/></button>
                  </div>
                </div>
                {a.description&&<p className="text-[12px] leading-relaxed" style={{color:"#6B7280"}}>{a.description}</p>}
                {a.tags&&(
                  <div className="flex flex-wrap gap-1">
                    {a.tags.split(",").map(tag=>(
                      <span key={tag} className="text-[10px] rounded-md px-2 py-0.5" style={{background:"#F3F4F6",color:"#9CA3AF"}}>#{tag.trim()}</span>
                    ))}
                  </div>
                )}
                {a.file_url&&(
                  <a href={a.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12px] font-semibold hover:underline mt-auto"
                    style={{color:"#EF3B2D"}}><ExternalLink size={12}/> 파일 열기</a>
                )}
              </div>
            );
          })}
        </div>
      )}
      {modal.open&&<AssetModal branches={branches} item={modal.item} onClose={()=>setModal({open:false,item:null})} onSave={()=>{load();notify("저장됐습니다.");}}/>}
    </div>
  );
}
