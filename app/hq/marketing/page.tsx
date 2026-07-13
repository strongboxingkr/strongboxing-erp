"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, X, Save, Trash2, Upload, FileSpreadsheet } from "lucide-react";
import { Toast, useToast } from "@/app/components/hq/Toast";
import * as XLSX from "xlsx";

interface StatRow {
  id: number; branch_id: number | null; branch_name: string | null;
  channel: string; stat_date: string;
  impressions: number; clicks: number;
  inquiries: number; registrations: number; ad_cost: number;
  memo: string | null;
}

// 채널 그룹 (탭 표시용)
const CHANNEL_GROUPS: Record<string, string[]> = {
  "네이버": ["네이버광고", "네이버클립"],
  "당근":   ["당근마켓", "당근비즈니스"],
  "메타":   ["메타광고"],
  "카카오": ["카카오", "카카오광고"],
  "구글":   ["구글광고"],
  "인스타": ["인스타그램"],
  "블로그": ["블로그"],
  "유튜브": ["유튜브"],
  "기타":   ["기타"],
};
const GROUP_ORDER = ["전체","네이버","당근","메타","카카오","구글","인스타","블로그","유튜브","기타"];

// 입력 모달용 원시 채널명
const CHANNELS = ["인스타그램","네이버클립","블로그","당근마켓","카카오","유튜브","기타"];
const AD_SOURCES = ["메타광고","네이버광고","당근비즈니스","카카오광고","구글광고","기타"];
const ALL_CHANNELS = [...new Set([...CHANNELS, ...AD_SOURCES])];

const BC: Record<string,string> = { 목동점:"#8B5CF6",신정점:"#10B981",개봉점:"#3B82F6",철산점:"#EF3B2D",영등포점:"#F59E0B" };
const BRANCH_LIST = ["목동점","신정점","개봉점","철산점","영등포점"];
const CS = { background:"#FFFFFF", border:"1px solid #E5E7EB", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" } as const;

function fmtN(n:number){return n>=10000?`${(n/10000).toFixed(1)}만`:n.toLocaleString();}
function fmtW(n:number){return n>=10000?`${(n/10000).toFixed(0)}만원`:`${n.toLocaleString()}원`;}

// ─── 차트: 일별 클릭 트렌드 ─────────────────────────────────────────────────
function TrendChart({ rows }: { rows: StatRow[] }) {
  const byDate: Record<string,{clicks:number;impressions:number}> = {};
  rows.forEach(r => {
    const d = r.stat_date?.slice(0,10);
    if (!d) return;
    if (!byDate[d]) byDate[d] = {clicks:0,impressions:0};
    byDate[d].clicks += r.clicks;
    byDate[d].impressions += r.impressions;
  });
  const dates = Object.keys(byDate).sort();
  if (dates.length === 0) return <p className="text-center text-[12px] py-8" style={{color:"#9CA3AF"}}>데이터 없음</p>;

  const W=700, H=120, PL=8, PR=8, PT=8, PB=24;
  const chartW=W-PL-PR, chartH=H-PT-PB;
  const maxClicks=Math.max(...dates.map(d=>byDate[d].clicks),1);
  const maxImpr=Math.max(...dates.map(d=>byDate[d].impressions),1);
  const barW=Math.max(2,chartW/dates.length-2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {dates.map((date,i)=>{
        const x=PL+i*(chartW/dates.length);
        const imprH=(byDate[date].impressions/maxImpr)*chartH;
        const clkH=(byDate[date].clicks/maxClicks)*chartH;
        return (
          <g key={date}>
            <rect x={x+1} y={PT+chartH-imprH} width={barW} height={imprH} fill="#E5E7EB" rx={1}/>
            <rect x={x+1} y={PT+chartH-clkH} width={barW*0.6} height={clkH} fill="#EF3B2D" rx={1} opacity={0.85}/>
            {dates.length <= 31 && i%5===0 && (
              <text x={x+barW/2} y={H-4} textAnchor="middle" fontSize={8} fill="#9CA3AF">{date.slice(8)}</text>
            )}
          </g>
        );
      })}
      <text x={PL} y={PT+6} fontSize={8} fill="#9CA3AF">노출</text>
      <rect x={PL+18} y={PT} width={8} height={6} fill="#E5E7EB" rx={1}/>
      <text x={PL+30} y={PT+6} fontSize={8} fill="#9CA3AF">클릭</text>
      <rect x={PL+46} y={PT} width={8} height={6} fill="#EF3B2D" rx={1} opacity={0.85}/>
    </svg>
  );
}

// ─── 차트: 채널 그룹별 수평 바 ───────────────────────────────────────────────
function ChannelChart({ rows, metric }: { rows: StatRow[]; metric:"clicks"|"registrations"|"ad_cost" }) {
  const byGroup: Record<string,number> = {};
  rows.forEach(r => {
    const g = Object.entries(CHANNEL_GROUPS).find(([,chs])=>chs.includes(r.channel))?.[0] ?? "기타";
    if (!byGroup[g]) byGroup[g] = 0;
    byGroup[g] += r[metric];
  });
  const entries = Object.entries(byGroup).filter(([,v])=>v>0).sort(([,a],[,b])=>b-a);
  if (entries.length === 0) return <p className="text-center text-[12px] py-8" style={{color:"#9CA3AF"}}>데이터 없음</p>;

  const maxVal = Math.max(...entries.map(([,v])=>v),1);
  const BAR_H = 18, GAP = 10, LW = 40, W = 300;
  const H = entries.length * (BAR_H + GAP);
  const colors = ["#EF3B2D","#8B5CF6","#3B82F6","#10B981","#F59E0B","#EC4899","#6B7280","#14B8A6","#F97316"];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{maxHeight:180}}>
      {entries.map(([group, val], i) => {
        const bw = ((val/maxVal)*(W-LW-4));
        const y = i*(BAR_H+GAP);
        const fmt = metric==="ad_cost"?fmtW(val):metric==="registrations"?String(val):fmtN(val);
        return (
          <g key={group}>
            <text x={0} y={y+BAR_H-4} fontSize={9} fill="#6B7280" fontWeight={600}>{group}</text>
            <rect x={LW} y={y} width={bw} height={BAR_H} fill={colors[i%colors.length]} rx={3} opacity={0.85}/>
            <text x={LW+bw+4} y={y+BAR_H-4} fontSize={9} fill="#374151" fontWeight={700}>{fmt}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── 차트: 지점별 수평 바 ────────────────────────────────────────────────────
function BranchChart({ rows, metric }: { rows: StatRow[]; metric:"clicks"|"registrations"|"ad_cost"|"impressions" }) {
  const byBranch: Record<string,number> = {};
  rows.forEach(r => {
    const b = r.branch_name ?? "공통";
    if (!byBranch[b]) byBranch[b] = 0;
    byBranch[b] += r[metric];
  });
  const entries = Object.entries(byBranch).filter(([,v])=>v>0).sort(([,a],[,b])=>b-a);
  if (entries.length === 0) return <p className="text-center text-[12px] py-8" style={{color:"#9CA3AF"}}>데이터 없음</p>;

  const maxVal = Math.max(...entries.map(([,v])=>v),1);
  const BAR_H = 18, GAP = 10, LW = 44, W = 300;
  const H = entries.length * (BAR_H + GAP);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{maxHeight:180}}>
      {entries.map(([branch, val], i) => {
        const bw = ((val/maxVal)*(W-LW-36));
        const y = i*(BAR_H+GAP);
        const color = BC[branch] ?? "#6B7280";
        const fmt = metric==="ad_cost"?fmtW(val):metric==="registrations"||metric==="clicks"?fmtN(val):fmtN(val);
        return (
          <g key={branch}>
            <text x={0} y={y+BAR_H-4} fontSize={9} fill="#6B7280" fontWeight={600}>{branch}</text>
            <rect x={LW} y={y} width={bw} height={BAR_H} fill={color} rx={3} opacity={0.8}/>
            <text x={LW+bw+4} y={y+BAR_H-4} fontSize={9} fill="#374151" fontWeight={700}>{fmt}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── 분석 인사이트 ────────────────────────────────────────────────────────────
function Insights({ rows }: { rows: StatRow[] }) {
  if (rows.length === 0) return null;

  // 채널 그룹별 집계
  const byGroup: Record<string,{impressions:number;clicks:number;inquiries:number;registrations:number;ad_cost:number}> = {};
  rows.forEach(r => {
    const g = Object.entries(CHANNEL_GROUPS).find(([,chs])=>chs.includes(r.channel))?.[0] ?? "기타";
    if (!byGroup[g]) byGroup[g]={impressions:0,clicks:0,inquiries:0,registrations:0,ad_cost:0};
    byGroup[g].impressions += r.impressions;
    byGroup[g].clicks += r.clicks;
    byGroup[g].inquiries += r.inquiries;
    byGroup[g].registrations += r.registrations;
    byGroup[g].ad_cost += r.ad_cost;
  });

  // 지점별 집계
  const byBranch: Record<string,{registrations:number;clicks:number;ad_cost:number;inquiries:number}> = {};
  rows.forEach(r => {
    const b = r.branch_name ?? "공통";
    if (!byBranch[b]) byBranch[b]={registrations:0,clicks:0,ad_cost:0,inquiries:0};
    byBranch[b].registrations += r.registrations;
    byBranch[b].clicks += r.clicks;
    byBranch[b].ad_cost += r.ad_cost;
    byBranch[b].inquiries += r.inquiries;
  });

  const groupEntries = Object.entries(byGroup);
  const branchEntries = Object.entries(byBranch);

  // 최고 CTR 채널 그룹
  const bestCTR = groupEntries
    .filter(([,v])=>v.impressions>0)
    .sort(([,a],[,b])=>(b.clicks/b.impressions)-(a.clicks/a.impressions))[0];

  // 최고 문의 채널
  const bestInq = groupEntries.filter(([,v])=>v.inquiries>0).sort(([,a],[,b])=>b.inquiries-a.inquiries)[0];

  // 최고 등록 지점
  const bestReg = branchEntries.filter(([,v])=>v.registrations>0).sort(([,a],[,b])=>b.registrations-a.registrations)[0];

  // 가장 클릭 많은 지점
  const bestClick = branchEntries.filter(([b])=>b!=="공통").sort(([,a],[,b])=>b.clicks-a.clicks)[0];

  // 광고비 CPA (등록당)
  const cpaGroup = groupEntries
    .filter(([,v])=>v.registrations>0&&v.ad_cost>0)
    .map(([g,v])=>({g,cpa:Math.round(v.ad_cost/v.registrations)}))
    .sort((a,b)=>a.cpa-b.cpa)[0];

  // 당근 무료 효과
  const daangn = byGroup["당근"];
  const meta = byGroup["메타"];
  const naver = byGroup["네이버"];

  const cards = [
    bestCTR && {
      icon:"🎯", label:"최고 CTR 채널",
      value:`${bestCTR[0]} ${((bestCTR[1].clicks/bestCTR[1].impressions)*100).toFixed(2)}%`,
      sub:`${fmtN(bestCTR[1].clicks)} 클릭 / ${fmtN(bestCTR[1].impressions)} 노출`
    },
    bestInq && {
      icon:"💬", label:"문의 최다 채널",
      value:`${bestInq[0]} ${bestInq[1].inquiries}건`,
      sub:`광고비 ${fmtW(bestInq[1].ad_cost)}`
    },
    bestReg && {
      icon:"⭐", label:"등록 최다 지점",
      value:`${bestReg[0]} ${bestReg[1].registrations}명`,
      sub:`클릭 ${fmtN(bestReg[1].clicks)}회`
    },
    bestClick && !bestReg && {
      icon:"👆", label:"클릭 최다 지점",
      value:`${bestClick[0]} ${fmtN(bestClick[1].clicks)}`,
      sub:`광고비 ${fmtW(bestClick[1].ad_cost)}`
    },
    cpaGroup && {
      icon:"💰", label:"최저 CPA",
      value:`${cpaGroup.g} ${fmtW(cpaGroup.cpa)}`,
      sub:"등록당 광고비"
    },
    daangn && daangn.registrations > 0 && {
      icon:"🥕", label:"당근 효과",
      value:`단골 ${daangn.registrations}명 확보`,
      sub:"광고비 0원 (무료)"
    },
    meta && meta.inquiries > 0 && {
      icon:"📘", label:"메타 문의",
      value:`${meta.inquiries}건 문의`,
      sub:`${fmtW(meta.ad_cost)} 집행 · CPI ${fmtW(Math.round(meta.ad_cost/meta.inquiries))}`
    },
    naver && naver.clicks > 0 && {
      icon:"🟢", label:"네이버 클릭",
      value:`${fmtN(naver.clicks)}회`,
      sub:`CTR ${naver.impressions>0?((naver.clicks/naver.impressions)*100).toFixed(2):"-"}% · ${fmtW(naver.ad_cost)}`
    },
  ].filter(Boolean) as {icon:string;label:string;value:string;sub:string}[];

  if (cards.length === 0) return null;

  return (
    <div className="rounded-2xl border p-5" style={CS}>
      <p className="text-[12px] font-bold mb-4" style={{color:"#111827"}}>📊 데이터 분석 인사이트</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {cards.map((c,i)=>(
          <div key={i} className="rounded-xl p-3" style={{background:"#F9FAFB",border:"1px solid #F3F4F6"}}>
            <p className="text-[16px] mb-1">{c.icon}</p>
            <p className="text-[10px] font-semibold mb-1" style={{color:"#9CA3AF"}}>{c.label}</p>
            <p className="text-[13px] font-black leading-tight" style={{color:"#111827"}}>{c.value}</p>
            <p className="text-[10px] mt-0.5" style={{color:"#6B7280"}}>{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 입력 모달 ────────────────────────────────────────────────────────────────
function StatModal({ item, onClose, onSave }: {
  item:Partial<StatRow>|null; onClose:()=>void; onSave:()=>void;
}) {
  const isEdit=!!item?.id;
  const [f,setF]=useState({
    branch_id:String(item?.branch_id??""), channel:item?.channel??"인스타그램",
    stat_date:item?.stat_date?.slice(0,10)??"",
    impressions:String(item?.impressions??"0"),
    clicks:String(item?.clicks??"0"),
    inquiries:String(item?.inquiries??"0"),
    registrations:String(item?.registrations??"0"),
    ad_cost:String(item?.ad_cost??"0"),
    memo:item?.memo??"",
  });
  const [branches,setBranches]=useState<{id:number;name:string}[]>([]);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{fetch("/api/hq/branches").then(r=>r.json()).then(j=>setBranches(j.data??[]));},[]);
  const upd=(k:keyof typeof f)=>(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>)=>setF(p=>({...p,[k]:e.target.value}));
  const inp="w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-red-400 transition-colors";
  const ist={borderColor:"#E5E7EB",color:"#111827",background:"#FAFAFA"};
  const lbl="block text-[11px] font-semibold mb-1.5 uppercase tracking-widest";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.3)"}}>
      <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={CS}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-[16px] font-black" style={{color:"#111827"}}>{isEdit?"통계 수정":"통계 입력"}</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} color="#6B7280"/></button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={lbl} style={{color:"#9CA3AF"}}>지점</label>
            <select className={inp} style={ist} value={f.branch_id} onChange={upd("branch_id")}>
              <option value="">공통</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>채널</label>
            <select className={inp} style={ist} value={f.channel} onChange={upd("channel")}>
              {ALL_CHANNELS.map(c=><option key={c}>{c}</option>)}
            </select></div>
          <div className="sm:col-span-2"><label className={lbl} style={{color:"#9CA3AF"}}>날짜 *</label>
            <input type="date" className={inp} style={ist} value={f.stat_date} onChange={upd("stat_date")}/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>노출수</label>
            <input type="number" className={inp} style={ist} value={f.impressions} onChange={upd("impressions")}/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>클릭수</label>
            <input type="number" className={inp} style={ist} value={f.clicks} onChange={upd("clicks")}/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>문의수</label>
            <input type="number" className={inp} style={ist} value={f.inquiries} onChange={upd("inquiries")}/></div>
          <div><label className={lbl} style={{color:"#9CA3AF"}}>등록수</label>
            <input type="number" className={inp} style={ist} value={f.registrations} onChange={upd("registrations")}/></div>
          <div className="sm:col-span-2"><label className={lbl} style={{color:"#9CA3AF"}}>광고비 (원)</label>
            <input type="number" className={inp} style={ist} value={f.ad_cost} onChange={upd("ad_cost")}/></div>
          <div className="sm:col-span-2"><label className={lbl} style={{color:"#9CA3AF"}}>메모</label>
            <textarea className={inp} style={ist} rows={2} value={f.memo} onChange={upd("memo")}/></div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[13px] font-semibold" style={{background:"#F3F4F6",color:"#6B7280"}}>취소</button>
          <button disabled={saving} onClick={async()=>{
            if(!f.stat_date){alert("날짜는 필수입니다.");return;}
            setSaving(true);
            const body={...f,branch_id:f.branch_id?Number(f.branch_id):null,
              impressions:Number(f.impressions),clicks:Number(f.clicks),
              inquiries:Number(f.inquiries),registrations:Number(f.registrations),ad_cost:Number(f.ad_cost)};
            try{
              if(isEdit) await fetch(`/api/hq/marketing-stats/${item!.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
              else await fetch("/api/hq/marketing-stats",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
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

// ─── 엑셀 업로드 모달 ───────────────────────────────────────────────────────
interface ExcelRow { branch_id:number|null; stat_date:string; channel:string; impressions:number; clicks:number; inquiries:number; registrations:number; ad_cost:number; memo:string }

function ExcelModal({ onClose, onSave }: { onClose:()=>void; onSave:()=>void }) {
  const [rows,setRows]=useState<ExcelRow[]>([]);
  const [saving,setSaving]=useState(false);
  const [adSource,setAdSource]=useState("메타광고");
  const [branchId,setBranchId]=useState<string>("");
  const [branches,setBranches]=useState<{id:number;name:string}[]>([]);
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{fetch("/api/hq/branches").then(r=>r.json()).then(j=>setBranches(j.data??[]));},[]);

  const toNum=(v:any)=>Number(String(v??"").replace(/[^0-9.]/g,""))||0;

  function parseNaver(wb: XLSX.WorkBook): ExcelRow[] {
    const ws=wb.Sheets[wb.SheetNames[0]];
    const arr: any[][]=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
    if(arr.length<3) return [];
    const headers: string[]=arr[1].map((h:any)=>String(h).replace(/[\s()（）]/g,"").toLowerCase());
    const idxOf=(...names:string[])=>headers.findIndex(h=>names.some(n=>h.includes(n.toLowerCase())));
    const dateIdx=idxOf("일별","date");
    const impressIdx=idxOf("노출수","노출");
    const clickIdx=idxOf("클릭수","클릭");
    const costIdx=idxOf("총비용","비용");
    const byDate: Record<string,{impressions:number;clicks:number;ad_cost:number}>={};
    for(const row of arr.slice(2)){
      const dateRaw=String(row[dateIdx]??"").trim();
      if(!dateRaw) continue;
      const stat_date=dateRaw.replace(/\.$/,"").replace(/\./g,"-");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(stat_date)) continue;
      if(!byDate[stat_date]) byDate[stat_date]={impressions:0,clicks:0,ad_cost:0};
      byDate[stat_date].impressions+=toNum(row[impressIdx]);
      byDate[stat_date].clicks+=toNum(row[clickIdx]);
      byDate[stat_date].ad_cost+=toNum(row[costIdx]);
    }
    return Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([stat_date,d])=>({
      branch_id: branchId?Number(branchId):null, stat_date, channel:adSource,
      impressions:d.impressions, clicks:d.clicks, inquiries:0, registrations:0, ad_cost:d.ad_cost, memo:"",
    }));
  }

  function parseMeta(wb: XLSX.WorkBook): ExcelRow[] {
    const ws=wb.Sheets[wb.SheetNames[0]];
    const raw: any[]=XLSX.utils.sheet_to_json(ws,{defval:""});
    const data=raw.filter(r=>!Object.values(r).some(v=>String(v).includes("No data")));
    if(data.length===0) return [];
    const findKey=(...names:string[])=>Object.keys(data[0]).find(k=>{
      const norm=k.replace(/[\s()（）]/g,"").toLowerCase();
      return names.some(n=>norm.includes(n.toLowerCase()));
    })??"";
    const dateKey=findKey("보고시작","시작","날짜","date","일자");
    const impressKey=findKey("노출수","노출","impression");
    const clickKey=findKey("링크클릭","클릭수","클릭","click");
    const inquiryKey=findKey("새로운메시지대화상대","메시지대화시작","전환수","결과");
    const costKey=findKey("지출금액","광고비","총비용","비용","cost","spent","amount");
    const byMonth: Record<string,{impressions:number;clicks:number;inquiries:number;registrations:number;ad_cost:number}>={};
    for(const row of data){
      const dateRaw=dateKey?String(row[dateKey]):"";
      if(!dateRaw) continue;
      const ym=dateRaw.slice(0,7).replace(/\./g,"-");
      if(!/^\d{4}-\d{2}$/.test(ym)) continue;
      const stat_date=`${ym}-01`;
      if(!byMonth[stat_date]) byMonth[stat_date]={impressions:0,clicks:0,inquiries:0,registrations:0,ad_cost:0};
      byMonth[stat_date].impressions+=toNum(impressKey?row[impressKey]:0);
      byMonth[stat_date].clicks+=toNum(clickKey?row[clickKey]:0);
      byMonth[stat_date].inquiries+=toNum(inquiryKey?row[inquiryKey]:0);
      byMonth[stat_date].ad_cost+=toNum(costKey?row[costKey]:0);
    }
    return Object.entries(byMonth).sort(([a],[b])=>a.localeCompare(b)).map(([stat_date,d])=>({
      branch_id: branchId?Number(branchId):null, stat_date, channel:adSource, ...d, memo:"",
    }));
  }

  function parseDaangn(wb: XLSX.WorkBook): ExcelRow[] {
    const ws=wb.Sheets[wb.SheetNames[0]];
    const arr: any[][]=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
    if(arr.length<2) return [];
    const headers: string[]=arr[0].map((h:any)=>String(h).replace(/[\s]/g,"").toLowerCase());
    const idxOf=(...names:string[])=>headers.findIndex(h=>names.some(n=>h.includes(n.toLowerCase())));
    const dateIdx=idxOf("날짜");
    const impressIdx=idxOf("조회수");
    const clickIdx=idxOf("방문고객","방문");
    const regIdx=idxOf("단골수","단골");
    return arr.slice(1).flatMap(row=>{
      const dateRaw=String(row[dateIdx]??"").trim();
      if(!dateRaw) return [];
      const stat_date=dateRaw.replace(/\./g,"-");
      if(!/^\d{4}-\d{2}-\d{2}$/.test(stat_date)) return [];
      return [{
        branch_id: branchId?Number(branchId):null, stat_date, channel:adSource,
        impressions:toNum(row[impressIdx]), clicks:toNum(row[clickIdx]),
        inquiries:0, registrations:toNum(row[regIdx]), ad_cost:0, memo:"",
      }];
    });
  }

  function parseFile(file:File){
    const reader=new FileReader();
    reader.onload=e=>{
      const wb=XLSX.read(e.target?.result,{type:"array"});
      let parsed: ExcelRow[];
      if(adSource==="네이버광고") parsed=parseNaver(wb);
      else if(adSource==="당근비즈니스") parsed=parseDaangn(wb);
      else parsed=parseMeta(wb);
      setRows(parsed);
    };
    reader.readAsArrayBuffer(file);
  }

  const save=async()=>{
    if(rows.length===0)return;
    setSaving(true);
    try{
      const j=await fetch("/api/hq/marketing-stats/bulk",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rows})}).then(r=>r.json());
      if(j.success){onSave();onClose();}else alert(j.message??"저장 실패");
    }finally{setSaving(false);}
  };

  const CS2={background:"#FFFFFF",border:"1px solid #E5E7EB",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"} as const;
  const inp="w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-red-400 transition-colors";
  const ist={borderColor:"#E5E7EB",color:"#111827",background:"#FAFAFA"};
  const AD_SOURCES_MODAL = ["메타광고","네이버광고","당근비즈니스","카카오광고","구글광고","기타"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.35)"}}>
      <div className="w-full max-w-4xl rounded-2xl p-6 max-h-[90vh] flex flex-col" style={CS2}>
        <div className="flex items-center justify-between mb-5">
          <p className="text-[16px] font-black" style={{color:"#111827"}}>엑셀 업로드</p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X size={16} color="#6B7280"/></button>
        </div>
        {rows.length===0 ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{color:"#9CA3AF"}}>광고 플랫폼</p>
                <div className="flex flex-wrap gap-2">
                  {AD_SOURCES_MODAL.map(s=>(
                    <button key={s} onClick={()=>setAdSource(s)}
                      className="rounded-xl px-4 py-1.5 text-[12px] font-semibold transition-all"
                      style={{background:adSource===s?"#EF3B2D":"#F3F4F6",color:adSource===s?"#FFF":"#6B7280"}}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold mb-2 uppercase tracking-widest" style={{color:"#9CA3AF"}}>지점</p>
                <select className={inp} style={ist} value={branchId} onChange={e=>setBranchId(e.target.value)}>
                  <option value="">공통 (지점 미지정)</option>
                  {branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-4 py-14"
              style={{border:"2px dashed #E5E7EB",borderRadius:16,cursor:"pointer"}}
              onClick={()=>fileRef.current?.click()}>
              <FileSpreadsheet size={40} color="#9CA3AF"/>
              <p className="text-[14px] font-bold" style={{color:"#374151"}}>{adSource} 엑셀 파일을 선택하세요</p>
              <p className="text-[12px] text-center" style={{color:"#9CA3AF"}}>
                {adSource==="네이버광고"
                  ? "네이버 플레이스 캠페인 보고서 CSV (.csv)"
                  : adSource==="당근비즈니스"
                  ? "당근비즈니스 프로필 통계 CSV (.csv)"
                  : "메타 광고 내보내기 파일 (.xlsx, .csv)"}<br/>
                날짜별·광고별 행 자동 집계됩니다
              </p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e=>{ const f=e.target.files?.[0]; if(f) parseFile(f); }}/>
              <button className="rounded-xl px-5 py-2 text-[13px] font-bold" style={{background:"#EF3B2D",color:"#FFF"}}>
                파일 선택
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-3 text-[13px]" style={{color:"#6B7280"}}>
              총 <b style={{color:"#111827"}}>{rows.length}행</b> 인식됨
              {adSource==="네이버광고"||adSource==="당근비즈니스"?" (일별)":"  (월별 합산)"}. 확인 후 저장하세요.
            </p>
            <div className="overflow-auto flex-1 rounded-xl" style={{border:"1px solid #E5E7EB"}}>
              <table className="w-full text-[11px]">
                <thead><tr style={{background:"#F9FAFB"}}>
                  {["날짜","채널","노출","클릭","문의","등록","광고비"].map(h=>(
                    <th key={h} className="px-3 py-2 text-left font-semibold" style={{color:"#6B7280"}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {rows.map((r,i)=>(
                    <tr key={i} style={{borderTop:"1px solid #F3F4F6",background:i%2===0?"#FFF":"#FAFAFA"}}>
                      <td className="px-3 py-2" style={{color:"#111827"}}>{r.stat_date}</td>
                      <td className="px-3 py-2" style={{color:"#374151"}}>{r.channel}</td>
                      <td className="px-3 py-2" style={{color:"#374151"}}>{r.impressions.toLocaleString()}</td>
                      <td className="px-3 py-2" style={{color:"#374151"}}>{r.clicks.toLocaleString()}</td>
                      <td className="px-3 py-2" style={{color:"#374151"}}>{r.inquiries}</td>
                      <td className="px-3 py-2" style={{color:"#059669",fontWeight:600}}>{r.registrations}</td>
                      <td className="px-3 py-2" style={{color:"#EF3B2D"}}>{r.ad_cost.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center mt-4">
              <button onClick={()=>setRows([])} className="text-[12px]" style={{color:"#9CA3AF"}}>다시 선택</button>
              <div className="flex gap-2">
                <button onClick={onClose} className="rounded-xl px-4 py-2 text-[13px] font-semibold" style={{background:"#F3F4F6",color:"#6B7280"}}>취소</button>
                <button disabled={saving} onClick={save}
                  className="flex items-center gap-2 rounded-xl px-5 py-2 text-[13px] font-bold disabled:opacity-50"
                  style={{background:"#EF3B2D",color:"#FFF"}}>
                  <Upload size={14}/>{saving?"저장 중...":"DB에 저장"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────
export default function MarketingPage() {
  const [stats,setStats]=useState<StatRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [groupFilter,setGroupFilter]=useState("전체");
  const [branchFilter,setBranchFilter]=useState("전체");
  const [viewMode,setViewMode]=useState<"일별"|"월별">("일별");
  const [selectedMonth,setSelectedMonth]=useState(()=>new Date().toISOString().slice(0,7));
  const [modal,setModal]=useState<{open:boolean;item:Partial<StatRow>|null}>({open:false,item:null});
  const [excelModal,setExcelModal]=useState(false);
  const [chartMetric,setChartMetric]=useState<"clicks"|"registrations"|"ad_cost">("clicks");
  const {toast,notify}=useToast();

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const j=await fetch("/api/hq/marketing-stats").then(r=>r.json());
      const data=j.data??[];
      setStats(data);
      const ms=[...new Set((data as StatRow[]).map((s:StatRow)=>s.stat_date?.slice(0,7)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));
      if(ms.length>0){
        setSelectedMonth(prev=>ms.includes(prev)?prev:ms[0] as string);
      }
    }catch(e){console.error(e);notify("불러오기 실패",false);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  const del=async(s:StatRow)=>{
    if(!confirm("삭제하시겠습니까?"))return;
    const j=await fetch(`/api/hq/marketing-stats/${s.id}`,{method:"DELETE"}).then(r=>r.json());
    if(j.success){notify("삭제됐습니다.");load();}else notify("삭제 실패",false);
  };

  // 채널 그룹 필터
  const groupChannels = groupFilter==="전체" ? null : (CHANNEL_GROUPS[groupFilter]??null);
  const byGroup = stats.filter(s=>!groupChannels||groupChannels.includes(s.channel));

  // 지점 필터
  const byBranch = byGroup.filter(s=>
    branchFilter==="전체" || s.branch_name===branchFilter || (!s.branch_name&&branchFilter==="공통")
  );

  // 일별: 선택 월
  const dailyRows=byBranch.filter(s=>s.stat_date?.slice(0,7)===selectedMonth)
    .sort((a,b)=>b.stat_date.localeCompare(a.stat_date));

  // 월별 집계
  const monthlyMap: Record<string,{impressions:number;clicks:number;inquiries:number;registrations:number;ad_cost:number}>={};
  byBranch.forEach(s=>{
    const m=s.stat_date?.slice(0,7)??"";
    if(!m)return;
    if(!monthlyMap[m])monthlyMap[m]={impressions:0,clicks:0,inquiries:0,registrations:0,ad_cost:0};
    monthlyMap[m].impressions+=s.impressions;
    monthlyMap[m].clicks+=s.clicks;
    monthlyMap[m].inquiries+=s.inquiries;
    monthlyMap[m].registrations+=s.registrations;
    monthlyMap[m].ad_cost+=s.ad_cost;
  });
  const monthlyRows=Object.entries(monthlyMap).sort(([a],[b])=>b.localeCompare(a)).map(([month,v])=>({month,...v}));

  // KPI
  const kpiSource=viewMode==="일별"?dailyRows:byBranch;
  const totalImpr=kpiSource.reduce((s,r)=>s+r.impressions,0);
  const totalClicks=kpiSource.reduce((s,r)=>s+r.clicks,0);
  const totalInq=kpiSource.reduce((s,r)=>s+r.inquiries,0);
  const totalReg=kpiSource.reduce((s,r)=>s+r.registrations,0);
  const totalCost=kpiSource.reduce((s,r)=>s+r.ad_cost,0);
  const ctr=totalImpr>0?((totalClicks/totalImpr)*100).toFixed(2):"-";

  const months=[...new Set(stats.map(s=>s.stat_date?.slice(0,7)).filter(Boolean))].sort((a,b)=>b.localeCompare(a));

  // 현재 보이는 데이터 (차트/인사이트용)
  const visibleRows = viewMode==="일별" ? dailyRows : byBranch;

  // 지점 목록 (존재하는 것만)
  const existingBranches = [...new Set(stats.map(s=>s.branch_name).filter(Boolean))] as string[];

  return (
    <div className="max-w-[1360px] mx-auto space-y-5">
      <Toast toast={toast}/>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[20px] font-black tracking-tight" style={{color:"#111827"}}>마케팅 관리</h1>
          <p className="mt-0.5 text-[13px]" style={{color:"#6B7280"}}>채널별 마케팅 성과 데이터를 입력하고 분석합니다.</p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <button onClick={()=>setExcelModal(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold"
            style={{background:"#F3F4F6",color:"#374151"}}><FileSpreadsheet size={15}/> 엑셀 업로드</button>
          <button onClick={()=>setModal({open:true,item:null})}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold"
            style={{background:"#EF3B2D",color:"#FFF"}}><Plus size={15}/> 직접 입력</button>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* 일별/월별 */}
        <div className="flex rounded-xl overflow-hidden" style={{border:"1px solid #E5E7EB"}}>
          {(["일별","월별"] as const).map(m=>(
            <button key={m} onClick={()=>setViewMode(m)}
              className="px-5 py-2 text-[13px] font-bold transition-all"
              style={{background:viewMode===m?"#EF3B2D":"#FFF",color:viewMode===m?"#FFF":"#6B7280"}}>
              {m}
            </button>
          ))}
        </div>
        {/* 월 선택 */}
        {viewMode==="일별"&&(
          <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
            className="rounded-xl border px-3 py-2 text-[13px] outline-none"
            style={{borderColor:"#E5E7EB",color:"#111827",background:"#FFF"}}>
            {months.length===0
              ?<option value={selectedMonth}>{selectedMonth}</option>
              :months.map(m=><option key={m} value={m}>{m.replace("-","년 ")}월</option>)
            }
          </select>
        )}
        {/* 지점 드롭다운 */}
        <select value={branchFilter} onChange={e=>setBranchFilter(e.target.value)}
          className="rounded-xl border px-3 py-2 text-[13px] outline-none"
          style={{borderColor:"#E5E7EB",color:"#111827",background:"#FFF"}}>
          <option value="전체">전체 지점</option>
          {existingBranches.map(b=><option key={b} value={b}>{b}</option>)}
          <option value="공통">공통</option>
        </select>
      </div>

      {/* 채널 그룹 탭 */}
      <div className="flex flex-wrap gap-2">
        {GROUP_ORDER.filter(g=>{
          if(g==="전체") return true;
          // 해당 그룹의 채널이 실제 데이터에 있는 것만
          const chs=CHANNEL_GROUPS[g]??[];
          return stats.some(s=>chs.includes(s.channel));
        }).map(g=>(
          <button key={g} onClick={()=>setGroupFilter(g)}
            className="rounded-xl px-4 py-1.5 text-[12px] font-semibold transition-all"
            style={{background:groupFilter===g?"#EF3B2D":"#F3F4F6",color:groupFilter===g?"#FFF":"#6B7280"}}>
            {g}
          </button>
        ))}
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        {[
          {label:viewMode==="일별"?`${selectedMonth.replace("-","년 ")}월 노출`:"총 노출수",value:fmtN(totalImpr)},
          {label:"총 클릭수",value:fmtN(totalClicks)},
          {label:"CTR",value:`${ctr}%`},
          {label:"문의수",value:String(totalInq)},
          {label:"등록수",value:String(totalReg)},
        ].map(s=>(
          <div key={s.label} className="rounded-2xl border px-5 py-4 hover:shadow-md transition-all" style={CS}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{color:"#9CA3AF"}}>{s.label}</p>
            <p className="text-[24px] font-black leading-none" style={{color:"#111827"}}>{s.value}</p>
            <div className="mt-3 h-[2px] w-6 rounded-full" style={{background:"#EF3B2D"}}/>
          </div>
        ))}
      </div>

      {/* 광고비 카드 */}
      <div className="rounded-2xl border px-5 py-4" style={CS}>
        <p className="text-[12px] font-bold mb-3" style={{color:"#111827"}}>광고비 / 등록 비용</p>
        <div className="flex gap-6 flex-wrap">
          <div><p className="text-[10px]" style={{color:"#9CA3AF"}}>총 광고비</p>
            <p className="text-[18px] font-black" style={{color:"#EF3B2D"}}>{fmtW(totalCost)}</p></div>
          <div><p className="text-[10px]" style={{color:"#9CA3AF"}}>등록당 비용</p>
            <p className="text-[18px] font-black" style={{color:"#111827"}}>
              {totalReg>0?fmtW(Math.round(totalCost/totalReg)):"-"}
            </p></div>
          <div><p className="text-[10px]" style={{color:"#9CA3AF"}}>문의당 비용</p>
            <p className="text-[18px] font-black" style={{color:"#111827"}}>
              {totalInq>0?fmtW(Math.round(totalCost/totalInq)):"-"}
            </p></div>
        </div>
      </div>

      {/* 차트 섹션 */}
      {!loading && visibleRows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* 일별 트렌드 */}
          <div className="lg:col-span-2 rounded-2xl border p-5" style={CS}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-bold" style={{color:"#111827"}}>
                📈 {viewMode==="일별"?`${selectedMonth.replace("-","년 ")}월 일별 트렌드`:"월별 트렌드"}
              </p>
              <p className="text-[10px]" style={{color:"#9CA3AF"}}>
                <span style={{color:"#D1D5DB"}}>■</span> 노출 &nbsp;
                <span style={{color:"#EF3B2D"}}>■</span> 클릭
              </p>
            </div>
            <TrendChart rows={visibleRows}/>
          </div>
          {/* 채널별 */}
          <div className="rounded-2xl border p-5" style={CS}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-bold" style={{color:"#111827"}}>📊 채널별 성과</p>
              <div className="flex gap-1">
                {(["clicks","registrations","ad_cost"] as const).map(m=>(
                  <button key={m} onClick={()=>setChartMetric(m)}
                    className="rounded px-2 py-0.5 text-[10px] font-semibold"
                    style={{background:chartMetric===m?"#EF3B2D":"#F3F4F6",color:chartMetric===m?"#FFF":"#6B7280"}}>
                    {m==="clicks"?"클릭":m==="registrations"?"등록":"광고비"}
                  </button>
                ))}
              </div>
            </div>
            <ChannelChart rows={visibleRows} metric={chartMetric}/>
          </div>
        </div>
      )}

      {/* 지점별 차트 */}
      {!loading && visibleRows.length > 0 && branchFilter==="전체" && (
        <div className="grid gap-4 sm:grid-cols-3">
          {(["clicks","registrations","ad_cost"] as const).map(m=>(
            <div key={m} className="rounded-2xl border p-5" style={CS}>
              <p className="text-[12px] font-bold mb-3" style={{color:"#111827"}}>
                {m==="clicks"?"👆 지점별 클릭":m==="registrations"?"⭐ 지점별 등록":"💰 지점별 광고비"}
              </p>
              <BranchChart rows={visibleRows} metric={m}/>
            </div>
          ))}
        </div>
      )}

      {/* 인사이트 */}
      {!loading && <Insights rows={visibleRows}/>}

      {/* 테이블 */}
      {loading?(
        <div className="flex items-center justify-center py-20"><p className="text-[13px]" style={{color:"#9CA3AF"}}>불러오는 중…</p></div>
      ):viewMode==="월별"?(
        monthlyRows.length===0?(
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-3xl">📊</p><p className="text-[13px]" style={{color:"#9CA3AF"}}>통계 데이터가 없습니다.</p>
          </div>
        ):(
          <div className="rounded-2xl overflow-hidden" style={{border:"1px solid #E5E7EB"}}>
            <table className="w-full text-[12px]">
              <thead><tr style={{background:"#F9FAFB"}}>
                {["월","노출","클릭","CTR","문의","등록","광고비","등록당비용"].map(h=>(
                  <th key={h} className="px-4 py-3 text-left font-semibold" style={{color:"#6B7280"}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {monthlyRows.map((r,i)=>{
                  const ctrVal=r.impressions>0?((r.clicks/r.impressions)*100).toFixed(2):"-";
                  const cpa=r.registrations>0?fmtW(Math.round(r.ad_cost/r.registrations)):"-";
                  return (
                    <tr key={r.month} style={{borderTop:"1px solid #F3F4F6",background:i%2===0?"#FFF":"#FAFAFA"}}>
                      <td className="px-4 py-3 font-black" style={{color:"#111827"}}>{r.month.replace("-","년 ")}월</td>
                      <td className="px-4 py-3" style={{color:"#374151"}}>{fmtN(r.impressions)}</td>
                      <td className="px-4 py-3" style={{color:"#374151"}}>{fmtN(r.clicks)}</td>
                      <td className="px-4 py-3" style={{color:"#6B7280"}}>{ctrVal}%</td>
                      <td className="px-4 py-3" style={{color:"#374151"}}>{r.inquiries}</td>
                      <td className="px-4 py-3 font-bold" style={{color:"#059669"}}>{r.registrations}</td>
                      <td className="px-4 py-3 font-bold" style={{color:"#EF3B2D"}}>{fmtW(r.ad_cost)}</td>
                      <td className="px-4 py-3" style={{color:"#111827"}}>{cpa}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ):dailyRows.length===0?(
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="text-3xl">📊</p>
          <p className="text-[13px]" style={{color:"#9CA3AF"}}>{selectedMonth.replace("-","년 ")}월 데이터가 없습니다.</p>
        </div>
      ):(
        <div className="rounded-2xl overflow-hidden" style={{border:"1px solid #E5E7EB"}}>
          <table className="w-full text-[12px]">
            <thead><tr style={{background:"#F9FAFB"}}>
              {["날짜","채널","지점","노출","클릭","문의","등록","광고비","메모",""].map(h=>(
                <th key={h} className="px-4 py-3 text-left font-semibold" style={{color:"#6B7280"}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {dailyRows.map((s,i)=>{
                const bc=s.branch_name?(BC[s.branch_name]??"#6B7280"):"#9CA3AF";
                return (
                  <tr key={s.id} style={{borderTop:"1px solid #F3F4F6",background:i%2===0?"#FFF":"#FAFAFA"}}>
                    <td className="px-4 py-3 font-medium" style={{color:"#111827"}}>{s.stat_date?.slice(0,10)}</td>
                    <td className="px-4 py-3" style={{color:"#374151"}}>{s.channel}</td>
                    <td className="px-4 py-3">
                      {s.branch_name
                        ?<span className="text-[10px] font-semibold rounded-md px-2 py-0.5" style={{background:`${bc}14`,color:bc}}>{s.branch_name}</span>
                        :<span className="text-[10px]" style={{color:"#9CA3AF"}}>공통</span>}
                    </td>
                    <td className="px-4 py-3" style={{color:"#374151"}}>{fmtN(s.impressions)}</td>
                    <td className="px-4 py-3" style={{color:"#374151"}}>{fmtN(s.clicks)}</td>
                    <td className="px-4 py-3" style={{color:"#374151"}}>{s.inquiries}</td>
                    <td className="px-4 py-3 font-bold" style={{color:"#059669"}}>{s.registrations}</td>
                    <td className="px-4 py-3 font-bold" style={{color:"#EF3B2D"}}>{fmtW(s.ad_cost)}</td>
                    <td className="px-4 py-3" style={{color:"#9CA3AF"}}>{s.memo??""}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={()=>setModal({open:true,item:s})} className="p-1 rounded hover:bg-gray-100" style={{color:"#9CA3AF"}}><Save size={12}/></button>
                        <button onClick={()=>del(s)} className="p-1 rounded" style={{color:"#EF3B2D"}}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal.open&&<StatModal item={modal.item} onClose={()=>setModal({open:false,item:null})} onSave={()=>{load();notify("저장됐습니다.");}}/>}
      {excelModal&&<ExcelModal onClose={()=>setExcelModal(false)} onSave={()=>{load();notify(`엑셀 데이터 저장 완료!`);}}/>}
    </div>
  );
}
