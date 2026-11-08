"use client";

import { useEffect, useRef, useState } from "react";
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

  .sms-auto-layout {
    grid-template-columns: 1fr !important;
  }

  .sms-auto-preview-col {
    position: static !important;
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

// 자동발송에서 지원하는 변수 목록 (auto-run/route.ts 와 동일)
const SUPPORTED_VARS = ["{name}", "{branch}", "{end_date}", "{remaining_count}"];
const EXAMPLE_VALUES: Record<string, string> = {
  "{name}": "홍길동",
  "{branch}": "목동점",
  "{end_date}": "2025-12-31",
  "{remaining_count}": "3",
};

const previewMessage = (msg: string): string => {
  let result = msg;
  SUPPORTED_VARS.forEach((v) => {
    result = result.replace(new RegExp(v.replace(/[{}]/g, "\\$&"), "g"), EXAMPLE_VALUES[v]);
  });
  return result;
};

/** 근사 EUC-KR 바이트 수 (한글=2, 나머지=1) */
const calcBytes = (text: string): number => {
  let bytes = 0;
  for (const ch of text) {
    bytes += ch.charCodeAt(0) > 127 ? 2 : 1;
  }
  return bytes;
};

const getUnsupportedVars = (msg: string): string[] => {
  const found = [...(msg.match(/\{[^}]+\}/g) || [])];
  return [...new Set(found.filter((v) => !SUPPORTED_VARS.includes(v)))];
};

export default function SmsPage() {
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<"send" | "auto">("auto");
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
  const [editCounts, setEditCounts] = useState<Record<number, number>>({});
  const [openMsgId, setOpenMsgId] = useState<number | null>(null);
  const [editMessages, setEditMessages] = useState<Record<number, string>>({});
  const [savedMessages, setSavedMessages] = useState<Record<number, string>>({});
  const [todayLogs, setTodayLogs] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState<Record<number, "saving" | "ok" | "err">>({});

  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    const saved = localStorage.getItem("user");
    const u = saved ? JSON.parse(saved) : null;
    const myBranch = u?.branch_name || null;
    const isAdmin = u?.role === "ADMIN" || u?.role === "OWNER";

    const res = await apiFetch("/api/sms/auto-rules");
    const data = await res.json();
    if (data.success) {
      const globalRules = data.rows || [];
      const branchRules: any[] = data.branchRules || [];

      const mergedRules = globalRules.map((r: any) => {
        if (!isAdmin && myBranch) {
          const override = branchRules.find(
            (b: any) => b.rule_type === r.rule_type && b.branch_name === myBranch
          );
          if (override) return { ...r, message: override.message, use_yn: override.use_yn, days: override.days, count_threshold: override.count_threshold, _hasOverride: true };
        }
        return r;
      });

      setAutoRules(mergedRules);
      const msgs: Record<number, string> = {};
      const days: Record<number, number> = {};
      const counts: Record<number, number> = {};
      mergedRules.forEach((r: any) => {
        msgs[r.rule_id] = r.message || "";
        days[r.rule_id] = r.days ?? 2;
        counts[r.rule_id] = r.count_threshold ?? 3;
      });
      setEditMessages(msgs);
      setSavedMessages({ ...msgs });
      setEditDays(days);
      setEditCounts(counts);
    }
  };

  const loadTodayLogs = async () => {
    const res = await apiFetch("/api/sms/logs");
    const data = await res.json();
    if (data.success) {
      const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
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
    setSaveStatus((prev) => ({ ...prev, [rule.rule_id]: "saving" }));
    const res = await apiFetch("/api/sms/auto-rules", {
      method: "PUT",
      body: JSON.stringify({
        rule_id: rule.rule_id,
        message: editMessages[rule.rule_id],
        use_yn: rule.use_yn,
        days: editDays[rule.rule_id] ?? rule.days,
        count: editCounts[rule.rule_id] ?? rule.count_threshold,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setSavedMessages((prev) => ({ ...prev, [rule.rule_id]: editMessages[rule.rule_id] }));
      setSaveStatus((prev) => ({ ...prev, [rule.rule_id]: "ok" }));
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [rule.rule_id]: undefined as any })), 2500);
    } else {
      setSaveStatus((prev) => ({ ...prev, [rule.rule_id]: "err" }));
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

  const insertVar = (ruleId: number, variable: string) => {
    const ta = textareaRef.current;
    const current = editMessages[ruleId] || "";
    if (!ta) {
      setEditMessages((prev) => ({ ...prev, [ruleId]: current + variable }));
      return;
    }
    const start = ta.selectionStart ?? current.length;
    const end = ta.selectionEnd ?? current.length;
    const next = current.slice(0, start) + variable + current.slice(end);
    setEditMessages((prev) => ({ ...prev, [ruleId]: next }));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
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
      `문자 발송 확인\n\n지점: ${branchName}\n대상: ${isTest ? "테스트 1명" : `${count}명`}\n예상비용: 약 ${finalCost.toLocaleString()}원\n\n내용:\n${message}\n\n정말 발송할까요?`
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

  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const todayLogsByBranch = ["철산점", "목동점", "개봉점", "신정점"].map((b) => ({
    branch: b,
    logs: todayLogs.filter((l) => l.branch_name === b),
  }));

  // 현재 열린 규칙
  const openRule = openMsgId !== null ? autoRules.find((r) => r.rule_id === openMsgId) : null;
  const openMsg = openMsgId !== null ? (editMessages[openMsgId] ?? "") : "";
  const openMsgPreview = previewMessage(openMsg);
  const openMsgBytes = calcBytes(openMsgPreview);
  const isUnsaved = openMsgId !== null && editMessages[openMsgId] !== savedMessages[openMsgId];
  const unsupportedVars = openMsgId !== null ? getUnsupportedVars(openMsg) : [];

  return (
    <AppShell title="문자 관리">
      <style>{isMobileStyle}</style>
      {/* 탭 */}
      <div style={{ display: "flex", borderBottom: "2px solid #E5E7EB", marginBottom: 24, gap: 0 }}>
        {[{ key: "auto", label: "자동발송 설정" }, { key: "send", label: "문자 발송" }].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            style={{
              padding: "10px 22px", cursor: "pointer",
              fontWeight: tab === t.key ? 700 : 500,
              fontSize: 14,
              border: "none",
              borderBottom: tab === t.key ? "2px solid #2563eb" : "2px solid transparent",
              marginBottom: -2,
              background: "transparent",
              color: tab === t.key ? "#2563eb" : "#9CA3AF",
              transition: "all .15s",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* ── 자동발송 설정 탭 ── */}
      {tab === "auto" && (
        <div
          className="sms-auto-layout"
          style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 24, alignItems: "start" }}
        >
          {/* 왼쪽: 규칙 목록 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: "var(--fg)" }}>자동 문자 설정</span>
              <span style={{ fontSize: 13, color: "var(--primary)", fontWeight: 600 }}>
                {isAdminOrOwnerUser ? "관리자 · 전체지점" : `관장 · ${user?.branch_name || ""}`}
              </span>
            </div>
            <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", borderRadius: 12, padding: "14px 18px", fontSize: 13, color: "#92400e", lineHeight: 1.6 }}>
              💡 자동 문자는 매일 오전 9시에 발송됩니다. 이미 오늘 발송된 번호는 중복 발송되지 않습니다. 문자 내용의{" "}
              <b>{"{name}"}</b> 회원 이름,{" "}<b>{"{branch}"}</b> 지점명,{" "}
              <b>{"{end_date}"}</b> 만료일,{" "}<b>{"{remaining_count}"}</b> 잔여 횟수로 자동 치환됩니다.
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0, marginBottom: 16 }}>발송 규칙</h2>
              {autoRules.length === 0 && <div style={{ color: "var(--muted)", fontSize: 14 }}>불러오는 중...</div>}
              {autoRules
                .filter((rule) => rule.rule_type !== "EXPIRING_7DAYS")
                .map((rule) => {
                  const isExpiring = rule.rule_type.startsWith("EXPIRING_") && !rule.rule_type.includes("TODAY");
                  const isLowCount = rule.rule_type === "LOW_COUNT";
                  const curDays = editDays[rule.rule_id] ?? rule.days ?? 2;
                  const curCount = editCounts[rule.rule_id] ?? rule.count_threshold ?? 3;
                  const isActive = rule.use_yn === "Y";
                  const hasUnsaved = editMessages[rule.rule_id] !== savedMessages[rule.rule_id];
                  const curSaveStatus = saveStatus[rule.rule_id];
                  const curMsgBytes = calcBytes(previewMessage(editMessages[rule.rule_id] || ""));
                  const curUnsupported = getUnsupportedVars(editMessages[rule.rule_id] || "");
                  return (
                    <div key={rule.rule_id} style={{ borderBottom: "1px solid #F3F4F6", padding: "16px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{ruleTypeLabel[rule.rule_type] || "자동 발송"}</div>
                          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4, display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                            {isExpiring ? (
                              <>
                                <span>회원권 종료</span>
                                <select
                                  value={curDays}
                                  onChange={(e) => setEditDays({ ...editDays, [rule.rule_id]: Number(e.target.value) })}
                                  style={{ fontSize: 13, padding: "2px 8px", borderRadius: 6, border: "1px solid #93C5FD", background: "#EFF6FF", color: "#1D4ED8", cursor: "pointer", fontWeight: 600 }}
                                >
                                  {[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d}일</option>)}
                                </select>
                                <span>전 자동 문자 발송</span>
                              </>
                            ) : isLowCount ? (
                              <>
                                <span>잔여 횟수</span>
                                <select
                                  value={curCount}
                                  onChange={(e) => setEditCounts({ ...editCounts, [rule.rule_id]: Number(e.target.value) })}
                                  style={{ fontSize: 13, padding: "2px 8px", borderRadius: 6, border: "1px solid #93C5FD", background: "#EFF6FF", color: "#1D4ED8", cursor: "pointer", fontWeight: 600 }}
                                >
                                  {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>{c}회</option>)}
                                </select>
                                <span>이하 회원에게 발송</span>
                              </>
                            ) : (
                              <span>{ruleTypeDesc[rule.rule_type] || "자동 문자 발송"}</span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <button
                            onClick={() => setOpenMsgId(openMsgId === rule.rule_id ? null : rule.rule_id)}
                            style={{ fontSize: 13, fontWeight: 500, color: "#374151", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap" }}
                          >문자 내용 {openMsgId === rule.rule_id ? "▴" : "▾"}</button>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                            padding: "3px 10px", borderRadius: 999,
                            background: isActive ? "#F0FDF4" : "#F3F4F6",
                            color: isActive ? "#16a34a" : "#9CA3AF",
                          }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block", flexShrink: 0 }} />
                            {isActive ? "활성" : "비활성"}
                          </span>
                          <label style={{ position: "relative", display: "inline-block", width: 48, height: 26, flexShrink: 0 }}>
                            <input type="checkbox" checked={isActive} onChange={(e) => toggleRule(rule, e.target.checked ? "Y" : "N")}
                              style={{ opacity: 0, width: 0, height: 0 }} />
                            <span onClick={() => toggleRule(rule, isActive ? "N" : "Y")} style={{
                              position: "absolute", inset: 0, borderRadius: 999, cursor: "pointer",
                              background: isActive ? "#22c55e" : "#D1D5DB", transition: "background .2s"
                            }}>
                              <span style={{
                                position: "absolute", width: 20, height: 20, top: 3, borderRadius: "50%",
                                background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "transform .2s",
                                transform: isActive ? "translateX(25px)" : "translateX(3px)"
                              }} />
                            </span>
                          </label>
                        </div>
                      </div>
                      {openMsgId === rule.rule_id && (
                        <div style={{ marginTop: 12, background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: "14px 16px" }}>
                          {/* 변수 삽입 칩 */}
                          <div style={{ marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: "#9CA3AF", marginRight: 8 }}>변수 삽입:</span>
                            {SUPPORTED_VARS.map((v) => (
                              <button
                                key={v}
                                onClick={() => insertVar(rule.rule_id, v)}
                                title="클릭하면 커서 위치에 삽입"
                                style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, border: "1px solid #93C5FD", background: "#EFF6FF", color: "#1D4ED8", cursor: "pointer", marginRight: 6, marginBottom: 4, fontWeight: 600 }}
                              >{v}</button>
                            ))}
                          </div>
                          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>발송 문자 내용</div>
                          <textarea
                            ref={textareaRef}
                            value={editMessages[rule.rule_id] || ""}
                            onChange={(e) => setEditMessages({ ...editMessages, [rule.rule_id]: e.target.value })}
                            style={{ width: "100%", minHeight: 110, resize: "vertical", fontSize: 13, lineHeight: 1.7, padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", color: "#111827", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
                          />
                          {/* 바이트 수 / SMS·LMS 구분 (근사 EUC-KR 기준) */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, flexWrap: "wrap", gap: 6 }}>
                            <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                              <span>치환 후 약 {curMsgBytes}바이트 · </span>
                              <span style={{ fontWeight: 600, color: curMsgBytes > 90 ? "#f59e0b" : "#22c55e" }}>
                                {curMsgBytes > 90 ? "LMS" : "SMS"}
                              </span>
                              <span style={{ marginLeft: 4, color: "#bbb" }}>(근사 EUC-KR 기준)</span>
                            </div>
                            {hasUnsaved && curSaveStatus !== "ok" && (
                              <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>● 저장 전 변경사항</span>
                            )}
                            {curSaveStatus === "ok" && (
                              <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>✓ 저장됨</span>
                            )}
                            {curSaveStatus === "err" && (
                              <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>✕ 저장 실패</span>
                            )}
                          </div>
                          {/* 미지원 변수 경고 */}
                          {curUnsupported.length > 0 && (
                            <div style={{ marginTop: 8, padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
                              ⚠️ 지원하지 않는 변수가 포함되어 있습니다: <b>{curUnsupported.join(", ")}</b> — 실제 발송 시 그대로 전송됩니다.
                            </div>
                          )}
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                            <button onClick={() => setOpenMsgId(null)} style={{ fontSize: 13, fontWeight: 600, padding: "8px 20px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#F3F4F6", color: "#374151", cursor: "pointer" }}>닫기</button>
                            <button
                              onClick={() => saveAutoRule(rule)}
                              disabled={curSaveStatus === "saving"}
                              style={{ fontSize: 13, fontWeight: 700, padding: "8px 20px", borderRadius: 8, border: "none", background: curSaveStatus === "saving" ? "#93C5FD" : "#2563eb", color: "#fff", cursor: curSaveStatus === "saving" ? "default" : "pointer" }}
                            >{curSaveStatus === "saving" ? "저장 중..." : "저장"}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "20px 24px" }}>
              <div style={{ marginBottom: 18 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>오늘 자동 발송 현황</span>
                <span style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 400, marginLeft: 8 }}>{todayStr}</span>
              </div>
              {todayLogsByBranch.filter((b) => !isAdminOrOwnerUser ? b.branch === user?.branch_name : true).map((b, i, arr) => {
                const activeRuleTypes = new Set(autoRules.filter((r) => r.use_yn === "Y").map((r: any) => r.rule_type));
                const activeLogs = b.logs.filter((l: any) => activeRuleTypes.has(l.target_type));
                const ruleGroups: Record<string, number> = {};
                activeLogs.forEach((l: any) => {
                  const label = ruleTypeLabel[l.target_type] || l.target_type;
                  ruleGroups[label] = (ruleGroups[label] || 0) + 1;
                });
                const groupEntries = Object.entries(ruleGroups);
                return (
                  <div key={b.branch} style={{ padding: "14px 0", borderBottom: i < arr.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{b.branch}</div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: activeLogs.length > 0 ? "#2563eb" : "#9CA3AF" }}>
                        {activeLogs.length > 0 ? `총 ${activeLogs.length}명` : "0명"}
                      </div>
                    </div>
                    {groupEntries.length > 0 ? (
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                        {groupEntries.map(([label, count]) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span style={{ color: "#6B7280" }}>{label}</span>
                            <span style={{ color: "#2563eb", fontWeight: 600 }}>{count}명</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>{b.logs.length > 0 ? "활성 규칙 발송 없음" : "해당 없음"}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 오른쪽: 미리보기 패널 */}
          <div
            className="sms-auto-preview-col"
            style={{ position: "sticky", top: 20, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "20px 20px 16px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                문자 미리보기
              </div>
              {openRule ? (
                <>
                  <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 14 }}>
                    {ruleTypeLabel[openRule.rule_type] || "자동 발송"} · {ruleTypeDesc[openRule.rule_type] || ""}
                  </div>
                  {/* 발송 문자 박스 */}
                  <div style={{
                    background: "#F3F4F6", borderRadius: 10, padding: "14px 16px",
                    fontSize: 14, lineHeight: 1.75, color: "#111827",
                    whiteSpace: "pre-wrap", minHeight: 80, wordBreak: "break-all",
                  }}>
                    {openMsgPreview || <span style={{ color: "#9CA3AF" }}>내용 없음</span>}
                  </div>
                  {/* 바이트 / SMS·LMS */}
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>약 {openMsgBytes}바이트</span>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999,
                      background: openMsgBytes > 90 ? "#FEF3C7" : "#F0FDF4",
                      color: openMsgBytes > 90 ? "#92400E" : "#166534",
                    }}>{openMsgBytes > 90 ? "LMS" : "SMS"}</span>
                  </div>
                  {/* 미지원 변수 경고 */}
                  {unsupportedVars.length > 0 && (
                    <div style={{ marginTop: 10, padding: "8px 10px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626" }}>
                      ⚠️ 미지원 변수: <b>{unsupportedVars.join(", ")}</b>
                    </div>
                  )}
                  {isUnsaved && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>● 저장 전 변경사항</div>
                  )}
                  {/* 예시 데이터 안내 */}
                  <div style={{ marginTop: 14, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
                    예시 데이터 · 실제 발송되지 않음
                  </div>
                  {/* 예시 치환 목록 */}
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                    {SUPPORTED_VARS.map((v) => (
                      openMsg.includes(v) && (
                        <div key={v} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <code style={{ color: "#6B7280" }}>{v}</code>
                          <span style={{ color: "#2563eb", fontWeight: 600 }}>→ {EXAMPLE_VALUES[v]}</span>
                        </div>
                      )
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ color: "#9CA3AF", fontSize: 13, marginTop: 10, textAlign: "center", padding: "24px 0" }}>
                  규칙의 <b>문자 내용 ▾</b>을<br />펼치면 미리보기가 표시됩니다.
                </div>
              )}
            </div>

            {/* 지원 변수 안내 */}
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>지원 변수</div>
              {[
                ["{name}", "회원 이름"],
                ["{branch}", "지점명"],
                ["{end_date}", "만료일 (YYYY-MM-DD)"],
                ["{remaining_count}", "잔여 횟수"],
              ].map(([v, desc]) => (
                <div key={v} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: 4, borderBottom: "1px solid #F3F4F6" }}>
                  <code style={{ fontSize: 12, color: "#2563eb", fontWeight: 700 }}>{v}</code>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>{desc}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 12, color: "#9CA3AF" }}>
                지원하지 않는 변수 입력 시 그대로 발송됩니다.
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "send" && (
        <div
          className="sms-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 360px)",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h2>1. 발송 설정</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {(user?.role === "ADMIN" || user?.role === "OWNER") ? (
                  <select className="input" value={branchName} onChange={(e) => setBranchName(e.target.value)}>
                    {branches.map((b) => <option key={b}>{b}</option>)}
                  </select>
                ) : (
                  <input className="input" value={branchName} readOnly style={{ background: "var(--panel2)", color: "var(--muted)" }} />
                )}
                <select className="input" value={targetType} onChange={(e) => setTargetType(e.target.value)}>
                  {targetTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
                <h2>2. 발송 대상</h2>
                <div className="row">
                  <button className="btn secondary" onClick={() => setSelectedIds(targets.map((t) => t.member_id))}>전체선택</button>
                  <button className="btn secondary" onClick={() => setSelectedIds([])}>전체해제</button>
                  <button className="btn secondary" onClick={loadTargets}>새로고침</button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 12 }}>
                <input className="input" placeholder="회원명 / 전화번호 / 출석번호 검색" value={targetSearch} onChange={(e) => setTargetSearch(e.target.value)} />
                <button className="btn secondary" onClick={() => {
                  const ids = targets.filter((t) => Number(t.attendance_sms_enabled || 0) === 1).map((t) => t.member_id);
                  setSelectedIds(ids);
                }}>출석 알림문자 ON만</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
                <div className="card"><h3>전체 대상</h3><div className="num">{filteredTargets.length}명</div></div>
                <div className="card"><h3>발송 선택</h3><div className="num" style={{ color: "#2ee59d" }}>{selectedCount}명</div></div>
                <div className="card"><h3>제외</h3><div className="num" style={{ color: "#ff4d6d" }}>{excludedCount}명</div></div>
              </div>
              <div className="sms-table-wrap" style={{ maxHeight: 360, overflow: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>선택</th><th>이름</th><th>전화번호</th><th>출석번호</th><th>보호자문자</th><th>회원권</th><th>만료일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTargets.map((t) => (
                      <tr key={t.member_id}>
                        <td><input type="checkbox" checked={selectedIds.includes(t.member_id)} onChange={() => toggle(t.member_id)} /></td>
                        <td style={{ fontWeight: 900 }}>{t.name}</td>
                        <td style={{ color: t.phone ? undefined : "#ff4d6d", fontWeight: t.phone ? undefined : 700 }}>{t.phone || "번호없음"}</td>
                        <td>{t.checkin_code || "-"}</td>
                        <td>{Number(t.attendance_sms_enabled || 0) === 1 ? <span style={{ color: "#2ee59d", fontWeight: 900 }}>ON</span> : <span style={{ color: "#666" }}>OFF</span>}</td>
                        <td>{t.product_name || "-"}</td>
                        <td>{t.end_date?.slice(0, 10) || "-"}</td>
                      </tr>
                    ))}
                    {targets.length === 0 && (
                      <tr><td colSpan={7} style={{ color: "#aaa", textAlign: "center" }}>발송 대상이 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h2>3. 문자 내용</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                {templates.map((t) => (
                  <button key={t.title} className="btn secondary" onClick={() => setMessage(t.text)}>{t.title}</button>
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
                글자수 {message.length}자 / 예상비용 약 {cost.toLocaleString()}원
              </div>
            </div>
          </div>

          <div className="card sms-side" style={{ position: "sticky", top: 20, borderRadius: 24, maxWidth: "100%" }}>
            <h2 style={{ marginTop: 0 }}>발송 확인</h2>
            <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
              <div><div style={{ color: "#aaa", fontSize: 13 }}>지점</div><div style={{ fontSize: 22, fontWeight: 900 }}>{branchName}</div></div>
              <div><div style={{ color: "#aaa", fontSize: 13 }}>대상</div><div style={{ fontSize: 22, fontWeight: 900 }}>{selectedCount}명</div></div>
              <div><div style={{ color: "#aaa", fontSize: 13 }}>실제 발송가능</div><div style={{ fontSize: 22, fontWeight: 900, color: "#2ee59d" }}>{sendableCount}명</div></div>
              <div><div style={{ color: "#aaa", fontSize: 13 }}>번호없음</div><div style={{ fontSize: 22, fontWeight: 900, color: "#ff4d6d" }}>{noPhoneTargets.length}명</div></div>
              <div><div style={{ color: "#aaa", fontSize: 13 }}>예상비용</div><div style={{ fontSize: 22, fontWeight: 900, color: "#2ee59d" }}>약 {cost.toLocaleString()}원</div></div>
            </div>
            <div style={{ background: "#0b1220", border: "1px solid #273244", borderRadius: 18, padding: 16, minHeight: 160, whiteSpace: "pre-wrap", color: message ? "#fff" : "#777", marginBottom: 18 }}>
              {message || "문자 미리보기"}
            </div>
            {excludedTargets.length > 0 && (
              <div style={{ background: "#111827", borderRadius: 14, padding: 12, marginBottom: 12, maxHeight: 120, overflow: "auto", color: "#aaa", fontSize: 13 }}>
                <div style={{ color: "#ff4d6d", fontWeight: 900, marginBottom: 6 }}>제외회원 {excludedTargets.length}명</div>
                {excludedTargets.slice(0, 20).map((t) => <div key={t.member_id}>- {t.name} / {t.phone || "번호없음"}</div>)}
                {excludedTargets.length > 20 && <div style={{ marginTop: 6 }}>외 {excludedTargets.length - 20}명</div>}
              </div>
            )}
            <input className="input" placeholder="테스트 받을 번호 예: 01012345678" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
            <button className="btn secondary" disabled={loading} onClick={() => sendSms(true)} style={{ width: "100%", marginBottom: 10 }}>테스트 발송</button>
            <button className="btn" disabled={loading} onClick={() => sendSms(false)} style={{ width: "100%", fontSize: 18 }}>단체문자 발송</button>
            <p style={{ color: "#888", fontSize: 13, lineHeight: 1.6 }}>단체문자 발송 전 테스트 발송을 먼저 권장합니다.</p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
