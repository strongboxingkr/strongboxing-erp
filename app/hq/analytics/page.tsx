"use client";
import { useEffect, useState, useCallback } from "react";
import { Toast, useToast } from "@/app/components/hq/Toast";

interface KPI { label:string; value:string; unit:string; color:string }
interface ChannelStat { channel:string; impressions:number; clicks:number; inquiries:number; registrations:number; ad_cost:number }
interface BranchStat { branch:string; tasks_done:number; tasks_total:number; content_done:number; content_total:number }

const CS = { background:"#FFFFFF", border:"1px solid #E5E7EB", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" } as const;
const BR_COLORS = ["#EF3B2D","#8B5CF6","#10B981","#3B82F6","#F59E0B"];

function fmtN(n:number){return n>=10000?`${(n/10000).toFixed(1)}만`:n.toLocaleString();}
function fmtW(n:number){return n>=10000?`${(n/10000).toFixed(0)}만원`:`${n.toLocaleString()}원`;}

function Bar({pct,color}:{pct:number;color:string}){
  return (
    <div className="w-full h-2 rounded-full" style={{background:"#F3F4F6"}}>
      <div className="h-2 rounded-full transition-all" style={{width:`${Math.min(pct,100)}%`,background:color}}/>
    </div>
  );
}

export default function AnalyticsPage() {
  const [mktStats,setMktStats]=useState<ChannelStat[]>([]);
  const [branchStats,setBranchStats]=useState<BranchStat[]>([]);
  const [loading,setLoading]=useState(true);
  const {toast,notify}=useToast();

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [mr,tr,cr,br]=await Promise.all([
        fetch("/api/hq/marketing-stats").then(r=>r.json()),
        fetch("/api/hq/staff-tasks").then(r=>r.json()),
        fetch("/api/hq/content-projects").then(r=>r.json()),
        fetch("/api/hq/branches").then(r=>r.json()),
      ]);

      // Aggregate marketing by channel
      const mktRaw: any[] = mr.data ?? [];
      const byChannel: Record<string,ChannelStat> = {};
      for(const s of mktRaw){
        if(!byChannel[s.channel]) byChannel[s.channel]={channel:s.channel,impressions:0,clicks:0,inquiries:0,registrations:0,ad_cost:0};
        byChannel[s.channel].impressions+=Number(s.impressions)||0;
        byChannel[s.channel].clicks+=Number(s.clicks)||0;
        byChannel[s.channel].inquiries+=Number(s.inquiries)||0;
        byChannel[s.channel].registrations+=Number(s.registrations)||0;
        byChannel[s.channel].ad_cost+=Number(s.ad_cost)||0;
      }
      setMktStats(Object.values(byChannel).sort((a,b)=>b.impressions-a.impressions));

      // Aggregate by branch
      const tasks: any[]=tr.data??[];
      const contents: any[]=cr.data??[];
      const branches: any[]=br.data??[];
      const bStats: BranchStat[]=branches.map((b:any)=>{
        const bt=tasks.filter((t:any)=>t.branch_id===b.id);
        const bc=contents.filter((c:any)=>c.branch_id===b.id);
        return {
          branch:b.name,
          tasks_done:bt.filter((t:any)=>t.is_done).length,
          tasks_total:bt.length,
          content_done:bc.filter((c:any)=>c.status==="업로드완료").length,
          content_total:bc.length,
        };
      });
      setBranchStats(bStats);
    }catch(e){console.error(e);notify("불러오기 실패",false);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  const totalImpr=mktStats.reduce((s,r)=>s+r.impressions,0);
  const totalClicks=mktStats.reduce((s,r)=>s+r.clicks,0);
  const totalReg=mktStats.reduce((s,r)=>s+r.registrations,0);
  const totalCost=mktStats.reduce((s,r)=>s+r.ad_cost,0);

  const kpis:KPI[]=[
    {label:"총 노출수",value:fmtN(totalImpr),unit:"",color:"#3B82F6"},
    {label:"총 클릭수",value:fmtN(totalClicks),unit:"",color:"#8B5CF6"},
    {label:"등록수",value:String(totalReg),unit:"건",color:"#059669"},
    {label:"총 광고비",value:fmtW(totalCost),unit:"",color:"#EF3B2D"},
    {label:"CTR",value:totalImpr>0?((totalClicks/totalImpr)*100).toFixed(2):"-",unit:"%",color:"#D97706"},
  ];

  const maxImpr=Math.max(...mktStats.map(s=>s.impressions),1);

  return (
    <div className="max-w-[1360px] mx-auto space-y-6">
      <Toast toast={toast}/>
      <div>
        <h1 className="text-[20px] font-black tracking-tight" style={{color:"#111827"}}>분석</h1>
        <p className="mt-0.5 text-[13px]" style={{color:"#6B7280"}}>마케팅, 콘텐츠, 업무 데이터를 한눈에 확인합니다.</p>
      </div>

      {loading?(
        <div className="flex items-center justify-center py-20"><p className="text-[13px]" style={{color:"#9CA3AF"}}>불러오는 중…</p></div>
      ):(
        <>
          {/* KPI 카드 */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
            {kpis.map(k=>(
              <div key={k.label} className="rounded-2xl border px-5 py-4 hover:shadow-md transition-all" style={CS}>
                <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{color:"#9CA3AF"}}>{k.label}</p>
                <div className="flex items-end gap-1">
                  <span className="text-[24px] font-black leading-none" style={{color:"#111827"}}>{k.value}</span>
                  {k.unit&&<span className="text-[12px] font-semibold mb-0.5" style={{color:"#6B7280"}}>{k.unit}</span>}
                </div>
                <div className="mt-3 h-[2px] w-6 rounded-full" style={{background:k.color}}/>
              </div>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            {/* 채널별 마케팅 성과 */}
            <div className="rounded-2xl p-6" style={CS}>
              <p className="text-[14px] font-black mb-5" style={{color:"#111827"}}>채널별 성과</p>
              {mktStats.length===0
                ?<p className="text-center py-8 text-[13px]" style={{color:"#9CA3AF"}}>마케팅 통계 데이터가 없습니다.</p>
                :<div className="space-y-4">
                  {mktStats.map((s,i)=>(
                    <div key={s.channel}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{background:BR_COLORS[i%BR_COLORS.length]}}/>
                          <span className="text-[13px] font-semibold" style={{color:"#111827"}}>{s.channel}</span>
                        </div>
                        <div className="flex gap-4 text-[11px]" style={{color:"#6B7280"}}>
                          <span>노출 {fmtN(s.impressions)}</span>
                          <span>등록 {s.registrations}</span>
                          <span>광고비 {fmtW(s.ad_cost)}</span>
                        </div>
                      </div>
                      <Bar pct={(s.impressions/maxImpr)*100} color={BR_COLORS[i%BR_COLORS.length]}/>
                    </div>
                  ))}
                </div>
              }
            </div>

            {/* 지점별 현황 */}
            <div className="rounded-2xl p-6" style={CS}>
              <p className="text-[14px] font-black mb-5" style={{color:"#111827"}}>지점별 운영 현황</p>
              {branchStats.length===0
                ?<p className="text-center py-8 text-[13px]" style={{color:"#9CA3AF"}}>데이터가 없습니다.</p>
                :<div className="space-y-4">
                  {branchStats.map((b,i)=>{
                    const taskPct=b.tasks_total>0?Math.round(b.tasks_done/b.tasks_total*100):0;
                    const contPct=b.content_total>0?Math.round(b.content_done/b.content_total*100):0;
                    return (
                      <div key={b.branch} className="rounded-xl p-4" style={{background:"#F9FAFB"}}>
                        <p className="text-[13px] font-bold mb-3" style={{color:BR_COLORS[i%BR_COLORS.length]}}>📍{b.branch}</p>
                        <div className="space-y-2">
                          <div>
                            <div className="flex justify-between text-[11px] mb-1" style={{color:"#6B7280"}}>
                              <span>업무 완료율</span><span>{b.tasks_done}/{b.tasks_total} ({taskPct}%)</span>
                            </div>
                            <Bar pct={taskPct} color={BR_COLORS[i%BR_COLORS.length]}/>
                          </div>
                          <div>
                            <div className="flex justify-between text-[11px] mb-1" style={{color:"#6B7280"}}>
                              <span>콘텐츠 업로드율</span><span>{b.content_done}/{b.content_total} ({contPct}%)</span>
                            </div>
                            <Bar pct={contPct} color={`${BR_COLORS[i%BR_COLORS.length]}99`}/>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}
