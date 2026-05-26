import { google } from "googleapis";
import { NextResponse } from "next/server";
import pool from "@/lib/db";

function decodeBase64(data?: string) {
  if (!data) return "";

  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf-8");
}

function getBody(payload: any): string {
  if (!payload) return "";

  if (payload.body?.data) {
    return decodeBase64(payload.body.data);
  }

  if (payload.parts?.length) {
    return payload.parts.map((p: any) => getBody(p)).join("\n");
  }

  return "";
}

function getHeader(headers: any[], name: string) {
  return (
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
    ""
  );
}

function cleanText(text: string) {
  return String(text || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function detectBranch(text: string) {
  if (text.includes("철산")) return "철산점";
  if (text.includes("목동")) return "목동점";
  if (text.includes("개봉")) return "개봉점";
  if (text.includes("신정")) return "신정점";
  return "미확인";
}

function detectStatus(text: string) {
  if (text.includes("취소")) return "취소";
  if (text.includes("변경")) return "예약변경";
  if (text.includes("노쇼")) return "노쇼";
  if (text.includes("확정")) return "예약확정";
  if (text.includes("접수")) return "예약접수";
  return "예약접수";
}

function pickName(text: string) {
  const patterns = [
    /예약자명\s*\n?\s*([가-힣a-zA-Z*]+님?)/,
    /예약자명\s+([가-힣a-zA-Z*]+님?)/,
    /예약자\s*\n?\s*([가-힣a-zA-Z*]+님?)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].replace(/\s+/g, "").trim();
    }
  }

  return "미확인";
}

function pickPhone(text: string) {
  return text.match(/010[-\s]?\d{4}[-\s]?\d{4}/)?.[0] || "";
}

function pickRequestedAt(text: string) {
  const match = text.match(
    /예약신청\s*일시\s*\n?\s*(\d{4})\.(\d{1,2})\.(\d{1,2})\.?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/
  );

  if (!match) return "";

  const y = match[1];
  const mo = String(match[2]).padStart(2, "0");
  const d = String(match[3]).padStart(2, "0");
  const h = String(match[4]).padStart(2, "0");
  const mi = String(match[5]).padStart(2, "0");
  const s = String(match[6] || "00").padStart(2, "0");

  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

function pickReservationDateTime(text: string) {
  const match = text.match(
    /이용일시\s*\n?\s*(\d{4})\.(\d{1,2})\.(\d{1,2})\.?\([^)]+\)\s*(오전|오후)\s*(\d{1,2})[:시]\s*(\d{2})?/
  );

  if (!match) {
    return {
      reservation_date: null,
      reservation_time: "",
      reservation_raw: "",
    };
  }

  const reservation_date = `${match[1]}-${String(match[2]).padStart(
    2,
    "0"
  )}-${String(match[3]).padStart(2, "0")}`;

  const ampm = match[4];
  let hour = Number(match[5]);
  const minute = String(match[6] || "00").padStart(2, "0");

  if (ampm === "오후" && hour < 12) hour += 12;
  if (ampm === "오전" && hour === 12) hour = 0;

  const reservation_time = `${String(hour).padStart(2, "0")}:${minute}`;

  return {
    reservation_date,
    reservation_time,
    reservation_raw: `${match[1]}.${match[2]}.${match[3]} ${ampm} ${match[5]}:${minute}`,
  };
}

function pickProduct(text: string) {
  const patterns = [/예약상품\s*\n?\s*([^\n]+)/, /상품\s*\n?\s*([^\n]+)/];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1]
        .replace(/이용일시.*/g, "")
        .replace(/결제상태.*/g, "")
        .trim();
    }
  }

  return "방문상담 예약";
}

export async function GET() {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const list = await gmail.users.messages.list({
      userId: "me",
      q: '"네이버 예약" newer_than:7d',
      maxResults: 50,
    });

    const messages = list.data.messages || [];
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const msg of messages) {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id || "",
        format: "full",
      });

      const headers = detail.data.payload?.headers || [];
      const subject = getHeader(headers, "Subject");
      const snippet = detail.data.snippet || "";
      const body = getBody(detail.data.payload);

      const fullTextRaw = `${subject}\n${snippet}\n${body}`;
      const fullText = cleanText(fullTextRaw);

      const branch_name = detectBranch(fullText);
      const status = detectStatus(fullText);
      const customer_name = pickName(fullText).slice(0, 50);
      const phone = pickPhone(fullText);
      const requested_at = pickRequestedAt(fullText);

      const { reservation_date, reservation_time, reservation_raw } =
        pickReservationDateTime(fullText);

      const reservation_product = pickProduct(fullText).slice(0, 100);

      const memo = [
        `메일제목: ${subject}`,
        `예약신청일시: ${requested_at || "-"}`,
        `이용일시원문: ${reservation_raw || "-"}`,
        "",
        fullText,
      ]
        .join("\n")
        .slice(0, 1500);

      const [sameEmailRows]: any = await pool.query(
        `
        SELECT reservation_id
        FROM naver_reservations
        WHERE source_email_id = ?
        LIMIT 1
        `,
        [msg.id]
      );

      if (sameEmailRows.length > 0) {
        skippedCount++;
        continue;
      }

      const [sameReservationRows]: any = await pool.query(
        `
        SELECT *
        FROM naver_reservations
        WHERE phone = ?
          AND reservation_date = ?
          AND reservation_time = ?
        ORDER BY reservation_id DESC
        LIMIT 1
        `,
        [phone, reservation_date, reservation_time]
      );

      if (sameReservationRows.length > 0) {
        await pool.query(
          `
          UPDATE naver_reservations
          SET
            branch_name = ?,
            customer_name = ?,
            reservation_product = ?,
            status = ?,
            source_email_id = ?,
            memo = ?
          WHERE reservation_id = ?
          `,
          [
            branch_name,
            customer_name,
            reservation_product,
            status,
            msg.id,
            memo,
            sameReservationRows[0].reservation_id,
          ]
        );

        updatedCount++;
        continue;
      }

      await pool.query(
        `
        INSERT INTO naver_reservations
        (
          branch_name,
          customer_name,
          phone,
          reservation_date,
          reservation_time,
          reservation_product,
          status,
          source_email_id,
          memo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          branch_name,
          customer_name,
          phone,
          reservation_date,
          reservation_time,
          reservation_product,
          status,
          msg.id,
          memo,
        ]
      );

      insertedCount++;
    }

    return NextResponse.json({
      success: true,
      checked: messages.length,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedCount,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "네이버 예약 메일 동기화 실패",
      error,
    });
  }
}