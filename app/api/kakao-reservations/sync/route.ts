import { NextResponse } from "next/server";
import Imap from "imap";
import { simpleParser } from "mailparser";
import pool from "@/lib/db";

type HiworksAccount = {
  branch_name: string;
  user: string;
  pass: string;
};

const accounts: HiworksAccount[] = [
  {
    branch_name: "목동점",
    user: process.env.HIWORKS_MOKDONG_USER || "",
    pass: process.env.HIWORKS_MOKDONG_PASS || "",
  },
  {
    branch_name: "철산점",
    user: process.env.HIWORKS_CHULSAN_USER || "",
    pass: process.env.HIWORKS_CHULSAN_PASS || "",
  },
  {
    branch_name: "개봉점",
    user: process.env.HIWORKS_GAEBONG_USER || "",
    pass: process.env.HIWORKS_GAEBONG_PASS || "",
  },
  {
    branch_name: "신정점",
    user: process.env.HIWORKS_SINJEONG_USER || "",
    pass: process.env.HIWORKS_SINJEONG_PASS || "",
  },
];

const cleanText = (text: string) =>
  String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

const cleanPhone = (phone: string) =>
  String(phone || "").replace(/[^0-9*]/g, "");

const pickValue = (text: string, label: string) => {
  const match = text.match(new RegExp(`${label}\\s*[:：]?\\s*([^\\n]+)`));
  return match?.[1]?.trim() || "";
};

const normalizeKakaoPhone = (value: string) => {
  return String(value || "").replace(/[^0-9*]/g, "");
};

const pickKakaoReservationNo = (text: string) => {
  return pickValue(text, "예약번호").replace(/[^0-9]/g, "");
};

const pickKakaoReservation = (text: string) => {
  const customer_name =
    pickValue(text, "예약자명").replace(/\s+/g, "") || "미확인";

  const phone = normalizeKakaoPhone(
    pickValue(text, "예약자 연락처")
  );

  const schedule =
    pickValue(text, "이용일정") ||
    pickValue(text, "예약일시") ||
    "";

  const product =
    pickValue(text, "상품명") ||
    pickValue(text, "예약상품") ||
    "카카오 예약";

  const reservationNo = pickKakaoReservationNo(text);

  const dateMatch = schedule.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  const timeMatch = schedule.match(/(\d{1,2}):(\d{2})/);

  const reservation_date = dateMatch
    ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, "0")}-${String(
        dateMatch[3]
      ).padStart(2, "0")}`
    : "";

  const reservation_time = timeMatch
    ? `${String(timeMatch[1]).padStart(2, "0")}:${timeMatch[2]}`
    : "";

  return {
    customer_name,
    phone,
    reservation_date,
    reservation_time,
    product,
    reservationNo,
  };
};

const syncOneAccount = (account: HiworksAccount) => {
  return new Promise<{
    checked: number;
    inserted: number;
    skipped: number;
  }>((resolve, reject) => {
    if (!account.user || !account.pass) {
      resolve({ checked: 0, inserted: 0, skipped: 0 });
      return;
    }

    const imap = new Imap({
      user: account.user,
      password: account.pass,
      host: process.env.HIWORKS_IMAP_HOST || "imap.hiworks.com",
      port: Number(process.env.HIWORKS_IMAP_PORT || 993),
      tls: true,
    });

    let checked = 0;
    let inserted = 0;
    let skipped = 0;

    const openInbox = () => {
      imap.openBox("INBOX", false, (err) => {
        if (err) {
          reject(err);
          return;
        }

        imap.search(["UNSEEN"], (searchErr, results) => {
          if (searchErr) {
            reject(searchErr);
            return;
          }

          if (!results || results.length === 0) {
            imap.end();
            resolve({ checked, inserted, skipped });
            return;
          }

          const fetcher = imap.fetch(results.slice(-30), {
            bodies: "",
            markSeen: false,
          });

          const tasks: Promise<void>[] = [];

          fetcher.on("message", (msg) => {
            msg.on("body", (stream) => {
              const task = simpleParser(stream)
                .then(async (parsed) => {
                  checked++;

                  const subject = parsed.subject || "";
                  const text = cleanText(
                    `${subject}\n${parsed.text || ""}\n${parsed.html || ""}`
                  );

                  const isKakao =
                    subject.includes("카카오톡 예약하기") ||
                    text.includes("카카오톡 예약하기") ||
                    text.includes("신규예약");

                  if (!isKakao) {
                    skipped++;
                    return;
                  }

                  const kakao = pickKakaoReservation(text);

                  if (!kakao.reservation_date || !kakao.reservation_time) {
                    skipped++;
                    return;
                  }

                  const sourceId =
                      kakao.reservationNo ||
                      parsed.messageId ||
                      `${account.user}-${kakao.customer_name}-${kakao.reservation_date}-${kakao.reservation_time}`;

                  const startDateTime = `${kakao.reservation_date} ${kakao.reservation_time}:00`;

                  const [exists]: any = await pool.query(
                    `
                    SELECT event_id
                    FROM calendar_events
                    WHERE source_type = ?
                      AND source_id = ?
                    LIMIT 1
                    `,
                    ["KAKAO_RESERVATION", sourceId]
                  );

                  if (exists.length > 0) {
                    skipped++;
                    return;
                  }

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
                      account.branch_name,
                      "KAKAO",
                      `카카오예약 - ${kakao.customer_name}`,
                      kakao.customer_name,
                      kakao.phone,
                      startDateTime,
                      null,
                      [
                        `출처: 카카오 예약`,
                        `예약번호: ${kakao.reservationNo || "-"}`,
                        `상품명: ${kakao.product}`,
                        "",
                        text,
                      ]
                        .join("\n")
                        .slice(0, 1500),
                      "예약확정",
                      "KAKAO_RESERVATION",
                      sourceId,
                    ]
                  );

                  inserted++;
                })
                .catch(() => {
                  skipped++;
                });

              tasks.push(task);
            });
          });

          fetcher.once("error", reject);

          fetcher.once("end", async () => {
            await Promise.all(tasks);
            imap.end();
            resolve({ checked, inserted, skipped });
          });
        });
      });
    };

    imap.once("ready", openInbox);
    imap.once("error", reject);
    imap.connect();
  });
};

export async function GET() {
  try {
    let checked = 0;
    let inserted = 0;
    let skipped = 0;

    for (const account of accounts) {
      const result = await syncOneAccount(account);
      checked += result.checked;
      inserted += result.inserted;
      skipped += result.skipped;
    }

    return NextResponse.json({
      success: true,
      checked,
      inserted,
      skipped,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      message: "카카오 예약 메일 동기화 실패",
      error,
    });
  }
}