"use client";
import { useEffect, useState, useCallback } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Toast, useToast } from "@/app/components/hq/Toast";

interface Setting { id: number; setting_key: string; setting_value: string }

const CS = { background:"#FFFFFF", border:"1px solid #E5E7EB", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" } as const;

const KEY_LABELS: Record<string,{label:string;desc:string;group:string}> = {
  gym_name:       {label:"헬스장 이름",desc:"서비스 전반에 사용되는 상호명",group:"기본 정보"},
  ceo_name:       {label:"대표자 이름",desc:"",group:"기본 정보"},
  contact_phone:  {label:"대표 전화",desc:"",group:"기본 정보"},
  contact_email:  {label:"대표 이메일",desc:"",group:"기본 정보"},
  kakao_id:       {label:"카카오톡 채널 ID",desc:"",group:"SNS"},
  instagram_main: {label:"인스타 메인 계정",desc:"@아이디",group:"SNS"},
  naver_blog:     {label:"네이버 블로그 URL",desc:"",group:"SNS"},
  monthly_target: {label:"월 목표 매출 (원)",desc:"",group:"목표"},
  member_target:  {label:"월 목표 신규 회원",desc:"",group:"목표"},
  ai_tone:        {label:"AI 글쓰기 톤",desc:"예: 친근하고 활기차게",group:"AI 설정"},
  ai_brand_desc:  {label:"브랜드 소개",desc:"AI가 콘텐츠 작성 시 참고합니다",group:"AI 설정"},
};

function SettingRow({ s, onSave }: { s:Setting; onSave:(key:string,val:string)=>void }) {
  const [editing,setEditing]=useState(false);
  const [val,setVal]=useState(s.setting_value);
  const meta=KEY_LABELS[s.setting_key];
  const isLong=s.setting_key==="ai_brand_desc";

  const save=async()=>{
    await onSave(s.setting_key,val);
    setEditing(false);
  };

  return (
    <div className="px-5 py-4 flex items-start gap-4" style={{borderBottom:"1px solid #F3F4F6"}}>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold" style={{color:"#111827"}}>{meta?.label??s.setting_key}</p>
        {meta?.desc&&<p className="text-[11px] mt-0.5" style={{color:"#9CA3AF"}}>{meta.desc}</p>}
        {editing?(
          isLong
            ?<textarea className="mt-2 w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-red-400"
              style={{borderColor:"#E5E7EB",color:"#111827",background:"#FAFAFA"}} rows={4}
              value={val} onChange={e=>setVal(e.target.value)}/>
            :<input className="mt-2 w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-red-400"
              style={{borderColor:"#E5E7EB",color:"#111827",background:"#FAFAFA"}}
              value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()}/>
        ):(
          <p className="mt-1.5 text-[13px]" style={{color:"#374151"}}>{s.setting_value||<span style={{color:"#D1D5DB"}}>미설정</span>}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0 pt-0.5">
        {editing?(
          <>
            <button onClick={save} className="p-1.5 rounded-lg" style={{background:"#F0FDF4",color:"#059669"}}><Check size={14}/></button>
            <button onClick={()=>{setVal(s.setting_value);setEditing(false);}} className="p-1.5 rounded-lg hover:bg-gray-100" style={{color:"#9CA3AF"}}><X size={14}/></button>
          </>
        ):(
          <button onClick={()=>setEditing(true)} className="p-1.5 rounded-lg hover:bg-gray-100" style={{color:"#9CA3AF"}}><Pencil size={14}/></button>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings,setSettings]=useState<Setting[]>([]);
  const [loading,setLoading]=useState(true);
  const {toast,notify}=useToast();

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const j=await fetch("/api/hq/settings").then(r=>r.json());
      const list:Setting[]=j.data?.list??[];
      // Merge with known keys so all keys appear even if not in DB yet
      const existing=new Set(list.map((s:Setting)=>s.setting_key));
      const defaults=Object.keys(KEY_LABELS)
        .filter(k=>!existing.has(k))
        .map((k,i)=>({id:-(i+1),setting_key:k,setting_value:""}));
      setSettings([...list,...defaults]);
    }catch(e){console.error(e);notify("불러오기 실패",false);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  const save=async(key:string,value:string)=>{
    const j=await fetch("/api/hq/settings",{method:"PUT",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({key,value})}).then(r=>r.json());
    if(j.success){
      notify("저장됐습니다.");
      setSettings(p=>p.map(s=>s.setting_key===key?{...s,setting_value:value}:s));
    }else notify("저장 실패",false);
  };

  // Group by category
  const groups: Record<string,Setting[]> = {};
  for(const s of settings){
    const g=KEY_LABELS[s.setting_key]?.group??"기타";
    if(!groups[g])groups[g]=[];
    groups[g].push(s);
  }

  return (
    <div className="max-w-[800px] mx-auto space-y-6">
      <Toast toast={toast}/>
      <div>
        <h1 className="text-[20px] font-black tracking-tight" style={{color:"#111827"}}>환경설정</h1>
        <p className="mt-0.5 text-[13px]" style={{color:"#6B7280"}}>HQ 운영에 필요한 기본 정보를 설정합니다.</p>
      </div>

      {loading?(
        <div className="flex items-center justify-center py-20"><p className="text-[13px]" style={{color:"#9CA3AF"}}>불러오는 중…</p></div>
      ):(
        Object.entries(groups).map(([group,rows])=>(
          <div key={group} className="rounded-2xl overflow-hidden" style={CS}>
            <div className="px-5 py-3" style={{borderBottom:"1px solid #E5E7EB",background:"#FAFAFA"}}>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{color:"#9CA3AF"}}>{group}</p>
            </div>
            {rows.map(s=>(
              <SettingRow key={s.setting_key} s={s} onSave={save}/>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
