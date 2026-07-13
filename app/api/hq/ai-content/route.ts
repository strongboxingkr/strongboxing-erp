import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function POST(req: NextRequest) {
  try {
    const { branch, type, target, mood, prompt } = await req.json();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return err("OPENAI_API_KEY 환경변수가 없습니다.", 500);

    const systemPrompt = `당신은 복싱 헬스장 SNS 콘텐츠 전문가입니다.
스트롱복싱은 서울/경기에 5개 지점을 운영하는 복싱 헬스장입니다.
요청에 따라 SNS 게시글, 네이버 클립 제목, 블로그 초안, 해시태그를 생성합니다.
항상 JSON으로만 응답하세요.`;

    const userPrompt = `지점: ${branch || '스트롱복싱'}
플랫폼: ${type || '릴스'}
타겟: ${target || '일반'}
분위기: ${mood || '자연스럽게'}
내용: ${prompt}

아래 JSON 형식으로만 응답:
{
  "insta": "인스타 게시글 (줄바꿈 포함, 이모지 포함, 2~4문장)",
  "clip_title": "네이버 클립/동영상 제목 (15자 내외)",
  "blog": "블로그 초안 (3~4문장, 자연스러운 홍보 글)",
  "hashtags": "#해시태그1 #해시태그2 ... (5~8개)"
}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        temperature: 0.8,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      let t = await res.text();
      try { const j = JSON.parse(t); t = j?.error?.message ?? t; } catch {}
      return err(`OpenAI 오류 (${res.status}): ${t}`, 502);
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return ok(parsed);
  } catch (e: any) {
    return err(e?.message ?? "AI 생성 실패");
  }
}
