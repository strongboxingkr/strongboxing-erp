import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { isAdminOrOwner } from "@/lib/auth";
import { getErpUser } from "@/lib/erp-session";

/** 회원 앱 지점 연결 정보 (카카오톡 채널, 네이버 블로그 ID). 전화·운영시간은 HQ 지점관리(hq_branches) 사용 */
export async function GET(req: Request) {
  const user = (await getErpUser(req)) || { role: "", branch_name: null, login_id: "" };
  if (!["ADMIN", "OWNER", "DIRECTOR"].includes(String(user.role))) return NextResponse.json({ success: false }, { status: 403 });
  const [rows]: any = await pool.query(`SELECT branch_name, kakao_chat_url, naver_blog_id, updated_at FROM app_branch_links`);
  return NextResponse.json({ success: true, rows });
}

export async function PUT(req: Request) {
  const user = (await getErpUser(req)) || { role: "", branch_name: null, login_id: "" };
  if (!isAdminOrOwner(user.role)) return NextResponse.json({ success: false, message: "대표·관리자만 수정할 수 있습니다." }, { status: 403 });
  const body = await req.json();
  const branch_name = String(body.branch_name || "").trim();
  const kakao = String(body.kakao_chat_url || "").trim();
  const blog = String(body.naver_blog_id || "").trim().replace(/^https?:\/\/(m\.)?blog\.naver\.com\//, "").replace(/[/?#].*$/, "");
  if (!branch_name) return NextResponse.json({ success: false, message: "지점을 선택해주세요." });
  if (kakao && !/^https:\/\/pf\.kakao\.com\/[A-Za-z0-9_]+(\/chat)?$/.test(kakao)) {
    return NextResponse.json({ success: false, message: "카카오톡 채널 주소는 https://pf.kakao.com/_xxxx/chat 형식입니다." });
  }
  if (blog && !/^[A-Za-z0-9_-]{2,60}$/.test(blog)) return NextResponse.json({ success: false, message: "네이버 블로그 ID 형식이 올바르지 않습니다." });
  // 실제로 RSS 피드가 있는 블로그인지 확인 후 저장 (연동되지 않는 ID 를 연동된 것처럼 저장하지 않음)
  let blogTitle = "";
  if (blog) {
    try {
      const r = await fetch(`https://rss.blog.naver.com/${blog}.xml`, { signal: AbortSignal.timeout(6000), cache: "no-store" });
      const xml = r.ok ? await r.text() : "";
      blogTitle = (xml.match(/<title><!\[CDATA\[([^\]]*)\]\]><\/title>/) || [])[1] || "";
      if (!xml.includes("<channel>") || !blogTitle) throw new Error("no feed");
    } catch {
      return NextResponse.json({ success: false, message: `네이버 블로그 '${blog}'의 RSS를 찾을 수 없습니다. 블로그 주소의 ID를 확인해주세요.` });
    }
  }

  await pool.query(
    `INSERT INTO app_branch_links (branch_name, kakao_chat_url, naver_blog_id, updated_by) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE kakao_chat_url = VALUES(kakao_chat_url), naver_blog_id = VALUES(naver_blog_id), updated_by = VALUES(updated_by)`,
    [branch_name, kakao || null, blog || null, user.login_id || ""]
  );
  return NextResponse.json({ success: true, blogTitle });
}
