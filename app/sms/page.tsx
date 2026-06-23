"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const targetTypes = [
  { value: "BRANCH_MEMBERS", label: "전체 회원" },
  { value: "EXPIRING_7DAYS", label: "만료 7일 이내" },
  { value: "LOW_COUNT", label: "횟수 3회 이하" },
];

const templates = [
  { title: "휴관 공지", text: "[스트롱복싱]\n금일 내부 일정으로 인해 휴관입니다.\n이용에 참고 부탁드립니다." },
  { title: "만료 안내", text: "[스트롱복싱]\n회원권 만료가 얼마 남지 않았습니다.\n재등록 문의는 편하게 연락주세요." },
  { title: "이벤트 안내", text: "[스트롱복싱]\n현재 이벤트 진행중입니다.\n자세한 내용은 지점으로 문의해주세요." },
];

const estimateCost = (count: number, message: string) => {
  const price = message.length > 45 ? 45 : 20;
  return count * price;
};

export default function SmsPage() {
  const [user, setUser] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [branchName, setBranchName] = useState("");
  const [targetType, setTargetType] = useState("BRANCH_MEMBERS");
  const [targets, setTargets] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");

  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem("user") || "null");
    setUser(u);

    apiFetch("/api/settings?option_type=BRANCH")
      .then((r) => r.json())
      .then((d) => {
        const rows = d.rows || [];
        setBranches(rows);
        // 관장/코치는 본인 지점 고정, 대표/어드민은 첫 지점
        if (u?.role === "ADMIN" || u?.role === "OWNER") {
          setBranchName(rows[0]?.option_name || "");
        } else {
          setBranchName(u?.branch_name || "");
        }
      });
  }, []);

  const filteredTargets = targets.filter((t) => {
    const q = targetSearch.trim();
    if (!q) return true;
    return t.name?.includes(q) || t.phone?.includes(q) || t.checkin_code?.includes(q);
  });

  const selectedCount = selectedIds.length;
  const sendableCount = targets.filter((t) => selectedIds.includes(t.member_id) && t.phone).length;
  const noPhoneCount = targets.filter((t) => selectedIds.includes(t.member_id) && !t.phone).length;
  const excludedTargets = targets.filter((t) => !selectedIds.includes(t.member_id));
  const cost = estimateCost(sendableCount, message);

  const loadTargets = async () => {
    if (!branchName) return;
    const res = await apiFetch(
      `/api/sms/targets?branch_name=${encodeURIComponent(branchName)}&target_type=${targetType}`
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
    if (branchName) loadTargets();
  }, [branchName, targetType]);

  const toggle = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const sendSms = async (isTest = false) => {
    if (!message.trim()) return alert("문자 내용을 입력해주세요.");
    if (isTest && !testPhone.trim()) return alert("테스트 받을 번호를 입력해주세요.");
    if (!isTest && selectedIds.length === 0) return alert("발송 대상을 선택해주세요.");

    const count = isTest ? 1 : sendableCount;
    const finalCost = estimateCost(count, message);

    const ok = confirm(
      `📱 문자 발송 확인\n\n지점: ${branchName}\n대상: ${isTest ? "테스트 1명" : `${count}명`}\n예상비용: 약 ${finalCost.toLocaleString()}원\n\n내용:\n${message}\n\n정말 발송할까요?`
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
      alert(`✅ 발송 완료! ${data.sent_count}건 발송됐습니다.`);
    } else {
      alert(data.message || "문자 발송 실패");
    }
  };

  return (
    <AppShell title="문자 관리">
      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>단체 문자 발송</h1>
        <p style={{ color: "#aaa", marginTop: 6 }}>
          ① 지점·대상 선택 → ② 내용 작성 → ③ 테스트 발송 → ④ 단체 발송
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
        {/* 왼쪽 */}
        <div style={{ display: "grid", gap: 16 }}>

          {/* STEP 1 */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ background: "#3b82f6", color: "#fff", borderRadius: 999, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14 }}>1</div>
              <h2 style={{ margin: 0 }}>지점 · 대상 선택</h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {isAdminOrOwner ? (
                <select className="input" value={branchName} onChange={(e) => setBranchName(e.target.value)}>
                  {branches.map((b) => <option key={b.option_id}>{b.option_name}</option>)}
                </select>
              ) : (
                <div className="input" style={{ color: "#94a3b8", display: "flex", alignItems: "center" }}>
                  📍 {branchName}
                </div>
              )}

              <select className="input" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                {targetTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* STEP 2 */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "#3b82f6", color: "#fff", borderRadius: 999, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14 }}>2</div>
                <h2 style={{ margin: 0 }}>발송 대상 확인</h2>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn secondary" onClick={() => setSelectedIds(targets.map((t) => t.member_id))}>전체선택</button>
                <button className="btn secondary" onClick={() => setSelectedIds([])}>전체해제</button>
                <button className="btn secondary" onClick={loadTargets}>새로고침</button>
              </div>
            </div>

            {/* 요약 카드 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
              {[
                ["전체 대상", targets.length, "#94a3b8"],
                ["발송 선택", selectedCount, "#3b82f6"],
                ["실제 발송", sendableCount, "#22c55e"],
                ["번호 없음", noPhoneCount, "#ef4444"],
              ].map(([label, val, color]) => (
                <div key={label as string} style={{ background: "#0b1220", borderRadius: 12, padding: "12px 14px", textAlign: "center" }}>
                  <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>{label}</div>
                  <div style={{ color: color as string, fontSize: 24, fontWeight: 900, marginTop: 4 }}>{val}명</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 10 }}>
              <input
                className="input"
                placeholder="이름 / 전화번호 / 출석번호 검색"
                value={targetSearch}
                onChange={(e) => setTargetSearch(e.target.value)}
              />
              <button
                className="btn secondary"
                onClick={() => setSelectedIds(targets.filter((t) => Number(t.attendance_sms_enabled || 0) === 1).map((t) => t.member_id))}
              >
                출석알림 ON만
              </button>
            </div>

            <div style={{ maxHeight: 320, overflow: "auto", borderRadius: 12, border: "1px solid #1f2937" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#0b1220", position: "sticky", top: 0 }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontSize: 13 }}>선택</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontSize: 13 }}>이름</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontSize: 13 }}>전화번호</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontSize: 13 }}>회원권</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontSize: 13 }}>만료일</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontSize: 13 }}>출석문자</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTargets.map((t) => (
                    <tr
                      key={t.member_id}
                      onClick={() => toggle(t.member_id)}
                      style={{ cursor: "pointer", borderTop: "1px solid #1f2937", background: selectedIds.includes(t.member_id) ? "rgba(59,130,246,0.08)" : undefined }}
                    >
                      <td style={{ padding: "10px 12px" }}>
                        <input type="checkbox" checked={selectedIds.includes(t.member_id)} onChange={() => toggle(t.member_id)} onClick={(e) => e.stopPropagation()} />
                      </td>
                      <td style={{ padding: "10px 12px", fontWeight: 900 }}>{t.name}</td>
                      <td style={{ padding: "10px 12px", color: t.phone ? "#fff" : "#ef4444" }}>{t.phone || "번호없음"}</td>
                      <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 13 }}>{t.product_name || "-"}</td>
                      <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 13 }}>{t.end_date?.slice(0, 10) || "-"}</td>
                      <td style={{ padding: "10px 12px" }}>
                        {Number(t.attendance_sms_enabled || 0) === 1
                          ? <span style={{ color: "#22c55e", fontWeight: 900, fontSize: 13 }}>ON</span>
                          : <span style={{ color: "#4b5563", fontSize: 13 }}>OFF</span>}
                      </td>
                    </tr>
                  ))}
                  {filteredTargets.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "#4b5563" }}>대상이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* STEP 3 */}
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ background: "#3b82f6", color: "#fff", borderRadius: 999, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14 }}>3</div>
              <h2 style={{ margin: 0 }}>문자 내용 작성</h2>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {templates.map((t) => (
                <button key={t.title} className="btn secondary" onClick={() => setMessage(t.text)}>
                  {t.title}
                </button>
              ))}
            </div>

            <textarea
              className="input"
              placeholder={`[스트롱복싱 ${branchName}] 문자 내용을 입력해주세요.`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ minHeight: 160, width: "100%", resize: "none" }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, color: "#94a3b8", fontSize: 13 }}>
              <span>{message.length}자 {message.length > 45 ? <span style={{ color: "#f59e0b" }}>(장문 MMS)</span> : <span style={{ color: "#22c55e" }}>(단문 SMS)</span>}</span>
              <span>예상 비용 약 <strong style={{ color: "#fff" }}>{cost.toLocaleString()}원</strong></span>
            </div>
          </div>
        </div>

        {/* 오른쪽 사이드바 */}
        <div className="card" style={{ position: "sticky", top: 20 }}>
          <h2 style={{ marginTop: 0, marginBottom: 18 }}>발송 확인</h2>

          <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
            {[
              ["지점", branchName, "#fff"],
              ["발송 대상", `${selectedCount}명`, "#3b82f6"],
              ["실제 발송", `${sendableCount}명`, "#22c55e"],
              ["번호 없음", `${noPhoneCount}명`, noPhoneCount > 0 ? "#ef4444" : "#4b5563"],
              ["예상 비용", `약 ${cost.toLocaleString()}원`, "#f59e0b"],
            ].map(([label, val, color]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#0b1220", borderRadius: 10 }}>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>{label}</span>
                <span style={{ color: color as string, fontWeight: 900 }}>{val}</span>
              </div>
            ))}
          </div>

          {/* 미리보기 */}
          <div style={{ background: "#0b1220", border: "1px solid #273244", borderRadius: 14, padding: 14, minHeight: 120, whiteSpace: "pre-wrap", color: message ? "#fff" : "#4b5563", fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
            {message || "문자 미리보기"}
          </div>

          {/* 제외 회원 */}
          {excludedTargets.length > 0 && (
            <div style={{ background: "#1f2937", borderRadius: 10, padding: 12, marginBottom: 14, maxHeight: 100, overflow: "auto", fontSize: 12, color: "#94a3b8" }}>
              <div style={{ color: "#ef4444", fontWeight: 900, marginBottom: 4 }}>제외 {excludedTargets.length}명</div>
              {excludedTargets.slice(0, 15).map((t) => (
                <div key={t.member_id}>{t.name} / {t.phone || "번호없음"}</div>
              ))}
              {excludedTargets.length > 15 && <div>외 {excludedTargets.length - 15}명</div>}
            </div>
          )}

          <input
            className="input"
            placeholder="테스트 번호 (예: 01012345678)"
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            style={{ width: "100%", marginBottom: 10 }}
          />

          <button className="btn secondary" disabled={loading} onClick={() => sendSms(true)} style={{ width: "100%", marginBottom: 10 }}>
            테스트 발송
          </button>

          <button className="btn" disabled={loading || sendableCount === 0} onClick={() => sendSms(false)} style={{ width: "100%", fontSize: 17 }}>
            {loading ? "발송 중..." : `단체 발송 (${sendableCount}명)`}
          </button>

          <p style={{ color: "#4b5563", fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
            단체 발송 전 반드시 테스트 발송으로 내용을 확인하세요.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
