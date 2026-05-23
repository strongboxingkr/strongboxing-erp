import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { SolapiMessageService } from "solapi";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";

const cleanPhone = (phone: string) => {
  return String(phone || "").replace(/[^0-9]/g, "");
};

const getFromNumber = (branchName: string) => {
  if (branchName === "철산점") {
    return process.env.SOLAPI_FROM_CHULSAN;
  }

  if (branchName === "목동점") {
    return process.env.SOLAPI_FROM_MOKDONG;
  }

  if (branchName === "개봉점") {
    return process.env.SOLAPI_FROM_GAEBONG;
  }

  if (branchName === "신정점") {
    return process.env.SOLAPI_FROM_SINJEONG;
  }

  return process.env.SOLAPI_FROM_CHULSAN;
};

export async function POST(req: Request) {
  try {
    const user = getUserFromRequest(req);

    const body = await req.json();

    const {
      branch_name,
      message,
      selected_members,
      is_test,
      test_phone,
    } = body;

    if (!message?.trim()) {
      return NextResponse.json({
        success: false,
        message: "문자 내용을 입력해주세요.",
      });
    }

    if (!branch_name) {
      return NextResponse.json({
        success: false,
        message: "지점을 선택해주세요.",
      });
    }

    if (!isAdminOrOwner(user.role) && user.branch_name !== branch_name) {
      return NextResponse.json({
        success: false,
        message: "해당 지점 권한이 없습니다.",
      });
    }

    const from = getFromNumber(branch_name);

    if (!from) {
      return NextResponse.json({
        success: false,
        message: "발신번호가 설정되지 않았습니다.",
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

    const messageService = new SolapiMessageService(
      apiKey,
      apiSecret
    );

    let targets: any[] = [];

    if (is_test) {
      if (!test_phone) {
        return NextResponse.json({
          success: false,
          message: "테스트 번호를 입력해주세요.",
        });
      }

      targets = [
        {
          name: "테스트",
          phone: cleanPhone(test_phone),
        },
      ];
    } else {
      if (!selected_members?.length) {
        return NextResponse.json({
          success: false,
          message: "발송 대상을 선택해주세요.",
        });
      }

      const placeholders = selected_members
        .map(() => "?")
        .join(",");

      const [rows]: any = await pool.query(
        `
        SELECT
          member_id,
          name,
          phone
        FROM members
        WHERE member_id IN (${placeholders})
        `,
        selected_members
      );

      targets = rows;
    }

    const sendMessages = targets
      .map((t) => ({
        to: cleanPhone(t.phone),
        from: cleanPhone(from || ""),
        text: message,
      }))
      .filter((t) => t.to.length >= 10);

    if (sendMessages.length === 0) {
      return NextResponse.json({
        success: false,
        message: "유효한 전화번호가 없습니다.",
      });
    }

    const result = await messageService.send(sendMessages);

    for (const t of targets) {
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
          is_test ? "TEST" : "MANUAL",
          t.name || "",
          t.phone || "",
          message,
          "SENT",
          "SOLAPI",
        ]
      );
    }

    return NextResponse.json({
      success: true,
      sent_count: sendMessages.length,
      result,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "문자 발송 실패",
      error,
    });
  }
}