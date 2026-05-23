import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const [rows] = await pool.query("SELECT 1 as test");

    return NextResponse.json({
      success: true,
      rows,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error,
    });
  }
}