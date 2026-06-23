import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export async function GET() {
  const headers = ["날짜", "지점", "유입경로", "광고비", "노출수", "클릭수", "문의수", "예약수", "등록수", "매출"];

  const example = [
    "2026-06-01",
    "개봉점",
    "네이버 검색광고",
    150000,
    12000,
    340,
    18,
    5,
    3,
    870000,
  ];

  const sources = [
    ["※ 유입경로 값 목록"],
    ["네이버 검색광고"],
    ["네이버 플레이스"],
    ["네이버 예약"],
    ["홈페이지"],
    ["인스타그램 광고"],
    ["페이스북 광고"],
    ["당근 광고"],
    ["카카오맵"],
    ["지인소개"],
    ["지나가다 방문"],
    ["기타"],
  ];

  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, "업로드양식");

  const ws2 = XLSX.utils.aoa_to_sheet(sources);
  ws2["!cols"] = [{ wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws2, "유입경로목록");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''%EB%A7%88%EC%BC%80%ED%8C%85_%EC%97%85%EB%A1%9C%EB%93%9C%EC%96%91%EC%8B%9D.xlsx`,
    },
  });
}
