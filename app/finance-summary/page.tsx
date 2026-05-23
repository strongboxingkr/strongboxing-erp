"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

export default function FinanceSummaryPage() {
  const [data, setData] = useState<any>(null);

  const load = async () => {
    const res = await apiFetch("/api/finance/summary");
    const json = await res.json();
    setData(json);
  };

  useEffect(() => {
    load();
  }, []);

  if (!data) {
    return <AppShell title="재무 요약">로딩중...</AppShell>;
  }

  const getMethodName = (method: string) => {
    if (method === "CARD") return "카드";
    if (method === "CASH") return "현금";
    if (method === "TRANSFER") return "계좌이체";
    return method;
  };

  return (
    <AppShell title="재무 요약">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>
          재무 요약
        </h1>
        <p style={{ color: "#aaa", marginTop: 8 }}>
          매출, 결제수단, 지점별 매출을 확인합니다.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div className="card">
          <h3>오늘 매출</h3>
          <div className="num">
            {Number(data.today_sales || 0).toLocaleString()}원
          </div>
        </div>

        <div className="card">
          <h3>이번달 매출</h3>
          <div className="num">
            {Number(data.month_sales || 0).toLocaleString()}원
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div className="card">
          <h2>결제수단별 매출</h2>

          {data.payment_methods?.map((m: any) => (
            <div
              key={m.payment_method}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 0",
                borderBottom: "1px solid #333",
              }}
            >
              <span>{getMethodName(m.payment_method)}</span>
              <b>{Number(m.total || 0).toLocaleString()}원</b>
            </div>
          ))}
        </div>

        <div className="card">
          <h2>지점별 매출</h2>

          {data.branch_sales?.map((b: any, idx: number) => (
            <div
              key={b.branch_name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 0",
                borderBottom: "1px solid #333",
              }}
            >
              <span>
                {idx + 1}. {b.branch_name}
              </span>
              <b>{Number(b.total || 0).toLocaleString()}원</b>
            </div>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>결제일</th>
              <th>지점</th>
              <th>회원</th>
              <th>상품</th>
              <th>수단</th>
              <th>금액</th>
            </tr>
          </thead>

          <tbody>
            {data.recent_payments?.map((p: any) => (
              <tr key={p.payment_id}>
                <td>{p.payment_date?.slice(0, 10)}</td>
                <td>{p.branch_name}</td>
                <td style={{ fontWeight: 900 }}>{p.name}</td>
                <td>{p.product_name}</td>
                <td>{getMethodName(p.payment_method)}</td>
                <td style={{ color: "#2ee59d", fontWeight: 900 }}>
                  {Number(p.amount || 0).toLocaleString()}원
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}