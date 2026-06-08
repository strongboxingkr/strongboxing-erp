import { NextResponse } from "next/server";
import { SolapiMessageService } from "solapi";
import pool from "@/lib/db";

const cleanPhone = (phone: string) => {
  return String(phone || "").replace(/[^0-9]/g, "");
};

const getFromNumber = (branchName: string) => {
  if (branchName === "철산점") return process.env.SOLAPI_FROM_CHULSAN;
  if (branchName === "목동점") return process.env.SOLAPI_FROM_MOKDONG;
  if (branchName === "개봉점") return process.env.SOLAPI_FROM_GAEBONG;
  if (branchName === "신정점") return process.env.SOLAPI_FROM_SINJEONG;

  return process.env.SOLAPI_FROM_CHULSAN;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { phone, branch_name, message, receiver_name } = body;

    if (!phone) {
      return NextResponse.json({
        success: false,
        message: "수신번호가 없습니다.",
      });
    }

    if (!branch_name) {
      return NextResponse.json({
        success: false,
        message: "지점 정보가 없습니다.",
      });
    }

    if (!message?.trim()) {
      return NextResponse.json({
        success: false,
        message: "문자 내용이 없습니다.",
      });
    }

    const from = cleanPhone(getFromNumber(branch_name) || "");
    const to = cleanPhone(phone);

    if (!from) {
      return NextResponse.json({
        success: false,
        message: "발신번호가 설정되지 않았습니다.",
      });
    }

    if (to.length < 10) {
      return NextResponse.json({
        success: false,
        message: "수신번호가 올바르지 않습니다.",
      });
    }

    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json({
        success: false,
        message: "솔라피 API 키가 없습니다.",
      });
    }

    const messageService = new SolapiMessageService(apiKey, apiSecret);

    const result = await messageService.send([
      {
        to,
        from,
        text: message,
      },
    ]);

    await pool.query(
      `
      INSERT INTO sms_logs
      (
        branch_name,
        target_type,
        receiver_name,
        receiver_phone,
        message,
        send_status,
        provider
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        branch_name,
        "RESERVATION_CONFIRM",
        receiver_name || "",
        to,
        message,
        "SENT",
        "SOLAPI",
      ]
    );

    return NextResponse.json({
      success: true,
      sent_count: 1,
      result,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "예약 문자 발송 실패",
      error,
    });
  }
}