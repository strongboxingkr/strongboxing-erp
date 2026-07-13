import OpenAI from "openai";
import { NextRequest } from "next/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ok  = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

const BRANCH_DATA: Record<string, {
  area: string; hours: string;
  branchUrl: string; linkCta: string;
  defaultMain: string; defaultSub: string;
}> = {
  목동점:   { area: "서울시 양천구 목동·오목교",     hours: "월-금 14:00~00:00, 토 11:00~16:00",         branchUrl: "/branches/mokdong",       linkCta: "목동 복싱장 수업 안내 보기",        defaultMain: "목동 복싱장",   defaultSub: "오목교 복싱, 목5동 운동, 양천구 복싱" },
  철산점:   { area: "경기도 광명시 철산동",           hours: "월-금 14:00~23:00, 토·일 14:00~18:00",      branchUrl: "/branches/cheolsan",      linkCta: "철산 복싱장 위치와 운영시간 보기",   defaultMain: "철산 복싱장",   defaultSub: "철산동 복싱, 광명 복싱, 철산 운동" },
  개봉점:   { area: "서울시 구로구 개봉동·고척동",    hours: "월-금 13:00~23:00",                          branchUrl: "/branches/gaebong",       linkCta: "개봉 복싱장 상담 예약하기",          defaultMain: "개봉 복싱장",   defaultSub: "개봉동 복싱, 고척동 복싱, 구로 복싱" },
  신정점:   { area: "서울시 양천구 신정동",           hours: "월-금 10:00~00:00, 토 10:00~16:00",          branchUrl: "/branches/sinjeong",      linkCta: "신정동 복싱장 수업 분위기 보기",     defaultMain: "신정동 복싱장", defaultSub: "신정 복싱, 양천구 복싱, 신정동 운동" },
  영등포점: { area: "서울시 영등포구 도림동",         hours: "월-금 13:00~23:00",                          branchUrl: "/branches/yeongdeungpo",  linkCta: "영등포 복싱장 상담 안내 보기",       defaultMain: "영등포 복싱장", defaultSub: "도림동 복싱, 영등포 운동, 영등포구 복싱" },
};

export async function POST(req: NextRequest) {
  try {
    const { branch_name, main_keyword, sub_keywords, topic, photo_desc, emphasis, exclude_expr } = await req.json();

    if (!process.env.OPENAI_API_KEY) return err("OPENAI_API_KEY 환경변수가 없습니다.");
    if (!branch_name || !main_keyword || !topic) return err("지점명, 메인 키워드, 글 주제는 필수입니다.", 400);

    const branch = BRANCH_DATA[branch_name];
    if (!branch) return err("잘못된 지점명입니다.", 400);

    const subKw = sub_keywords?.trim() || branch.defaultSub;

    const prompt = `스트롱복싱 홈페이지 블로그용 SEO 글을 작성해주세요.

━━━ 기본 정보 ━━━
지점: ${branch_name}
지역: ${branch.area}
운영시간: ${branch.hours}
메인 키워드: ${main_keyword}
보조 키워드: ${subKw}
글 주제: ${topic}
타깃: 복싱이 처음인 초보자, 여성, 학생, 직장인, 다이어트 목적 회원
${photo_desc ? `사진/영상 설명: ${photo_desc}` : ""}
${emphasis ? `강조 사항: ${emphasis}` : ""}
${exclude_expr ? `추가로 제외할 표현: ${exclude_expr}` : ""}

━━━ 글 시작 고정 문구 (반드시 본문 맨 앞 두 줄 — 형식 절대 변경 금지) ━━━
안녕하세요 😊
스트롱복싱 ${branch_name}입니다💪

위 두 줄을 그대로 body 맨 앞에 넣어야 합니다.
"안녕하세요, 스트롱복싱입니다."처럼 줄이거나 합치지 마세요.
이모지 😊 💪 는 반드시 그대로 사용하세요.

━━━ 말투 규칙 ━━━
- 네이버 블로그에 올리는 동네 체육관 소식처럼 자연스럽고 친근하게
- 너무 광고처럼 보이지 않게
- 딱딱한 설명문 말투 금지
- "저희는 ~합니다"만 반복하지 않기
- 가르치는 척하는 말투 피하기
- 오글거리는 감성 문구 피하기
- 과장 표현 피하기
- 실제 수업 분위기를 옆에서 설명하듯 작성
- 초보자·여성·학생·직장인이 부담 없이 읽을 수 있는 말투
- 문장은 짧게, 문단도 짧게 나누기

━━━ 사용하면 좋은 표현 ━━━
아래 표현은 흐름에 맞게 자연스럽게 사용하세요:
- 처음 시작하시는 분들도 부담 없이
- 기본 자세부터 차근차근
- 회원님 수준에 맞춰
- 무리하지 않고 안전하게
- 운동 목적에 맞게
- 다이어트, 체력관리, 스트레스 해소
- 학생, 직장인, 여성 회원님들도
- 실제 수업 분위기를 보면
- 복싱이 처음이라도 괜찮습니다
- 관장님이 옆에서 자세를 봐드립니다

━━━ 절대 사용 금지 ━━━
- 무료체험
- 무조건
- 최고
- 1등
- 완벽한
- 압도적인
- 인생이 바뀝니다
- 누구나 선수처럼
- 무조건 살 빠집니다
- 도보 5분
- 역 바로 앞
- 역세권
- 실제와 다를 수 있는 거리/시간 표현 일체
- 병원·학원 홍보처럼 딱딱한 문장
- AI가 쓴 것처럼 반복되는 문장${exclude_expr ? `\n- ${exclude_expr}` : ""}

━━━ SEO 키워드 사용 규칙 ━━━
키워드는 넣되 억지로 반복하지 마세요.

나쁜 예: "목동 복싱장을 찾는 분들은 목동 복싱장에서 목동 복싱을..."
좋은 예: "목동 복싱장이나 오목교 근처 운동 공간을 찾는 분들이라면, 처음 시작할 때 수업 분위기를 가장 많이 궁금해하십니다."

- 메인 키워드: 본문 첫 문단 + 본문 중간 1회, 총 2회 이내
- 보조 키워드: 본문 전체에 각 1회 이내
- H2 소제목 3~5개 필수 (반드시 ## 형식)
- 본문 전체 900~1200자

━━━ 본문 구성 흐름 ━━━
1. 고정 인사 (안녕하세요 😊 / 스트롱복싱 ${branch_name}입니다💪)
2. 오늘 주제 소개 (2~3문장, 자연스럽게)
3. 실제 수업 분위기 설명
4. 이런 분들에게 추천 (이모지 포함)
5. 수업 흐름 설명
6. 지점 분위기
7. FAQ 3개 (초보자가 실제로 궁금해할 질문, 구체적으로)
8. 자연스러운 마무리 (아래 문구를 기반으로 자연스럽게 변형 가능):
   "복싱이 처음이라도 괜찮습니다. 스트롱복싱 ${branch_name}에서는 회원님 목적과 수준에 맞춰 차근차근 지도하고 있습니다."

━━━ 이미지 alt ━━━
사진 내용과 지점명이 자연스럽게 들어가는 alt 3개.
키워드만 나열하지 말고 실제 이미지 설명처럼 작성.
예: "스트롱복싱 목동점 초보자 미트 운동 수업 장면"

━━━ 출력 형식 (JSON만, 코드블럭·설명 없이) ━━━
{
  "titles": ["제목후보1", "제목후보2", "제목후보3"],
  "best_title": "최종 추천 제목 — 지역명+복싱장 포함, 50자 이내",
  "description": "메타 description — 80자 이내",
  "slug": "영어-소문자-하이픈 — 지점영어명-boxing-주제 형태",
  "body": "본문 전체 — ## H2 소제목 포함, 반드시 고정 인사 두 줄로 시작",
  "faq": [
    {"q": "질문1", "a": "답변1"},
    {"q": "질문2", "a": "답변2"},
    {"q": "질문3", "a": "답변3"}
  ],
  "image_alts": ["alt1", "alt2", "alt3"]
}`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
    });

    const text = response.output_text.trim();
    const parsed = JSON.parse(text);

    // Deterministic fields — not from AI
    parsed.internal_link_text = branch.linkCta;
    parsed.internal_link_url  = branch.branchUrl;
    parsed.url_preview         = `https://strongboxing.kr/blog/${parsed.slug ?? ""}`;

    return ok(parsed);
  } catch (e: any) {
    return err(e?.message ?? "SEO 글 생성 실패");
  }
}
