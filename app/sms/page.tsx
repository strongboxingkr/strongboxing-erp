"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const branches = ["철산점", "목동점", "개봉점", "신정점"];

const targetTypes = [
  { value: "BRANCH_MEMBERS", label: "지점 전체 회원" },
  { value: "EXPIRING_7DAYS", label: "만료 7일 이내 회원" },
  { value: "LOW_COUNT", label: "횟수 3회 이하 회원" },
];

const templates = [
  {
    title: "휴관 공지",
    text: "[스트롱복싱]\n금일 내부 일정으로 인해 휴관입니다.\n이용에 참고 부탁드립니다.",
  },
  {
    title: "만료 안내",
    text: "[스트롱복싱]\n회원권 만료가 얼마 남지 않았습니다.\n재등록 문의는 편하게 연락주세요.",
  },
  {
    title: "이벤트 안내",
    text: "[스트롱복싱]\n현재 이벤트 진행중입니다.\n자세한 내용은 지점으로 문의해주세요.",
  },
];

const estimateCost = (count: number, message: string) => {
  const isLong = message.length > 45;
  const price = isLong ? 45 : 20;
  return count * price;
};

export default function SmsPage() {
  const [branchName, setBranchName] = useState("철산점");
  const [targetType, setTargetType] = useState("BRANCH_MEMBERS");
  const [targets, setTargets] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedCount = selectedIds.length;
  const excludedCount = targets.length - selectedCount;
  const cost = estimateCost(selectedCount, message);

  const loadTargets = async () => {
    const res = await apiFetch(
      `/api/sms/targets?branch_name=${encodeURIComponent(
        branchName
      )}&target_type=${targetType}`
    );

    const data = await res.json();

    if (data.success) {
      setTargets(data.rows || []);
      setSelectedIds((data.rows || []).map((r: any) => r.member_id));
    } else {
      alert(data.message || "대상 조회 실패");
    }
  };

  useEffect(() => {
    loadTargets();
  }, [branchName, targetType]);

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const sendSms = async (isTest = false) => {
    if (!message.trim()) {
      alert("문자 내용을 입력해주세요.");
      return;
    }

    if (isTest && !testPhone.trim()) {
      alert("테스트 받을 번호를 입력해주세요.");
      return;
    }

    if (!isTest && selectedIds.length === 0) {
      alert("발송 대상을 선택해주세요.");
      return;
    }

    const count = isTest ? 1 : selectedIds.length;
    const finalCost = estimateCost(count, message);

    const ok = confirm(
      `문자 발송 확인\n\n지점: ${branchName}\n대상: ${
        isTest ? "테스트 1명" : `${count}명`
      }\n예상비용: 약 ${finalCost.toLocaleString()}원\n\n내용:\n${message}\n\n정말 발송할까요?`
    );

    if (!ok) return;

    setLoading(true);

    const res = await apiFetch("/api/sms/send", {
      method: "POST",
      body: JSON.stringify({
        branch_name: branchName,
        message,
        selected_members: selectedIds,
        is_test: isTest,
        test_phone: testPhone,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.success) {
      alert(`문자 발송 완료!\n발송: ${data.sent_count}건`);
    } else {
      alert(data.message || "문자 발송 실패");
      console.log(data);
    }
  };

  return (
    <AppShell title="문자 관리">
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>
          문자 관리
        </h1>
        <p style={{ color: "#aaa", marginTop: 8 }}>
          대상 확인 → 테스트 발송 → 최종 단체발송 순서로 진행하세요.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h2>1. 발송 설정</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <select
                className="input"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>

              <select
                className="input"
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
              >
                {targetTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div
              className="row"
              style={{ justifyContent: "space-between", marginBottom: 12 }}
            >
              <h2>2. 발송 대상</h2>

              <div className="row">
                <button
                  className="btn secondary"
                  onClick={() =>
                    setSelectedIds(targets.map((t) => t.member_id))
                  }
                >
                  전체선택
                </button>

                <button
                  className="btn secondary"
                  onClick={() => setSelectedIds([])}
                >
                  전체해제
                </button>

                <button className="btn secondary" onClick={loadTargets}>
                  새로고침
                </button>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div className="card">
                <h3>전체 대상</h3>
                <div className="num">{targets.length}명</div>
              </div>

              <div className="card">
                <h3>발송 선택</h3>
                <div className="num" style={{ color: "#2ee59d" }}>
                  {selectedCount}명
                </div>
              </div>

              <div className="card">
                <h3>제외</h3>
                <div className="num" style={{ color: "#ff4d6d" }}>
                  {excludedCount}명
                </div>
              </div>
            </div>

            <div style={{ maxHeight: 360, overflow: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>선택</th>
                    <th>이름</th>
                    <th>전화번호</th>
                    <th>회원권</th>
                    <th>만료일</th>
                  </tr>
                </thead>

                <tbody>
                  {targets.map((t) => (
                    <tr key={t.member_id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.member_id)}
                          onChange={() => toggle(t.member_id)}
                        />
                      </td>
                      <td style={{ fontWeight: 900 }}>{t.name}</td>
                      <td>{t.phone}</td>
                      <td>{t.product_name}</td>
                      <td>{t.end_date?.slice(0, 10)}</td>
                    </tr>
                  ))}

                  {targets.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ color: "#aaa", textAlign: "center" }}>
                        발송 대상이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>3. 문자 내용</h2>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {templates.map((t) => (
                <button
                  key={t.title}
                  className="btn secondary"
                  onClick={() => setMessage(t.text)}
                >
                  {t.title}
                </button>
              ))}
            </div>

            <textarea
              className="input"
              placeholder="[스트롱복싱 철산점] 문자 내용을 입력해주세요."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ minHeight: 190, width: "100%", resize: "none" }}
            />

            <div style={{ color: "#aaa", marginTop: 8 }}>
              글자수 {message.length}자 / 예상비용 약{" "}
              {cost.toLocaleString()}원
            </div>
          </div>
        </div>

        <div
          className="card"
          style={{
            position: "sticky",
            top: 20,
            borderRadius: 24,
          }}
        >
          <h2 style={{ marginTop: 0 }}>발송 확인</h2>

          <div
            style={{
              display: "grid",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div>
              <div style={{ color: "#aaa", fontSize: 13 }}>지점</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{branchName}</div>
            </div>

            <div>
              <div style={{ color: "#aaa", fontSize: 13 }}>대상</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>
                {selectedCount}명
              </div>
            </div>

            <div>
              <div style={{ color: "#aaa", fontSize: 13 }}>예상비용</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#2ee59d" }}>
                약 {cost.toLocaleString()}원
              </div>
            </div>
          </div>

          <div
            style={{
              background: "#0b1220",
              border: "1px solid #273244",
              borderRadius: 18,
              padding: 16,
              minHeight: 160,
              whiteSpace: "pre-wrap",
              color: message ? "#fff" : "#777",
              marginBottom: 18,
            }}
          >
            {message || "문자 미리보기"}
          </div>

          <input
            className="input"
            placeholder="테스트 받을 번호 예: 01012345678"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <button
            className="btn secondary"
            disabled={loading}
            onClick={() => sendSms(true)}
            style={{ width: "100%", marginBottom: 10 }}
          >
            테스트 발송
          </button>

          <button
            className="btn"
            disabled={loading}
            onClick={() => sendSms(false)}
            style={{ width: "100%", fontSize: 18 }}
          >
            단체문자 발송
          </button>

          <p style={{ color: "#888", fontSize: 13, lineHeight: 1.6 }}>
            단체문자 발송 전 테스트 발송을 먼저 권장합니다.
          </p>
        </div>
      </div>
    </AppShell>
  );
}