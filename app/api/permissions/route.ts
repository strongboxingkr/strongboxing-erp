import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [rows]: any = await pool.query(`
      SELECT 
        rp.permission_id,
        rp.role,
        m.menu_name,
        m.path,
        m.sort_order,
        rp.can_view,
        rp.can_create,
        rp.can_update,
        rp.can_delete
      FROM role_permissions rp
      JOIN menus m 
        ON rp.menu_id = m.menu_id
      ORDER BY 
        FIELD(rp.role, 'ADMIN', 'OWNER', 'DIRECTOR', 'COACH', 'KIOSK'),
        m.sort_order
    `);

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "권한 목록 조회 실패",
      error,
    });
  }
}