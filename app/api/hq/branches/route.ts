import pool from "@/lib/db";
import { NextRequest } from "next/server";

const ok = (data: unknown) => Response.json({ success: true, data });
const err = (msg: string, status = 500) => Response.json({ success: false, message: msg }, { status });

export async function GET() {
  try {
    const [rows]: any = await pool.query(
      "SELECT * FROM hq_branches WHERE deleted_at IS NULL ORDER BY id ASC"
    );
    return ok(rows);
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const [r]: any = await pool.query(
      `INSERT INTO hq_branches (name,slug,phone,address,instagram,kakao_map_url,naver_reservation_url,business_hours,memo)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [b.name, b.slug, b.phone||null, b.address||null, b.instagram||null,
       b.kakao_map_url||null, b.naver_reservation_url||null,
       b.business_hours ? JSON.stringify(b.business_hours) : null, b.memo||null]
    );
    return ok({ id: r.insertId });
  } catch (e: any) {
    return err(e?.message ?? "DB error");
  }
}
