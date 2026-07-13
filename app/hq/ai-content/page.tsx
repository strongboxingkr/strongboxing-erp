"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Sparkles, RefreshCw, Copy, Check, ChevronDown, AlertCircle,
  ExternalLink, CheckSquare, Square,
} from "lucide-react";
import { Toast, useToast } from "@/app/components/hq/Toast";

// ── shared ─────────────────────────────────────────────────────────────────
interface Branch { id: number; name: string }
const CS = { background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" } as const;

function CopyBtn({ text, label = "복사" }: { text: string; label?: string }) {
  const [c, setC] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setC(true); setTimeout(() => setC(false), 1200); }}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all"
      style={{ background: c ? "rgba(16,185,129,0.1)" : "#F3F4F6", color: c ? "#059669" : "#6B7280" }}>
      {c ? <Check size={12} /> : <Copy size={12} />} {c ? "복사됨" : label}
    </button>
  );
}

function ResultBox({ label, value }: { label: string; value: string }) {
  const [open, setOpen] = useState(true);
  if (!value) return null;
  return (
    <div className="rounded-2xl overflow-hidden" style={CS}>
      <div className="flex items-center justify-between px-5 py-3 cursor-pointer"
        style={{ borderBottom: open ? "1px solid #F3F4F6" : "none" }}
        onClick={() => setOpen(p => !p)}>
        <p className="text-[12px] font-bold" style={{ color: "#111827" }}>{label}</p>
        <div className="flex items-center gap-2">
          <CopyBtn text={value} />
          <ChevronDown size={14} color="#9CA3AF" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </div>
      {open && <p className="px-5 py-4 text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "#374151" }}>{value}</p>}
    </div>
  );
}

// ── SNS content tab ────────────────────────────────────────────────────────
const SNS_TYPES   = ["릴스", "네이버클립", "블로그", "당근", "카카오", "인스타"];
const SNS_TARGETS = ["학생", "여성", "직장인", "다이어트", "키즈", "초보자", "일반"];
const SNS_MOODS   = ["자연스럽게", "짧게", "홍보스럽지 않게", "학부모용", "개인계정 느낌", "활기차게"];

function SnsTab({ branches }: { branches: Branch[] }) {
  const [f, setF] = useState({ branch_id: "", type: "릴스", target: "일반", mood: "자연스럽게", prompt: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ insta?: string; clip_title?: string; blog?: string; hashtags?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { toast, notify } = useToast();

  const upd = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF(p => ({ ...p, [k]: e.target.value }));
  const inp = "w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-red-400 transition-colors";
  const ist = { borderColor: "#E5E7EB", color: "#111827", background: "#FAFAFA" };
  const lbl = "block text-[11px] font-semibold mb-1.5 uppercase tracking-widest";

  const generate = async () => {
    if (!f.prompt.trim()) { notify("내용을 입력해주세요.", false); return; }
    setLoading(true); setResult(null); setErrorMsg(null);
    try {
      const branch = branches.find(b => String(b.id) === f.branch_id);
      const r = await fetch("/api/hq/ai-content", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: branch?.name ?? "스트롱복싱", type: f.type, target: f.target, mood: f.mood, prompt: f.prompt }),
      });
      const j = await r.json();
      if (j.success && j.data) { setResult(j.data); notify("AI 생성 완료!"); }
      else { setErrorMsg(j.message ?? "알 수 없는 오류"); notify("생성 실패", false); }
    } catch (e: any) { setErrorMsg(e?.message ?? "네트워크 오류"); notify("네트워크 오류", false); }
    finally { setLoading(false); }
  };

  const examples = [
    "목동점 학생 복싱 체험반 모집, 방학 특강 홍보용",
    "신정점 여성 전용 반 오픈, 초보자 환영 분위기",
    "영등포점 샌드백 트레이닝 영상, 다이어트 효과 강조",
    "5개 지점 통합 여름 이벤트, 첫 달 50% 할인",
  ];

  return (
    <>
      <Toast toast={toast} />
      <div className="rounded-2xl p-6 space-y-4" style={CS}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div><label className={lbl} style={{ color: "#9CA3AF" }}>지점</label>
            <select className={inp} style={ist} value={f.branch_id} onChange={upd("branch_id")}>
              <option value="">스트롱복싱 (공통)</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div><label className={lbl} style={{ color: "#9CA3AF" }}>플랫폼</label>
            <select className={inp} style={ist} value={f.type} onChange={upd("type")}>
              {SNS_TYPES.map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div><label className={lbl} style={{ color: "#9CA3AF" }}>타겟</label>
            <select className={inp} style={ist} value={f.target} onChange={upd("target")}>
              {SNS_TARGETS.map(t => <option key={t}>{t}</option>)}
            </select></div>
        </div>
        <div><label className={lbl} style={{ color: "#9CA3AF" }}>분위기</label>
          <div className="flex flex-wrap gap-2">
            {SNS_MOODS.map(m => (
              <button key={m} onClick={() => setF(p => ({ ...p, mood: m }))}
                className="rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all"
                style={{ background: f.mood === m ? "#EF3B2D" : "#F3F4F6", color: f.mood === m ? "#FFF" : "#6B7280" }}>{m}</button>
            ))}
          </div>
        </div>
        <div>
          <label className={lbl} style={{ color: "#9CA3AF" }}>콘텐츠 내용 *</label>
          <textarea className={inp} style={ist} rows={4} value={f.prompt} onChange={upd("prompt")}
            placeholder="예: 목동점 여름방학 학생 복싱 체험반 모집. 초보자도 쉽게 배울 수 있음." />
        </div>
        <div>
          <p className="text-[11px] font-semibold mb-2" style={{ color: "#9CA3AF" }}>예시 (클릭하면 채워짐)</p>
          <div className="flex flex-wrap gap-2">
            {examples.map(ex => (
              <button key={ex} onClick={() => setF(p => ({ ...p, prompt: ex }))}
                className="rounded-xl px-3 py-1.5 text-[11px] transition-all hover:bg-gray-100"
                style={{ background: "#F9FAFB", color: "#374151", border: "1px solid #E5E7EB" }}>{ex}</button>
            ))}
          </div>
        </div>
        <button onClick={generate} disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-black disabled:opacity-50 transition-all"
          style={{ background: "#EF3B2D", color: "#FFF" }}>
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? "AI가 생성 중입니다..." : "콘텐츠 생성"}
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <AlertCircle size={16} color="#EF3B2D" className="shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-bold" style={{ color: "#EF3B2D" }}>AI 생성 실패</p>
            <p className="text-[12px] mt-1" style={{ color: "#7F1D1D" }}>{errorMsg}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <p className="text-[12px] font-bold" style={{ color: "#059669" }}>✅ 생성 완료</p>
          <ResultBox label="📸 인스타그램 게시글" value={result.insta ?? ""} />
          <ResultBox label="🎬 네이버 클립 제목" value={result.clip_title ?? ""} />
          <ResultBox label="📝 블로그 초안" value={result.blog ?? ""} />
          <ResultBox label="#️⃣ 해시태그" value={result.hashtags ?? ""} />
          {result.hashtags && result.insta && (
            <CopyBtn text={`${result.insta}\n\n${result.hashtags}`} label="인스타+해시태그 한 번에 복사" />
          )}
        </div>
      )}
    </>
  );
}

// ── SEO blog tab ───────────────────────────────────────────────────────────
const SEO_BRANCHES = ["목동점", "철산점", "개봉점", "신정점", "영등포점"];

const SEO_BRANCH_DEFAULTS: Record<string, { main: string; sub: string }> = {
  목동점:   { main: "목동 복싱장",    sub: "오목교 복싱, 목5동 운동, 양천구 복싱" },
  철산점:   { main: "철산 복싱장",    sub: "철산동 복싱, 광명 복싱, 철산 운동" },
  개봉점:   { main: "개봉 복싱장",    sub: "개봉동 복싱, 고척동 복싱, 구로 복싱" },
  신정점:   { main: "신정동 복싱장",  sub: "신정 복싱, 양천구 복싱, 신정동 운동" },
  영등포점: { main: "영등포 복싱장",  sub: "도림동 복싱, 영등포 운동, 영등포구 복싱" },
};

const SEO_TOPICS = [
  "초보자가 처음 복싱을 시작하기 좋은 수업 분위기",
  "다이어트 복싱",
  "여성 회원 운동",
  "학생 운동",
  "직장인 체력관리",
  "미트 운동",
  "샌드백 운동",
  "스파링/파트너 운동",
  "처음 방문 안내",
  "준비물 안내",
  "키즈/어린이 복싱",
];

const CHECKLIST = [
  "제목에 지역명 + 복싱장이 들어갔는가?",
  "description이 80자 이내인가?",
  "slug가 영어 소문자와 하이픈으로만 되어 있는가?",
  "본문 첫 문단에 메인 키워드가 자연스럽게 들어갔는가?",
  "H2 소제목이 3개 이상 있는가?",
  "FAQ가 3개 포함됐는가?",
  "이미지 alt가 비어 있지 않은가?",
  "해당 지점 페이지 내부 링크가 포함됐는가?",
  "sitemap에 포함될 수 있는 공개 글인가?",
];

interface SeoResult {
  titles: string[];
  best_title: string;
  description: string;
  slug: string;
  body: string;
  faq: { q: string; a: string }[];
  image_alts: string[];
  internal_link_text: string;
  internal_link_url: string;
  url_preview: string;
}

function SeoTab() {
  const [branch, setBranch] = useState("목동점");
  const [mainKw, setMainKw] = useState(SEO_BRANCH_DEFAULTS["목동점"].main);
  const [subKw, setSubKw] = useState(SEO_BRANCH_DEFAULTS["목동점"].sub);
  const [topic, setTopic] = useState(SEO_TOPICS[0]);
  const [photoDesc, setPhotoDesc] = useState("");
  const [emphasis, setEmphasis] = useState("");
  const [excludeExpr, setExcludeExpr] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeoResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const { toast, notify } = useToast();

  function onBranchChange(b: string) {
    setBranch(b);
    const def = SEO_BRANCH_DEFAULTS[b];
    if (def) { setMainKw(def.main); setSubKw(def.sub); }
  }

  const inp = "w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:border-red-400 transition-colors";
  const ist = { borderColor: "#E5E7EB", color: "#111827", background: "#FAFAFA" };
  const lbl = "block text-[11px] font-semibold mb-1.5 uppercase tracking-widest";

  const generate = async () => {
    if (!topic.trim()) { notify("글 주제를 선택해주세요.", false); return; }
    setLoading(true); setResult(null); setErrorMsg(null);
    setChecked(CHECKLIST.map(() => false));
    try {
      const r = await fetch("/api/hq/ai-seo-blog", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch_name: branch, main_keyword: mainKw, sub_keywords: subKw, topic, photo_desc: photoDesc, emphasis, exclude_expr: excludeExpr }),
      });
      const j = await r.json();
      if (j.success && j.data) { setResult(j.data); notify("SEO 글 생성 완료!"); }
      else { setErrorMsg(j.message ?? "알 수 없는 오류"); notify("생성 실패", false); }
    } catch (e: any) { setErrorMsg(e?.message ?? "네트워크 오류"); notify("네트워크 오류", false); }
    finally { setLoading(false); }
  };

  const toggleCheck = (i: number) => setChecked(p => p.map((v, idx) => idx === i ? !v : v));

  return (
    <>
      <Toast toast={toast} />

      {/* 입력 폼 */}
      <div className="rounded-2xl p-6 space-y-5" style={CS}>
        <p className="text-[12px] font-bold" style={{ color: "#6B7280" }}>지점을 선택하면 기본 키워드가 자동으로 채워집니다.</p>

        {/* 지점 */}
        <div>
          <label className={lbl} style={{ color: "#9CA3AF" }}>지점 *</label>
          <div className="flex flex-wrap gap-2">
            {SEO_BRANCHES.map(b => (
              <button key={b} onClick={() => onBranchChange(b)}
                className="rounded-xl px-4 py-2 text-[13px] font-bold transition-all"
                style={{ background: branch === b ? "#EF3B2D" : "#F3F4F6", color: branch === b ? "#FFF" : "#374151" }}>
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* 키워드 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl} style={{ color: "#9CA3AF" }}>메인 키워드 *</label>
            <input className={inp} style={ist} value={mainKw} onChange={e => setMainKw(e.target.value)} placeholder="예: 목동 복싱장" />
          </div>
          <div>
            <label className={lbl} style={{ color: "#9CA3AF" }}>보조 키워드</label>
            <input className={inp} style={ist} value={subKw} onChange={e => setSubKw(e.target.value)} placeholder="예: 오목교 복싱, 목5동 운동" />
          </div>
        </div>

        {/* 글 주제 */}
        <div>
          <label className={lbl} style={{ color: "#9CA3AF" }}>글 주제 *</label>
          <select className={inp} style={ist} value={topic} onChange={e => setTopic(e.target.value)}>
            {SEO_TOPICS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* 선택 입력 */}
        <details className="group">
          <summary className="cursor-pointer text-[12px] font-semibold select-none" style={{ color: "#9CA3AF" }}>
            선택 입력 (사진 설명 / 강조 / 제외 표현)
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className={lbl} style={{ color: "#9CA3AF" }}>첨부할 사진/영상 설명</label>
              <input className={inp} style={ist} value={photoDesc} onChange={e => setPhotoDesc(e.target.value)} placeholder="예: 미트 운동 영상, 수업 후 단체 사진" />
            </div>
            <div>
              <label className={lbl} style={{ color: "#9CA3AF" }}>강조하고 싶은 분위기</label>
              <input className={inp} style={ist} value={emphasis} onChange={e => setEmphasis(e.target.value)} placeholder="예: 조용하고 집중되는 분위기, 밝고 활기찬 분위기" />
            </div>
            <div>
              <label className={lbl} style={{ color: "#9CA3AF" }}>제외하고 싶은 표현</label>
              <input className={inp} style={ist} value={excludeExpr} onChange={e => setExcludeExpr(e.target.value)} placeholder="예: 스파링, 선수" />
            </div>
          </div>
        </details>

        <button onClick={generate} disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-black disabled:opacity-50 transition-all"
          style={{ background: "#EF3B2D", color: "#FFF" }}>
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {loading ? "SEO 글 생성 중..." : "SEO 블로그 글 생성"}
        </button>
      </div>

      {/* 에러 */}
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-2xl p-4" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <AlertCircle size={16} color="#EF3B2D" className="shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-bold" style={{ color: "#EF3B2D" }}>생성 실패</p>
            <p className="text-[12px] mt-1" style={{ color: "#7F1D1D" }}>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div className="space-y-4">
          <p className="text-[12px] font-bold" style={{ color: "#059669" }}>✅ SEO 글 생성 완료</p>

          {/* 제목 후보 3개 */}
          <div className="rounded-2xl p-5 space-y-3" style={CS}>
            <p className="text-[12px] font-bold" style={{ color: "#111827" }}>📋 제목 후보 3개</p>
            {result.titles?.map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <span className="text-[13px] flex-1" style={{ color: "#374151" }}>{i + 1}. {t}</span>
                <CopyBtn text={t} />
              </div>
            ))}
          </div>

          {/* 최종 추천 제목 */}
          <div className="rounded-2xl p-5" style={{ ...CS, background: "#F0FDF4", borderColor: "#BBF7D0" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold" style={{ color: "#059669" }}>⭐ 최종 추천 제목</p>
              <CopyBtn text={result.best_title ?? ""} />
            </div>
            <p className="text-[14px] font-bold" style={{ color: "#111827" }}>{result.best_title}</p>
          </div>

          {/* description */}
          <div className="rounded-2xl p-5" style={CS}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold" style={{ color: "#111827" }}>🔍 Meta Description</p>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: (result.description?.length ?? 0) > 80 ? "#EF3B2D" : "#9CA3AF" }}>
                  {result.description?.length ?? 0}자 {(result.description?.length ?? 0) > 80 ? "⚠️ 초과" : "✅"}
                </span>
                <CopyBtn text={result.description ?? ""} />
              </div>
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: "#374151" }}>{result.description}</p>
          </div>

          {/* slug */}
          <div className="rounded-2xl p-5" style={CS}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold" style={{ color: "#111827" }}>🔗 Slug</p>
              <CopyBtn text={result.slug ?? ""} />
            </div>
            <code className="text-[13px]" style={{ color: "#374151" }}>{result.slug}</code>
          </div>

          {/* 본문 */}
          <ResultBox label="📝 본문 (900~1200자)" value={result.body ?? ""} />

          {/* FAQ */}
          {result.faq?.length > 0 && (
            <div className="rounded-2xl p-5 space-y-3" style={CS}>
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold" style={{ color: "#111827" }}>❓ FAQ 3개</p>
                <CopyBtn text={result.faq.map(f => `Q. ${f.q}\nA. ${f.a}`).join("\n\n")} label="전체 복사" />
              </div>
              {result.faq.map((f, i) => (
                <div key={i} className="rounded-xl p-4" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                  <p className="text-[12px] font-bold mb-1" style={{ color: "#374151" }}>Q{i + 1}. {f.q}</p>
                  <p className="text-[12px]" style={{ color: "#6B7280" }}>{f.a}</p>
                </div>
              ))}
            </div>
          )}

          {/* 이미지 alt */}
          {result.image_alts?.length > 0 && (
            <div className="rounded-2xl p-5 space-y-2" style={CS}>
              <p className="text-[12px] font-bold mb-2" style={{ color: "#111827" }}>🖼️ 이미지 Alt 추천</p>
              {result.image_alts.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                  <span className="text-[12px] flex-1" style={{ color: "#374151" }}>{i + 1}. {a}</span>
                  <CopyBtn text={a} />
                </div>
              ))}
            </div>
          )}

          {/* 내부 링크 */}
          <div className="rounded-2xl p-5" style={CS}>
            <p className="text-[12px] font-bold mb-3" style={{ color: "#111827" }}>🔗 내부 링크 (지점 페이지)</p>
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: "#374151" }}>{result.internal_link_text}</p>
                <p className="text-[11px] mt-0.5" style={{ color: "#9CA3AF" }}>https://strongboxing.kr{result.internal_link_url}</p>
              </div>
              <CopyBtn text={`[${result.internal_link_text}](https://strongboxing.kr${result.internal_link_url})`} />
            </div>
          </div>

          {/* URL 미리보기 + 색인 안내 */}
          <div className="rounded-2xl p-5 space-y-3" style={{ ...CS, background: "#EFF6FF", borderColor: "#BFDBFE" }}>
            <p className="text-[12px] font-bold" style={{ color: "#1D4ED8" }}>📡 발행 후 색인 요청</p>
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "#FFF", border: "1px solid #BFDBFE" }}>
              <code className="text-[12px]" style={{ color: "#374151" }}>{result.url_preview}</code>
              <CopyBtn text={result.url_preview ?? ""} label="URL 복사" />
            </div>
            <ol className="space-y-1 pl-4">
              {[
                "네이버 서치어드바이저 → URL 수집 요청",
                "구글 서치콘솔 → 대표 글만 색인 생성 요청",
                "3~7일 뒤 site:strongboxing.kr 검색으로 노출 확인",
              ].map((s, i) => (
                <li key={i} className="text-[12px]" style={{ color: "#1E40AF" }}>{i + 1}. {s}</li>
              ))}
            </ol>
          </div>

          {/* 발행 전 체크리스트 */}
          <div className="rounded-2xl p-5 space-y-3" style={CS}>
            <p className="text-[12px] font-bold mb-1" style={{ color: "#111827" }}>✅ 발행 전 체크리스트</p>
            {CHECKLIST.map((item, i) => (
              <button key={i} onClick={() => toggleCheck(i)}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:bg-gray-50"
                style={{ border: "1px solid #E5E7EB" }}>
                {checked[i]
                  ? <CheckSquare size={16} color="#059669" className="shrink-0" />
                  : <Square size={16} color="#D1D5DB" className="shrink-0" />}
                <span className="text-[12px]" style={{ color: checked[i] ? "#059669" : "#374151", textDecoration: checked[i] ? "line-through" : "none" }}>{item}</span>
              </button>
            ))}
            <div className="rounded-lg px-4 py-2 mt-1" style={{ background: "#F0FDF4" }}>
              <span className="text-[12px] font-bold" style={{ color: "#059669" }}>
                {checked.filter(Boolean).length} / {CHECKLIST.length} 완료
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── main page ──────────────────────────────────────────────────────────────
export default function AiContentPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tab, setTab] = useState<"sns" | "seo">("seo");

  const loadBranches = useCallback(async () => {
    const j = await fetch("/api/hq/branches").then(r => r.json());
    setBranches(j.data ?? []);
  }, []);
  useEffect(() => { loadBranches(); }, [loadBranches]);

  return (
    <div className="max-w-[900px] mx-auto space-y-6">
      <div>
        <h1 className="text-[20px] font-black tracking-tight" style={{ color: "#111827" }}>AI 콘텐츠 생성</h1>
        <p className="mt-0.5 text-[13px]" style={{ color: "#6B7280" }}>SEO 블로그 글 또는 SNS 콘텐츠를 AI로 생성합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "#F3F4F6" }}>
        {([
          { key: "seo", label: "🔍 SEO 블로그 글" },
          { key: "sns", label: "📱 SNS 콘텐츠" },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex-1 rounded-lg py-2 text-[13px] font-bold transition-all"
            style={{
              background: tab === key ? "#FFF" : "transparent",
              color: tab === key ? "#111827" : "#6B7280",
              boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "seo" ? <SeoTab /> : <SnsTab branches={branches} />}
    </div>
  );
}
