"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, X, Save, Trash2, Pencil, Copy, Check, Sparkles, RefreshCw } from "lucide-react";
import { Toast, useToast } from "@/app/components/hq/Toast";

interface Branch { id: number; name: string }
interface Channel { id: number; channel_name: string; is_uploaded: number; post_url: string | null }
interface Project {
  id: number; branch_id: number | null; branch_name: string | null;
  title: string; content_type: string; status: string; target: string | null;
  shoot_date: string | null; manager: string | null;
  caption: string | null; hashtags: string | null; clip_title: string | null; blog_draft: string | null;
  memo: string | null; channels: Channel[] | Channel | null;
}

const TYPES   = ["릴스","네이버클립","블로그","당근","카카오","인스타"];
const TARGETS = ["학생","여성","직장인","다이어트","키즈","초보자"];
const MOODS   = ["자연스럽게","짧게","홍보스럽지 않게","학부모용","개인계정 느낌"];
const STATUSES = ["아이디어","촬영완료","편집중","업로드대기","업로드완료"];
const STATUS_STYLE: Record<string,{bg:string;color:string}> = {
  아이디어:   {bg:"#F3F4F6",color:"#6B7280"},
  촬영완료:   {bg:"#EFF6FF",color:"#3B82F6"},
  편집중:     {bg:"#FFFBEB",color:"#D97706"},
  업로드대기: {bg:"#FEF2F2",color:"#EF3B2D"},
  업로드완료: {bg:"#F0FDF4",color:"#059669"},
};
const BC: Record<string,string> = { 목동점:"#8B5CF6",신정점:"#10B981",개봉점:"#3B82F6",철산점:"#EF3B2D",영등포점:"#F59E0B" };
const CS = { background:"#FFFFFF", border:"1px solid #E5E7EB", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" } as const;

function CopyBtn({ text }: { text: string }) {
  const [c,setC]=useState(false);
  return (
    <button onClick={async()=>{ await navigator.clipboard.writeText(text); setC(true); setTimeout(()=>setC(false),1200); }}
      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all"
      style={{background:c?"rgba(16,185,129,0.1)":"#F3F4F6",color:c?"#059669":"#6B7280"}}>
      {c?<Check size={11}/>:<Copy size={11}/>} {c?"복사됨":"복사"}
    </button>
  );
}

function ProjectModal({ branches, item, onClose, onSave }: {
  branches:Branch[]; item:Partial<Project>|null; onClose:()=>void; onSave:()=>void;
}) {
  const isEdit=!!item?.id;
  const [f,setF]=useState({
    branch_id:String(item?.branch_id??""), title:item?.title??"", content_type:item?.content_type??"릴스",
    status:item?.status??"아이디어", target:item?.target??"", shoot_date:item?.shoot_date?.slice(0,10)??"",
    manager:item?.manager??"", caption:item?.caption??"", hashtags:item?.hashtags??"",
    clip_title:item?.clip_title??"", blog_draft:item?.blog_draft??"", memo:item?.memo??"",
  });
  const [aiPrompt,setAiPrompt]=useState("");
  const [aiMood,setAiMood]=useState("자연스럽게");
  const [aiLoading,setAiLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const upd=(k:keyof typeof f)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setF(p=>({...p,[k]:e.target.value}));
  const inp="w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-red-400 transition-colors";
  const ist={borderColor:"#E5E7EB",color:"#111827",background:"#FAFAFA"};
  const lbl="block text-[11px] font-semibold mb-1.5 uppercase tracking-widest";

  const generateAI=async()=>{
    if(!aiPrompt.trim()){alert("내용을 입력해주세요.");return;}
    setAiLoading(true);
    try{
      const branch=branches.find(b=>String(b.id)===f.branch_id);
      const r=await fetch("/api/hq/ai-content",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({branch:branch?.name??"스트롱복싱",type:f.content_type,target:f.target,mood:aiMood,prompt:aiPrompt})});
      const j=await r.json();
      if(j.success&&j.data){
        setF(p=>({...p,caption:j.data.insta||p.caption,clip_title:j.data.clip_title||p.clip_title,
          blog_draft:j.data.blog||p.blog_draft,hashtags:j.data.hashtags||p.hashtags}));
      }else alert("AI 생성 실패: "+(j.message??""));
    }finally{setAiLoading(false);}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.3)"}}>
      <div className="w-full max-w-2xl rounded-2xl p-6 max-h-[92vh] overflow-y-auto" style={CS}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-[16px] font-black" style={{color:"#111827"}}>{isEdit?"콘텐츠 수정":"콘텐츠 등록"}</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} color="#6B7280"/></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={lbl} style={{color:"#9CA3AF"}}>지점</label>
            <select className={inp} style={ist} value={f.branch_id} onChange={upd("branch_id")}>
              <option value="">공통</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>유형</label>
            <select className={inp} style={ist} value={f.content_type} onChange={upd("content_type")}>
              {TYPES.map(t=><option key={t}>{t}</option>)}
            </select></div>
          <div className="sm:col-span-2"><label className={lbl} style={{color:"#9CA3AF"}}>제목 *</label>
            <input className={inp} style={ist} value={f.title} onChange={upd("title")} placeholder="콘텐츠 제목"/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>상태</label>
            <select className={inp} style={ist} value={f.status} onChange={upd("status")}>
              {STATUSES.map(s=><option key={s}>{s}</option>)}
            </select></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>타겟</label>
            <select className={inp} style={ist} value={f.target} onChange={upd("target")}>
              <option value="">선택 안함</option>{TARGETS.map(t=><option key={t}>{t}</option>)}
            </select></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>촬영일</label>
            <input type="date" className={inp} style={ist} value={f.shoot_date} onChange={upd("shoot_date")}/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>담당자</label>
            <input className={inp} style={ist} value={f.manager} onChange={upd("manager")} placeholder="담당자 이름"/></div>
        </div>

        <div className="mt-5 rounded-xl p-4" style={{background:"#FEF2F2",border:"1px solid #FCA5A5"}}>
          <p className="text-[12px] font-bold mb-3" style={{color:"#EF3B2D"}}>🤖 AI 콘텐츠 생성</p>
          <div className="space-y-2">
            <select className="w-full rounded-lg border px-2 py-1.5 text-[12px] outline-none" style={{borderColor:"#FCA5A5",background:"#FFF"}}
              value={aiMood} onChange={e=>setAiMood(e.target.value)}>
              {MOODS.map(m=><option key={m}>{m}</option>)}
            </select>
            <div className="flex gap-2">
              <input className="flex-1 rounded-lg border px-3 py-1.5 text-[12px] outline-none" style={{borderColor:"#FCA5A5",background:"#FFF"}}
                value={aiPrompt} onChange={e=>setAiPrompt(e.target.value)} placeholder="예: 목동점 학생들이 샌드백 치는 영상, 방학 특강 홍보용"/>
              <button onClick={generateAI} disabled={aiLoading}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold disabled:opacity-50"
                style={{background:"#EF3B2D",color:"#FFF"}}>
                {aiLoading?<RefreshCw size={12} className="animate-spin"/>:<Sparkles size={12}/>}
                {aiLoading?"생성 중...":"생성"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div><label className={lbl} style={{color:"#9CA3AF"}}>인스타 게시글</label>
            <textarea className={inp} style={ist} rows={4} value={f.caption} onChange={upd("caption")} placeholder="인스타 게시글 내용..."/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>네이버 클립 제목</label>
            <input className={inp} style={ist} value={f.clip_title} onChange={upd("clip_title")} placeholder="클립 제목"/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>해시태그</label>
            <input className={inp} style={ist} value={f.hashtags} onChange={upd("hashtags")} placeholder="#해시태그1 #해시태그2"/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>블로그 초안</label>
            <textarea className={inp} style={ist} rows={4} value={f.blog_draft} onChange={upd("blog_draft")} placeholder="블로그 초안..."/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>메모</label>
            <textarea className={inp} style={ist} rows={2} value={f.memo} onChange={upd("memo")} placeholder="내부 메모..."/></div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[13px] font-semibold" style={{background:"#F3F4F6",color:"#6B7280"}}>취소</button>
          <button disabled={saving} onClick={async()=>{
            if(!f.title.trim()){alert("제목은 필수입니다.");return;}
            setSaving(true);
            const body={...f,branch_id:f.branch_id?Number(f.branch_id):null};
            try{
              if(isEdit) await fetch(`/api/hq/content-projects/${item!.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
              else await fetch("/api/hq/content-projects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
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

function parseChannels(raw: Channel[] | Channel | null | string): Channel[] {
  if (!raw) return [];
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return []; } }
  if (Array.isArray(raw)) return raw;
  return [];
}

export default function ContentsPage() {
  const [projects,setProjects]=useState<Project[]>([]);
  const [branches,setBranches]=useState<Branch[]>([]);
  const [loading,setLoading]=useState(true);
  const [statusFilter,setStatusFilter]=useState("전체");
  const [branchFilter,setBranchFilter]=useState("전체");
  const [modal,setModal]=useState<{open:boolean;item:Partial<Project>|null}>({open:false,item:null});
  const {toast,notify}=useToast();

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [pr,br]=await Promise.all([
        fetch("/api/hq/content-projects").then(r=>r.json()),
        fetch("/api/hq/branches").then(r=>r.json()),
      ]);
      setProjects(pr.data??[]);setBranches(br.data??[]);
    }catch(e){console.error(e);notify("불러오기 실패",false);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  const del=async(p:Project)=>{
    if(!confirm(`"${p.title}"을 삭제하시겠습니까?`))return;
    const j=await fetch(`/api/hq/content-projects/${p.id}`,{method:"DELETE"}).then(r=>r.json());
    if(j.success){notify("삭제됐습니다.");load();}else notify("삭제 실패",false);
  };

  const toggleChannel=async(projId:number,ch:Channel)=>{
    await fetch("/api/hq/content-channels",{method:"PUT",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id:ch.id,is_uploaded:ch.is_uploaded?0:1})});
    setProjects(p=>p.map(proj=>proj.id!==projId?proj:{...proj,
      channels:parseChannels(proj.channels).map(c=>c.id===ch.id?{...c,is_uploaded:c.is_uploaded?0:1}:c)}));
  };

  const filtered=projects
    .filter(p=>statusFilter==="전체"||p.status===statusFilter)
    .filter(p=>branchFilter==="전체"||(p.branch_name===branchFilter));

  const stats=[
    {label:"전체",value:projects.length},
    {label:"진행중",value:projects.filter(p=>p.status!=="업로드완료").length},
    {label:"업로드완료",value:projects.filter(p=>p.status==="업로드완료").length},
    {label:"촬영완료",value:projects.filter(p=>p.status==="촬영완료").length},
  ];

  return (
    <div className="max-w-[1360px] mx-auto space-y-6">
      <Toast toast={toast}/>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-black tracking-tight" style={{color:"#111827"}}>콘텐츠 관리</h1>
          <p className="mt-0.5 text-[13px]" style={{color:"#6B7280"}}>영상·사진 콘텐츠 제작 현황을 관리합니다.</p>
        </div>
        <button onClick={()=>setModal({open:true,item:null})}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold shrink-0"
          style={{background:"#EF3B2D",color:"#FFF"}}><Plus size={15}/> 콘텐츠 등록</button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map(s=>(
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
        {["전체",...STATUSES].map(s=>(
          <button key={s} onClick={()=>setStatusFilter(s)}
            className="rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
            style={{background:statusFilter===s?"#EF3B2D":"#F3F4F6",color:statusFilter===s?"#FFF":"#6B7280"}}>{s}</button>
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
          <p className="text-3xl">🎬</p><p className="text-[13px]" style={{color:"#9CA3AF"}}>등록된 콘텐츠가 없습니다.</p>
        </div>
      ):(
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(p=>{
            const ss=STATUS_STYLE[p.status]??{bg:"#F3F4F6",color:"#6B7280"};
            const bc=p.branch_name?(BC[p.branch_name]??"#6B7280"):"#9CA3AF";
            const chs=parseChannels(p.channels);
            return (
              <div key={p.id} className="rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-all" style={CS}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold truncate" style={{color:"#111827"}}>{p.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold rounded-md px-2 py-0.5" style={{background:ss.bg,color:ss.color}}>{p.status}</span>
                      {p.branch_name&&<span className="text-[10px] font-semibold rounded-md px-2 py-0.5" style={{background:`${bc}14`,color:bc}}>📍{p.branch_name}</span>}
                      <span className="text-[10px] rounded-md px-2 py-0.5" style={{background:"#F3F4F6",color:"#6B7280"}}>{p.content_type}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={()=>setModal({open:true,item:p})} className="p-1.5 rounded-lg hover:bg-gray-100" style={{color:"#9CA3AF"}}><Pencil size={13}/></button>
                    <button onClick={()=>del(p)} className="p-1.5 rounded-lg" style={{color:"#EF3B2D",background:"#FEF2F2"}}><Trash2 size={13}/></button>
                  </div>
                </div>
                {p.caption&&<p className="text-[12px] leading-relaxed line-clamp-3 whitespace-pre-wrap" style={{color:"#374151"}}>{p.caption}</p>}
                {p.hashtags&&<p className="text-[11px]" style={{color:"#6B7280"}}>{p.hashtags}</p>}
                {chs.length>0&&(
                  <div className="flex flex-wrap gap-1.5">
                    {chs.map((ch:Channel)=>(
                      <button key={ch.id} onClick={()=>toggleChannel(p.id,ch)}
                        className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all"
                        style={{background:ch.is_uploaded?"#F0FDF4":"#F3F4F6",color:ch.is_uploaded?"#059669":"#9CA3AF",
                          border:`1px solid ${ch.is_uploaded?"#86EFAC":"#E5E7EB"}`}}>
                        {ch.is_uploaded?"✅":"○"} {ch.channel_name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5 flex-wrap pt-1" style={{borderTop:"1px solid #F3F4F6"}}>
                  {p.caption&&<CopyBtn text={p.caption}/>}
                  {p.hashtags&&<CopyBtn text={p.hashtags}/>}
                  {p.clip_title&&<CopyBtn text={p.clip_title}/>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {modal.open&&<ProjectModal branches={branches} item={modal.item} onClose={()=>setModal({open:false,item:null})} onSave={()=>{load();notify("저장됐습니다.");}}/>}
    </div>
  );
}
