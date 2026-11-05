"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { apiFetch } from "@/lib/api";

const isMobileStyle = `
@media (max-width: 900px) {
  .sms-layout {
    grid-template-columns: 1fr !important;
  }

  .sms-side {
    position: static !important;
  }

  .sms-target-grid {
    grid-template-columns: 1fr !important;
  }

  .sms-summary-grid {
    grid-template-columns: 1fr !important;
  }

  .sms-table-wrap {
    overflow-x: auto;
  }

  .sms-table-wrap table {
    min-width: 720px;
  }
}
`;

const branches = ["철산점", "목동점", "개봉점", "신정점"];

const targetTypes = [
  { value: "BRANCH_MEMBERS", label: "지점 전체 회원" },
  { value: "EXPIRING_3DAYS", label: "만료 3일 이내 회원" },
  { value: "LOW_COUNT", label: "횟수 3회 이하 회원" },
];

const templates = [
  {
    title: "휴관 공지",
    text: "[스트롱복싱]\n금일 내부 일정으로 인해 휴관입니다.\n이용에 참고 부탁드립니다.",
  },
  {
    title: "만료 안내",
    text: "[스트롱복싱]\n안녕하세요 회원님 🥊\n회원권 종료 2일 전이라 미리 문자드립니다!\n\n재등록 문의는 편하게 연락주세요\n(자동발송)",
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
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<"send" | "auto">("send");
  const [branchName, setBranchName] = useState("");
  const [targetType, setTargetType] = useState("BRANCH_MEMBERS");
  const [targets, setTargets] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [targetSearch, setTargetSearch] = useState("");

  const [autoRules, setAutoRules] = useState<any[]>([]);
  const [editDays, setEditDays] = useState<Record<number, number>>({});
  const [openMsgId, setOpenMsgId] = useState<number | null>(null);
  const [editMessages, setEditMessages] = useState<Record<number, string>>({});
  const [todayLogs, setTodayLogs] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      const u = JSON.parse(saved);
      setUser(u);
      const isAdminOrOwner = u.role === "ADMIN" || u.role === "OWNER";
      setBranchName(isAdminOrOwner ? "철산점" : u.branch_name || "철산점");
    }
  }, []);

  const loadAutoRules = async () => {
    const res = await apiFetch("/api/sms/auto-rules");
    const data = await res.json();
    if (data.success) {
      setAutoRules(data.rows || []);
      const msgs: Record<number, string> = {};
      const days: Record<number, number> = {};
      (data.rows || []).forEach((r: any) => { msgs[r.rule_id] = r.message || ""; days[r.rule_id] = r.days ?? 2; });
      setEditMessages(msgs);
      setEditDays(days);
    }
  };

  const loadTodayLogs = async () => {
    const res = await apiFetch("/api/sms/logs");
    const data = await res.json();
    if (data.success) {
      const today = new Date().toISOString().slice(0, 10);
      const filtered = (data.rows || []).filter((r: any) =>
        r.provider === "AUTO" && r.created_at?.slice(0, 10) === today
      );
      setTodayLogs(filtered);
    }
  };

  useEffect(() => {
    if (tab === "auto") {
      loadAutoRules();
      loadTodayLogs();
    }
  }, [tab]);

  const saveAutoRule = async (rule: any) => {
    const res = await apiFetch("/api/sms/auto-rules", {
      method: "PUT",
      body: JSON.stringify({
        rule_id: rule.rule_id,
        message: editMessages[rule.rule_id],
        use_yn: rule.use_yn,
        days: editDays[rule.rule_id] ?? rule.days,
        count: rule.count_threshold,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setOpenMsgId(null);
      alert("저장되었습니다.");
      loadAutoRules();
    } else {
      alert(data.message || "저장 실패");
    }
  };

  const toggleRule = async (rule: any, use_yn: string) => {
    await apiFetch("/api/sms/auto-rules", {
      method: "PUT",
      body: JSON.stringify({ rule_id: rule.rule_id, use_yn }),
    });
    loadAutoRules();
  };

  const isAdminOrOwnerUser = user?.role === "ADMIN" || user?.role === "OWNER";

  const filteredTargets = targets.filter((t) => {
  const q = targetSearch.trim();

    if (!q) return true;

    return (
      t.name?.includes(q) ||
      t.phone?.includes(q) ||
      t.checkin_code?.includes(q) ||
      t.member_no?.includes(q)
    );
  });

  const sendableCount = targets.filter(
    (t) => selectedIds.includes(t.member_id) && t.phone
  ).length;

  const noPhoneTargets = targets.filter(
    (t) => selectedIds.includes(t.member_id) && !t.phone
  );

  const excludedTargets = targets.filter(
    (t) => !selectedIds.includes(t.member_id)
  );

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
    if (!branchName) return;
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

  const ruleTypeLabel: Record<string, string> = {
    EXPIRING_2DAYS: "만료 예정 안내",
    EXPIRING_3DAYS: "만료 예정 안내",
    EXPIRING_7DAYS: "만료 예정 안내",
    EXPIRING_TODAY: "당일 만료 안내",
    LOW_COUNT: "횟수 부족 안내",
    CRM_TODAY: "상담 재연락 알림",
  };

  const ruleTypeDesc: Record<string, string> = {
    EXPIRING_2DAYS: "회원권 종료 2일 전 자동 문자 발송",
    EXPIRING_3DAYS: "회원권 종료 3일 전 자동 문자 발송",
    EXPIRING_7DAYS: "회원권 종료 7일 전 자동 문자 발송",
    EXPIRING_TODAY: "오늘 회원권이 만료되는 회원에게 발송",
    LOW_COUNT: "잔여 횟수 3회 이하 회원에게 발송",
    CRM_TODAY: "오늘 재연락 예정인 상담 고객에게 발송",
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLogsByBranch = ["철산점", "목동점", "개봉점", "신정점"].map(b => ({
    branch: b,
    logs: todayLogs.filter(l => l.branch_name === b),
  }));

  return (
  <AppShell title="문자 관리">
    <style>{isMobileStyle}</style>
      {/* 탭 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {[{ key: "send", label: "문자 발송" }, { key: "auto", label: "자동발송 설정" }].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            style={{
              padding: "10px 22px", borderRadius: 10, cursor: "pointer",
              fontWeight: 700, fontSize: 14,
              border: tab === t.key ? "2px solid var(--primary)" : "2px solid var(--border)",
              background: tab === t.key ? "var(--primary)" : "var(--card)",
              color: tab === t.key ? "#fff" : "var(--muted)",
              transition: "all .15s",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* 자동발송 설정 탭 */}
      {tab === "auto" && (
        <div style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#92400e" }}>
            💡 자동 문자는 매일 오전 9시에 발송됩니다. <b>{"{name}"}</b>은 회원 이름으로 자동 치환됩니다. 이미 오늘 발송된 번호는 중복 발송되지 않습니다.
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>발송 규칙</h2>
            {autoRules.length === 0 && <div style={{ color: "var(--muted)", fontSize: 14 }}>불러오는 중...</div>}
            {autoRules.map(rule => {
              const isExpiring = rule.rule_type.startsWith("EXPIRING_") && !rule.rule_type.includes("TODAY");
              const curDays = editDays[rule.rule_id] ?? rule.days ?? 2;
              const descText = isExpiring
                ? `회원권 종료 ${curDays}일 전 자동 문자 발송`
                : (ruleTypeDesc[rule.rule_type] || "자동 문자 발송");
              return (
              <div key={rule.rule_id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{ruleTypeLabel[rule.rule_type] || "자동 발송"}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {isExpiring && isAdminOrOwnerUser ? (
                        <>
                          <span>회원권 종료</span>
                          <select
                            value={curDays}
                            onChange={e => setEditDays({ ...editDays, [rule.rule_id]: Number(e.target.value) })}
                            style={{ fontSize: 12, padding: "1px 4px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--fg)", cursor: "pointer" }}
                          >
                            {[1,2,3,5,7].map(d => <option key={d} value={d}>{d}일 전</option>)}
                          </select>
                          <span>자동 문자 발송</span>
                        </>
                      ) : (
                        <span>{descText}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      onClick={() => setOpenMsgId(openMsgId === rule.rule_id ? null : rule.rule_id)}
                      style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", background: "none", border: "1px solid var(--primary)", borderRadius: 8, padding: "4px 12px", cursor: "pointer" }}
                    >문자 내용 {openMsgId === rule.rule_id ? "▴" : "▾"}</button>
                    {isAdminOrOwnerUser && (
                      <label style={{ position: "relative", display: "inline-block", width: 44, height: 24, flexShrink: 0 }}>
                        <input type="checkbox" checked={rule.use_yn === "Y"} onChange={e => toggleRule(rule, e.target.checked ? "Y" : "N")}
                          style={{ opacity: 0, width: 0, height: 0 }} />
                        <span onClick={() => toggleRule(rule, rule.use_yn === "Y" ? "N" : "Y")} style={{
                          position: "absolute", inset: 0, borderRadius: 999, cursor: "pointer",
                          background: rule.use_yn === "Y" ? "#22c55e" : "var(--border)", transition: "background .2s"
                        }}>
                          <span style={{
                            position: "absolute", width: 18, height: 18, top: 3, borderRadius: "50%",
                            background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "transform .2s",
                            transform: rule.use_yn === "Y" ? "translateX(23px)" : "translateX(3px)"
                          }} />
                        </span>
                      </label>
                    )}
                    {!isAdminOrOwnerUser && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
                        background: rule.use_yn === "Y" ? "#f0fdf4" : "var(--panel2)",
                        color: rule.use_yn === "Y" ? "#16a34a" : "var(--muted)",
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                        {rule.use_yn === "Y" ? "활성" : "비활성"}
                      </span>
                    )}
                  </div>
                </div>
                {openMsgId === rule.rule_id && (
                  <div style={{ marginTop: 12, background: "var(--panel2)", borderRadius: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 8 }}>발송 문자 내용</div>
                    <textarea
                      value={editMessages[rule.rule_id] || ""}
                      onChange={e => setEditMessages({ ...editMessages, [rule.rule_id]: e.target.value })}
                      className="input"
                      style={{ width: "100%", minHeight: 100, resize: "vertical", fontSize: 13, lineHeight: 1.6 }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                      <button onClick={() => setOpenMsgId(null)} style={{ fontSize: 13, fontWeight: 600, padding: "7px 18px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--fg)", cursor: "pointer" }}>닫기</button>
                      <button onClick={() => saveAutoRule(rule)} style={{ fontSize: 13, fontWeight: 700, padding: "7px 18px", borderRadius: 8, border: "none", background: "var(--primary)", color: "#fff", cursor: "pointer" }}>저장</button>
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0, marginBottom: 16 }}>
              오늘 자동 발송 현황 <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>{todayStr}</span>
            </h2>
            {todayLogs.length === 0 ? (
              <div style={{ color: "var(--muted)", fontSize: 14 }}>오늘 자동 발송 내역이 없습니다.</div>
            ) : (
              todayLogsByBranch.filter(b => !isAdminOrOwnerUser ? b.branch === user?.branch_name : true).map(b => (
                <div key={b.branch} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{b.branch}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                      {b.logs.length > 0 ? [...new Set(b.logs.map((l: any) => ruleTypeLabel[l.target_type] || l.target_type))].join(", ") : "해당 없음"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: b.logs.length > 0 ? "var(--primary)" : "var(--muted)" }}>{b.logs.length}명 발송</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{b.logs[0]?.created_at?.slice(11, 16) || "-"}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "send" && (

      <div
        className="sms-layout"
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) minmax(320px, 360px)",
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
              {(user?.role === "ADMIN" || user?.role === "OWNER") ? (
                <select
                  className="input"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                >
                  {branches.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              ) : (
                <input className="input" value={branchName} readOnly style={{ background: "var(--panel2)", color: "var(--muted)" }} />
              )}

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
                gridTemplateColumns: "1fr auto",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <input
                className="input"
                placeholder="회원명 / 전화번호 / 출석번호 검색"
                value={targetSearch}
                onChange={(e) => setTargetSearch(e.target.value)}
              />

              <button
                className="btn secondary"
                onClick={() => {
                  const ids = targets
                    .filter((t) => Number(t.attendance_sms_enabled || 0) === 1)
                    .map((t) => t.member_id);

                  setSelectedIds(ids);
                }}
              >
                출석 알림문자 ON만
              </button>
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
                <div className="num">{filteredTargets.length}명</div>
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

            <div
              className="sms-table-wrap"
              style={{ maxHeight: 360, overflow: "auto" }}
            >
              <table>
                <thead>
                  <tr>
                    <th>선택</th>
                    <th>이름</th>
                    <th>전화번호</th>
                    <th>출석번호</th>
                    <th>보호자문자</th>
                    <th>회원권</th>
                    <th>만료일</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredTargets.map((t) => (
                    <tr key={t.member_id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.member_id)}
                          onChange={() => toggle(t.member_id)}
                        />
                      </td>

                      <td style={{ fontWeight: 900 }}>{t.name}</td>
                      <td
                        style={{
                          color: t.phone ? undefined : "#ff4d6d",
                          fontWeight: t.phone ? undefined : 700,
                        }}
                      >
                        {t.phone || "번호없음"}
                      </td>
                      <td>{t.checkin_code || "-"}</td>

                      <td>
                        {Number(t.attendance_sms_enabled || 0) === 1 ? (
                          <span style={{ color: "#2ee59d", fontWeight: 900 }}>ON</span>
                        ) : (
                          <span style={{ color: "#666" }}>OFF</span>
                        )}
                      </td>

                      <td>{t.product_name || "-"}</td>
                      <td>{t.end_date?.slice(0, 10) || "-"}</td>
                    </tr>
                  ))}

                  {targets.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ color: "#aaa", textAlign: "center" }}>
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
          className="card sms-side"
          style={{
            position: "sticky",
            top: 20,
            borderRadius: 24,
            maxWidth: "100%"
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
              <div style={{ color: "#aaa", fontSize: 13 }}>실제 발송가능</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#2ee59d" }}>
                {sendableCount}명
              </div>
            </div>

            <div>
              <div style={{ color: "#aaa", fontSize: 13 }}>번호없음</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#ff4d6d" }}>
                {noPhoneTargets.length}명
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

          {excludedTargets.length > 0 && (
          <div
            style={{
              background: "#111827",
              borderRadius: 14,
              padding: 12,
              marginBottom: 12,
              maxHeight: 120,
              overflow: "auto",
              color: "#aaa",
              fontSize: 13,
            }}
          >
            <div style={{ color: "#ff4d6d", fontWeight: 900, marginBottom: 6 }}>
              제외회원 {excludedTargets.length}명
            </div>

            {excludedTargets.slice(0, 20).map((t) => (
              <div key={t.member_id}>
                - {t.name} / {t.phone || "번호없음"}
              </div>
            ))}

            {excludedTargets.length > 20 && (
              <div style={{ marginTop: 6 }}>
                외 {excludedTargets.length - 20}명
              </div>
            )}
          </div>
        )}

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
      )}
       </AppShell>
  );
}