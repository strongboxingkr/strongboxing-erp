import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const login_id = searchParams.get("login_id");
  if (!login_id) return NextResponse.json({ exists: false });

  const [rows]: any = await pool.query(
    `SELECT user_id FROM users WHERE login_id = ? LIMIT 1`,
    [login_id]
  );

  return NextResponse.json({ exists: rows.length > 0 });
}
