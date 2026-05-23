import { NextResponse } from "next/server";
import pool from "@/lib/db";
import path from "path";
import { mkdir, writeFile } from "fs/promises";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const member_id = String(formData.get("member_id") || "");
    const file_type = String(formData.get("file_type") || "입관서");
    const memo = String(formData.get("memo") || "");

    if (!file) {
      return NextResponse.json({
        success: false,
        message: "파일이 없습니다.",
      });
    }

    if (!member_id) {
      return NextResponse.json({
        success: false,
        message: "member_id가 없습니다.",
      });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "member-files"
    );

    await mkdir(uploadDir, { recursive: true });

    const safeName = file.name.replace(/[^\w.\-가-힣]/g, "_");
    const savedName = `${Date.now()}_${member_id}_${safeName}`;
    const savedPath = path.join(uploadDir, savedName);

    await writeFile(savedPath, buffer);

    const fileUrl = `/uploads/member-files/${savedName}`;

    await pool.query(
      `
      INSERT INTO member_files
      (
        member_id,
        file_type,
        file_name,
        file_url,
        memo
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [member_id, file_type, file.name, fileUrl, memo]
    );

    return NextResponse.json({
      success: true,
      file_url: fileUrl,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "파일 업로드 실패",
      error,
    });
  }
}