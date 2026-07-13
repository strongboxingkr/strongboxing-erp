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
    /이름[:\s]*([가-힣a-zA-Z*]+)/,
    /예약자명\s*\n?\s*([가-힣a-zA-Z*]+님?)/,
    /예약자명\s+([가-힣a-zA-Z*]+님?)/,
    /예약자\s*\n?\s*([가-힣a-zA-Z*]+님?)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, "").replace(/님$/, "").trim();
  }

  return "미확인";
}

function pickPhone(text: string) {
  return text.match(/010[-\s]?\d{4}[-\s]?\d{4}/)?.[0] || "";
}

function normalizePhone(value: string) {
  const onlyNumber = String(value || "").replace(/[^0-9]/g, "");
  const match = onlyNumber.match(/010\d{8}/);
  return match ? match[0] : onlyNumber.slice(0, 20);
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

function pickHomepageValue(text: string, label: string) {
  const match = text.match(new RegExp(`${label}\\s*[:：]\\s*([^\\n]+)`));
  return match?.[1]?.trim() || "";
}

function pickHomepageReservationNo(text: string) {
  return pickHomepageValue(text, "예약번호");
}

function pickHomepageReservation(subject: string, text: string) {
  const subjectMatch = subject.match(
      /\[홈페이지예약\]\[([^\]]+)\]\[([^\]]+)\]\s*([^/]+)\s*\/\s*(\d{4}-\d{2}-\d{2})\s*(\d{2}:\d{2})/
    );

  const reservation_no =
    subjectMatch?.[1]?.trim() || pickHomepageValue(text, "예약번호");

  const branch_name =
    subjectMatch?.[2]?.trim() || pickHomepageValue(text, "지점") || detectBranch(text);

  const customer_name =
    subjectMatch?.[3]?.trim() || pickHomepageValue(text, "이름") || "미확인";

  const reservation_date =
    subjectMatch?.[4] || pickHomepageValue(text, "예약일");

  const reservation_time =
    subjectMatch?.[5] || pickHomepageValue(text, "예약시간");

  const phone = normalizePhone(pickHomepageValue(text, "전화번호") || pickPhone(text));
  const goal = pickHomepageValue(text, "운동목적");
  const message = pickHomepageValue(text, "문의사항");

  return {
    reservation_no,
    branch_name,
    customer_name,
    phone,
    reservation_date,
    reservation_time,
    reservation_product: goal ? `홈페이지 체험예약 - ${goal}` : "홈페이지 체험예약",
    status: "예약접수",
    memoExtra: [
      `출처: 홈페이지 예약`,
      `운동목적: ${goal || "-"}`,
      `문의사항: ${message || "-"}`,
    ].join("\n"),
  };
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

function pickReservationNo(text: string) {
  const patterns = [
    /예약번호\s*\n?\s*(\d+)/,
    /예약번호[:\s]*(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function pickKakaoName(text: string) {
  return text.match(/예약자명\s*\n?\s*([^\n]+)/)?.[1]?.trim() || "미확인";
}

function pickKakaoReservationNo(text: string) {
  return text.match(/예약번호\s*\n?\s*(\d+)/)?.[1] || "";
}

function pickKakaoProduct(text: string) {
  return text.match(/상품명\s*\n?\s*([^\n]+)/)?.[1]?.trim() || "상담 예약";
}

function pickKakaoDateTime(text: string) {
  const match = text.match(
    /이용일정\s*\n?\s*(\d{4})\.(\d{2})\.(\d{2}).*?(\d{2}):(\d{2})/
  );

  if (!match) {
    return {
      reservation_date: null,
      reservation_time: "",
      reservation_raw: "",
    };
  }

  return {
    reservation_date: `${match[1]}-${match[2]}-${match[3]}`,
    reservation_time: `${match[4]}:${match[5]}`,
    reservation_raw: match[0],
  };
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
      q: '("네이버 예약" OR "홈페이지예약") newer_than:7d',
      maxResults: 80,
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

      const isHomepage = subject.includes("[홈페이지예약]") || fullText.includes("새 홈페이지 체험 예약");
      const isKakao =  subject.includes("카카오톡 예약하기") || fullText.includes("카카오톡 예약하기") || fullText.includes("신규 예약이 확정되었습니다");

      let branch_name = "";
      let status = "";
      let customer_name = "";
      let phone = "";
      let reservation_date: any = null;
      let reservation_time = "";
      let reservation_raw = "";
      let reservation_product = "";
      let sourceType = "";
      let eventType = "";
      let titlePrefix = "";
      let memoExtra = "";
      let reservationNo = "";

      if (isKakao) {

        branch_name = "미확인"; // 하이웍스 계정별로 나중에 결정

        status = "예약확정";

        customer_name = pickKakaoName(fullText).slice(0, 50);

        phone = normalizePhone(pickPhone(fullText));

        const picked = pickKakaoDateTime(fullText);

        reservation_date = picked.reservation_date;
        reservation_time = picked.reservation_time;
        reservation_raw = picked.reservation_raw;

        reservationNo = pickKakaoReservationNo(fullText);

        reservation_product = pickKakaoProduct(fullText);

        sourceType = "KAKAO_RESERVATION";
        eventType = "KAKAO";
        titlePrefix = "카카오예약";
      }

      else if (isHomepage) {
        
        const hp = pickHomepageReservation(subject, fullText);
        branch_name = hp.branch_name;

        if (!["철산점", "목동점", "개봉점", "신정점"].includes(branch_name)) {
          branch_name = detectBranch(fullText);
        }

        status = hp.status;
        customer_name = hp.customer_name.slice(0, 50);
        phone = hp.phone;
        reservation_date = hp.reservation_date;
        reservation_time = hp.reservation_time;
        reservation_product = hp.reservation_product.slice(0, 100);
        reservationNo = hp.reservation_no || pickHomepageReservationNo(fullText);
        sourceType = "HOMEPAGE_RESERVATION";
        eventType = "HOMEPAGE";
        titlePrefix = "홈페이지예약";
        memoExtra = hp.memoExtra;
      } else {
        branch_name = detectBranch(fullText);
        status = detectStatus(fullText);
        customer_name = pickName(fullText).slice(0, 50);
        phone = normalizePhone(pickPhone(fullText));

        const picked = pickReservationDateTime(fullText);
        reservation_date = picked.reservation_date;
        reservation_time = picked.reservation_time;
        reservation_raw = picked.reservation_raw;

        reservation_product = pickProduct(fullText).slice(0, 100);
        reservationNo = pickReservationNo(fullText);
        sourceType = "NAVER_RESERVATION";
        eventType = "NAVER";
        titlePrefix = "네이버예약";
      }

      const requested_at = pickRequestedAt(fullText);

      if (!reservation_date || !reservation_time) {
        skippedCount++;
        continue;
      }

      const startDateTime = `${reservation_date} ${reservation_time}:00`;

      const memo = [
          `예약번호:${reservationNo || "-"}`,
          `메일제목: ${subject}`,
          `예약신청일시: ${requested_at || "-"}`,
         isHomepage ? memoExtra : `이용일시원문: ${reservation_raw || "-"}`,
         "",
         fullText,
      ]
        .join("\n")
        .slice(0, 1500);

      const [sameReservationRows]: any = await pool.query(
        `
        SELECT *
        FROM naver_reservations
        WHERE source_email_id = ?
        OR (
              ? <> ''
          AND memo LIKE ?
        )
        OR (
              ? = ''
          AND phone = ?
          AND branch_name = ?
          AND reservation_date = ?
          AND reservation_time = ?
        )
        ORDER BY reservation_id DESC
        LIMIT 1
        `,
        [
          msg.id,
          reservationNo,
          `%예약번호:${reservationNo}%`,
          reservationNo,
          phone,
          branch_name,
          reservation_date,
          reservation_time,
        ]
        );

      if (sameReservationRows.length > 0) {
        const reservationId = sameReservationRows[0].reservation_id;

        await pool.query(
          `
          UPDATE naver_reservations
          SET
            branch_name = ?,
            customer_name = ?,
            phone = ?,
            reservation_date = ?,
            reservation_time = ?,
            reservation_product = ?,
            status = ?,
            source_email_id = ?,
            memo = ?
          WHERE reservation_id = ?
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
            reservationId,
          ]
        );

        const calendarSourceId = reservationNo || String(reservationId) || msg.id || "";

        const [calendarRows]: any = await pool.query(
          `
          SELECT event_id, status
          FROM calendar_events
          WHERE source_type = ?
            AND source_id = ?
          LIMIT 1
          `,
          [sourceType, calendarSourceId]
        );

        if (calendarRows.length > 0) {
          const existingStatus = calendarRows[0].status;
          const lockedStatuses = ["예약확정", "상담완료", "확인완료", "노쇼"];
          // 취소 → 재예약 확정인 경우 naver 측 status를 따름
          const incomingIsActive = !["취소", "예약취소"].includes(status);
          const keepStatus = lockedStatuses.includes(existingStatus) && !(existingStatus === "취소" && incomingIsActive)
            ? existingStatus
            : status;

          await pool.query(
            `
            UPDATE calendar_events
            SET
              branch_name = ?,
              event_type = ?,
              title = ?,
              customer_name = ?,
              phone = ?,
              start_datetime = ?,
              memo = ?,
              status = ?,
              source_id = ?
            WHERE event_id = ?
            `,
            [
              branch_name,
              eventType,
              `${titlePrefix} - ${customer_name}`,
              customer_name,
              phone,
              startDateTime,
              memo,
              keepStatus,
              calendarSourceId,
              calendarRows[0].event_id,
            ]
          );
        } else {
          await pool.query(
            `
            INSERT INTO calendar_events
            (
              branch_name,
              event_type,
              title,
              customer_name,
              phone,
              start_datetime,
              end_datetime,
              memo,
              status,
              source_type,
              source_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              branch_name,
              eventType,
              `${titlePrefix} - ${customer_name}`,
              customer_name,
              phone,
              startDateTime,
              null,
              memo,
              status,
              sourceType,
              calendarSourceId,
            ]
          );
        }

        updatedCount++;
        continue;
      }

      const [insertResult]: any = await pool.query(
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

      await pool.query(
        `
        INSERT INTO calendar_events
        (
          branch_name,
          event_type,
          title,
          customer_name,
          phone,
          start_datetime,
          end_datetime,
          memo,
          status,
          source_type,
          source_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          branch_name,
          eventType,
          `${titlePrefix} - ${customer_name}`,
          customer_name,
          phone,
          startDateTime,
          null,
          memo,
          status,
          sourceType,
          reservationNo || String(insertResult.insertId) || msg.id,
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
      message: "예약 메일 동기화 실패",
      error,
    });
  }
}