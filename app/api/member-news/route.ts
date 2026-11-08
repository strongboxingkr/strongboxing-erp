import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { isAdminOrOwner } from "@/lib/auth";
import { getErpUser, type ErpUser } from "@/lib/erp-session";

/**
 * 회원 앱 소식 관리 (member_news).
 *  ADMIN/OWNER: 전체·모든 지점 / DIRECTOR(관장): 자기 지점 글만 작성·수정
 *  삭제 대신 HIDDEN(숨김) 처리 — 회원 앱 알림 기록과 연결이 끊기지 않도록
 * 권한은 x-user-* 헤더가 아니라 서버 세션(erp_session 쿠키)으로 확인합니다.
 */
const CATEGORIES = ["NOTICE", "CLOSURE", "HOURS", "EVENT", "BLOG"];
const STATUSES = ["DRAFT", "PUBLISHED", "HIDDEN"];


function canWrite(role?: string | null) {
  return role === "ADMIN" || role === "OWNER" || role === "DIRECTOR";
}

function allowedBranch(user: ErpUser, branch: string) {
  if (isAdminOrOwner(user.role)) return true;
  return !!user.branch_name && branch === user.branch_name;
}

async function sessionUser(req: Request): Promise<ErpUser> {
  return (await getErpUser(req)) || ({ user_id: 0, login_id: "", name: "", role: "", branch_name: null } as ErpUser);
}

export async function GET(req: Request) {
  try {
    const user = await sessionUser(req);
    if (!canWrite(user.role)) return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    const params: any[] = [];
    let sql = `SELECT * FROM member_news WHERE 1=1`;
    if (!isAdminOrOwner(user.role)) {
      sql += ` AND branch_name IN (?, '전체')`;
      params.push(user.branch_name);
    }
    sql += ` ORDER BY FIELD(status,'PUBLISHED','DRAFT','HIDDEN'), is_pinned DESC, news_id DESC LIMIT 300`;
    const [rows]: any = await pool.query(sql, params);
    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "회원 소식 조회 실패 (member_news 테이블 확인)" }, { status: 500 });
  }
}

function validate(body: any) {
  const title = String(body.title || "").trim();
  const category = String(body.category || "NOTICE");
  const status = String(body.status || "DRAFT");
  const branch_name = String(body.branch_name || "").trim();
  const d = (v: any) => (v && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null);
  const start_date = d(body.start_date);
  const end_date = d(body.end_date) || start_date;
  const url = (v: any) => {
    const s = String(v || "").trim();
    return /^https:\/\/[^\s]+$/.test(s) ? s.slice(0, 500) : null;
  };

  if (!title) return { error: "제목을 입력해주세요." };
  if (!branch_name) return { error: "대상 지점을 선택해주세요." };
  if (!CATEGORIES.includes(category)) return { error: "분류가 올바르지 않습니다." };
  if (!STATUSES.includes(status)) return { error: "상태가 올바르지 않습니다." };
  if ((category === "CLOSURE" || category === "HOURS") && !start_date) return { error: "휴무/운영시간 변경은 적용 날짜가 필요합니다." };
  if (start_date && end_date && end_date < start_date) return { error: "종료일이 시작일보다 빠릅니다." };
  if (category === "HOURS" && !/\d{1,2}:\d{2}\s*[~\-]\s*\d{1,2}:\d{2}/.test(String(body.hours_text || ""))) {
    return { error: "변경 운영시간을 '14:00~20:00' 형식으로 입력해주세요." };
  }
  if (category === "BLOG" && !url(body.link_url)) return { error: "블로그 글 주소(https://...)를 입력해주세요." };

  return {
    value: {
      branch_name,
      category,
      title: title.slice(0, 200),
      body: String(body.body || "").slice(0, 5000),
      is_pinned: body.is_pinned ? 1 : 0,
      start_date,
      end_date,
      hours_text: category === "HOURS" ? String(body.hours_text).trim().slice(0, 100) : null,
      link_url: url(body.link_url),
      thumbnail_url: url(body.thumbnail_url),
      status,
    },
  };
}

export async function POST(req: Request) {
  try {
    const user = await sessionUser(req);
    if (!canWrite(user.role)) return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    const v = validate(await req.json());
    if ("error" in v) return NextResponse.json({ success: false, message: v.error });
    const n = v.value!;
    if (!allowedBranch(user, n.branch_name)) return NextResponse.json({ success: false, message: "자기 지점 소식만 작성할 수 있습니다." }, { status: 403 });

    const [r]: any = await pool.query(
      `INSERT INTO member_news (branch_name, category, title, body, is_pinned, start_date, end_date, hours_text, link_url, thumbnail_url, status, published_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${n.status === "PUBLISHED" ? "NOW()" : "NULL"}, ?, ?)`,
      [n.branch_name, n.category, n.title, n.body, n.is_pinned, n.start_date, n.end_date, n.hours_text, n.link_url, n.thumbnail_url, n.status, user.login_id || "", user.login_id || ""]
    );
    return NextResponse.json({ success: true, news_id: r.insertId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "회원 소식 저장 실패" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await sessionUser(req);
    if (!canWrite(user.role)) return NextResponse.json({ success: false, message: "권한이 없습니다." }, { status: 403 });
    const body = await req.json();
    const news_id = Number(body.news_id);
    const [old]: any = await pool.query(`SELECT news_id, branch_name, status, published_at FROM member_news WHERE news_id = ?`, [news_id]);
    if (!old.length) return NextResponse.json({ success: false, message: "없는 소식입니다." }, { status: 404 });
    if (!allowedBranch(user, old[0].branch_name)) return NextResponse.json({ success: false, message: "자기 지점 소식만 수정할 수 있습니다." }, { status: 403 });

    const v = validate(body);
    if ("error" in v) return NextResponse.json({ success: false, message: v.error });
    const n = v.value!;
    if (!allowedBranch(user, n.branch_name)) return NextResponse.json({ success: false, message: "자기 지점 소식만 작성할 수 있습니다." }, { status: 403 });

    // 처음 게시될 때만 published_at 설정 (수정해도 알림이 다시 가지 않음)
    await pool.query(
      `UPDATE member_news SET branch_name=?, category=?, title=?, body=?, is_pinned=?, start_date=?, end_date=?, hours_text=?, link_url=?, thumbnail_url=?, status=?,
         published_at = IF(? = 'PUBLISHED' AND published_at IS NULL, NOW(), published_at), updated_by=?
       WHERE news_id = ?`,
      [n.branch_name, n.category, n.title, n.body, n.is_pinned, n.start_date, n.end_date, n.hours_text, n.link_url, n.thumbnail_url, n.status, n.status, user.login_id || "", news_id]
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ success: false, message: "회원 소식 수정 실패" }, { status: 500 });
  }
}
