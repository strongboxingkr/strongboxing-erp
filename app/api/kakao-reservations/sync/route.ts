import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getUserFromRequest, isAdminOrOwner } from "@/lib/auth";
import Imap from "imap";
import { simpleParser } from "mailparser";

const BRANCH_ACCOUNTS = [
  {
    email: "gaebong@strongboxing.kr",
    password: process.env.HIWORKS_GAEBONG_PW || "",
    branch_name: "개봉점",
  },
  {
    email: "sinjeong@strongboxing.kr",
    password: process.env.HIWORKS_SINJEONG_PW || "",
    branch_name: "신정점",
  },
  {
    email: "mokdong@strongboxing.kr",
    password: process.env.HIWORKS_MOKDONG_PW || "",
    branch_name: "목동점",
  },
  {
    email: "cheolsan@strongboxing.kr",
    password: process.env.HIWORKS_CHEOLSAN_PW || "",
    branch_name: "철산점",
  },
];

interface KakaoMail {
  uid: string;
  subject: string;
  body: string;
  date: Date | null;
}

function fetchKakaoMails(account: { email: string; password: string }): Promise<KakaoMail[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: account.email,
      password: account.password,
      host: "mail.hiworks.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 20000,
      authTimeout: 10000,
    });

    const mails: KakaoMail[] = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        // 최근 90일치만 검색 (카카오 발신 주소 기준)
        const since = new Date();
        since.setDate(since.getDate() - 90);

        imap.search(
          [["FROM", "noreply@kakaocorp.com"], ["SINCE", since]],
          (searchErr, uids) => {
            if (searchErr || !uids || uids.length === 0) {
              imap.end();
              return resolve([]);
            }

            const fetch = imap.fetch(uids, { bodies: "", struct: true });
            const pending: Promise<void>[] = [];

            fetch.on("message", (msg, seqno) => {
              let uid = String(seqno);
              const p = new Promise<void>((res) => {
                msg.on("attributes", (attrs) => {
                  uid = String(attrs.uid || seqno);
                });
                msg.on("body", (stream) => {
                  simpleParser(stream, (parseErr, parsed) => {
                    if (!parseErr && parsed) {
                      const subject = parsed.subject || "";
                      const body = parsed.text || parsed.html || "";
                      mails.push({ uid, subject, body: String(body), date: parsed.date || null });
                    }
                    res();
                  });
                });
              });
              pending.push(p);
            });

            fetch.once("end", () => {
              Promise.all(pending).then(() => {
                imap.end();
              });
            });
          }
        );
      });
    });

    imap.once("end", () => resolve(mails));
    imap.once("error", (err: Error) => reject(err));
    imap.connect();
  });
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

function pickName(text: string) {
  const patterns = [
    /예약자명\s*\n?\s*([가-힣a-zA-Z*]+님?)/,
    /예약자명\s+([가-힣a-zA-Z*]+님?)/,
    /예약자\s*\n?\s*([가-힣a-zA-Z*]+님?)/,
    /이름[:\s]*([가-힣a-zA-Z*]+)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, "").replace(/님$/, "").trim();
  }
  return "미확인";
}

function pickPhone(text: string) {
  const match = text.match(/010[-\s]?\d{4}[-\s]?\d{4}/);
  return match ? match[0].replace(/[-\s]/g, "") : "";
}

function pickReservationDateTime(text: string) {
  // 카카오 형식: 이용일정 2024.11.24.(일) 오후 3:00
  const match = text.match(
    /이용일정\s*\n?\s*(\d{4})\.(\d{1,2})\.(\d{1,2})\.?\(?[^)]*\)?\s*(오전|오후)\s*(\d{1,2}):(\d{2})/
  );
  if (!match) {
    // 대안: 이용일시 형식
    const match2 = text.match(
      /이용일[시정]\s*\n?\s*(\d{4})\.(\d{1,2})\.(\d{1,2})\.?\(?[^)]*\)?\s*(오전|오후)\s*(\d{1,2}):(\d{2})/
    );
    if (!match2) return { reservation_date: null, reservation_time: "", reservation_raw: "" };
    return parseDateTime(match2);
  }
  return parseDateTime(match);
}

function parseDateTime(match: RegExpMatchArray) {
  const reservation_date = `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
  const ampm = match[4];
  let hour = Number(match[5]);
  const minute = String(match[6]).padStart(2, "0");
  if (ampm === "오후" && hour < 12) hour += 12;
  if (ampm === "오전" && hour === 12) hour = 0;
  const reservation_time = `${String(hour).padStart(2, "0")}:${minute}`;
  return { reservation_date, reservation_time, reservation_raw: `${match[1]}.${match[2]}.${match[3]} ${ampm} ${match[5]}:${minute}` };
}

function pickReservationNo(text: string) {
  const match = text.match(/예약번호\s*\n?\s*([A-Za-z0-9\-]+)/);
  return match?.[1]?.trim() || "";
}

function pickProduct(text: string) {
  const match = text.match(/(?:예약상품|상품명?)\s*\n?\s*([^\n]+)/);
  return match?.[1]?.trim() || "카카오 예약하기";
}

function detectStatus(subject: string) {
  if (subject.includes("취소")) return "취소";
  if (subject.includes("변경")) return "예약변경";
  if (subject.includes("확정")) return "예약확정";
  if (subject.includes("접수") || subject.includes("신규")) return "예약접수";
  return "예약접수";
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user || !isAdminOrOwner(user)) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }

  let totalNew = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const account of BRANCH_ACCOUNTS) {
    if (!account.password) {
      errors.push(`${account.branch_name}: 비밀번호 환경변수 없음`);
      continue;
    }

    let mails: KakaoMail[];
    try {
      mails = await fetchKakaoMails(account);
    } catch (err: any) {
      errors.push(`${account.branch_name}: IMAP 연결 실패 - ${err?.message || err}`);
      continue;
    }

    for (const mail of mails) {
      if (!mail.subject.includes("카카오톡 예약하기")) {
        totalSkipped++;
        continue;
      }

      const fullText = cleanText(mail.body);
      const subject = mail.subject;
      const sourceEmailId = `kakao-${account.email}-${mail.uid}`;
      const sourceType = "KAKAO_RESERVATION";
      const branch_name = account.branch_name;

      const customer_name = pickName(fullText);
      const phone = pickPhone(fullText);
      const { reservation_date, reservation_time, reservation_raw } = pickReservationDateTime(fullText);
      const reservationNo = pickReservationNo(fullText);
      const reservation_product = pickProduct(fullText);
      const status = detectStatus(subject);

      if (!reservation_date || !reservation_time) {
        totalSkipped++;
        continue;
      }

      const startDateTime = `${reservation_date} ${reservation_time}:00`;
      const eventType = "예약";
      const titlePrefix = branch_name;

      const memo = [
        `예약번호:${reservationNo || "-"}`,
        `메일제목: ${subject}`,
        `이용일시원문: ${reservation_raw || "-"}`,
        "",
        fullText,
      ]
        .join("\n")
        .slice(0, 1500);

      // 중복 체크
      const [existingRows]: any = await pool.query(
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
          sourceEmailId,
          reservationNo,
          `%예약번호:${reservationNo}%`,
          reservationNo,
          phone,
          branch_name,
          reservation_date,
          reservation_time,
        ]
      );

      if (existingRows.length > 0) {
        const existing = existingRows[0];
        const reservationId = existing.reservation_id;

        const isMasked = (p: string) => !p || p.includes("*");
        const safePhone = isMasked(phone) && existing.phone ? existing.phone : phone;
        const isNameMasked = !customer_name || customer_name === "미확인" || customer_name.includes("*");
        const safeName = isNameMasked && existing.customer_name ? existing.customer_name : customer_name;

        const MAIL_SEP = "---MAIL---";
        const existingMemo = String(existing.memo || "");
        const sepIdx = existingMemo.indexOf(MAIL_SEP);
        const existingOpsMemo = sepIdx >= 0 ? existingMemo.slice(0, sepIdx).trim() : "";
        const newMemo = existingOpsMemo ? `${existingOpsMemo}\n${MAIL_SEP}\n${memo}` : memo;
        const safeMemo = newMemo.slice(0, 2000);

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
          [branch_name, safeName, safePhone, reservation_date, reservation_time, reservation_product, status, sourceEmailId, safeMemo, reservationId]
        );

        const calendarSourceId = reservationNo || String(reservationId);
        const [calendarRows]: any = await pool.query(
          `SELECT event_id, status, customer_name, phone FROM calendar_events WHERE source_type = ? AND source_id = ? LIMIT 1`,
          [sourceType, calendarSourceId]
        );

        if (calendarRows.length > 0) {
          const existingStatus = calendarRows[0].status;
          const lockedStatuses = ["상담완료", "확인완료", "노쇼", "취소", "예약취소"];
          const incomingIsCancellation = ["취소", "예약취소"].includes(status);
          const keepStatus = incomingIsCancellation ? status : lockedStatuses.includes(existingStatus) ? existingStatus : status;

          const isCalNameMasked = !customer_name || customer_name === "미확인" || customer_name.includes("*");
          const safeCalName = isCalNameMasked && calendarRows[0].customer_name ? calendarRows[0].customer_name : customer_name;
          const isMaskedCal = (p: string) => !p || p.includes("*");
          const safeCalPhone = isMaskedCal(phone) && calendarRows[0].phone ? calendarRows[0].phone : phone;

          await pool.query(
            `
            UPDATE calendar_events
            SET branch_name = ?, event_type = ?, title = ?, customer_name = ?, phone = ?, start_datetime = ?, memo = ?, status = ?, source_id = ?
            WHERE event_id = ?
            `,
            [branch_name, eventType, `${titlePrefix} - ${safeCalName} [${reservation_product}]`, safeCalName, safeCalPhone, startDateTime, memo, keepStatus, calendarSourceId, calendarRows[0].event_id]
          );
        } else {
          await pool.query(
            `
            INSERT INTO calendar_events (branch_name, event_type, title, customer_name, phone, start_datetime, end_datetime, memo, status, source_type, source_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [branch_name, eventType, `${titlePrefix} - ${safeName} [${reservation_product}]`, safeName, safePhone, startDateTime, null, memo, status, sourceType, calendarSourceId]
          );
        }

        totalUpdated++;
        continue;
      }

      // 신규 INSERT
      const [insertResult]: any = await pool.query(
        `
        INSERT INTO naver_reservations (branch_name, customer_name, phone, reservation_date, reservation_time, reservation_product, status, source_email_id, memo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [branch_name, customer_name, phone, reservation_date, reservation_time, reservation_product, status, sourceEmailId, memo]
      );

      const newId = insertResult.insertId;
      const calendarSourceId = reservationNo || String(newId);

      await pool.query(
        `
        INSERT INTO calendar_events (branch_name, event_type, title, customer_name, phone, start_datetime, end_datetime, memo, status, source_type, source_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [branch_name, eventType, `${titlePrefix} - ${customer_name} [${reservation_product}]`, customer_name, phone, startDateTime, null, memo, status, sourceType, calendarSourceId]
      );

      totalNew++;
    }
  }

  return NextResponse.json({
    ok: true,
    new: totalNew,
    updated: totalUpdated,
    skipped: totalSkipped,
    errors,
  });
}
