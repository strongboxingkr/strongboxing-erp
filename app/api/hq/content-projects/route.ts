import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function GET() {
  try {
    const [rows]: any = await pool.query(`
      SELECT p.*, b.name AS branch_name,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('id',c.id,'channel_name',c.channel_name,'is_uploaded',c.is_uploaded,'post_url',c.post_url))
         FROM hq_content_channels c WHERE c.project_id = p.id AND c.deleted_at IS NULL) AS channels
      FROM hq_content_projects p
      LEFT JOIN hq_branches b ON b.id = p.branch_id AND b.deleted_at IS NULL
      WHERE p.deleted_at IS NULL
      ORDER BY p.id DESC
    `);
    return ok(rows);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const [r]: any = await pool.query(
      `INSERT INTO hq_content_projects
        (branch_id,title,content_type,status,target,shoot_date,manager,caption,hashtags,clip_title,blog_draft,memo)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [b.branch_id||null, b.title, b.content_type||'릴스', b.status||'아이디어',
       b.target||null, b.shoot_date||null, b.manager||null,
       b.caption||null, b.hashtags||null, b.clip_title||null, b.blog_draft||null, b.memo||null]
    );
    const projectId = r.insertId;
    const channels = ['인스타','네이버클립','블로그','당근','카카오'];
    for (const ch of channels) {
      await pool.query(
        "INSERT INTO hq_content_channels (project_id,channel_name) VALUES (?,?)",
        [projectId, ch]
      );
    }
    return ok({ id: projectId });
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
