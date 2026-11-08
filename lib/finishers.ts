/** 오늘의 마무리 운동 공통 검증 */
export type FinisherItem = { name: string; amount: string; note?: string | null };

export const DEFAULT_EXERCISES = [
  "스쿼트", "점핑잭", "버피", "마운틴 클라이머", "플랭크", "푸시업", "런지", "싯업", "크런치",
  "줄넘기", "섀도 복싱", "니업", "레그레이즈", "하이니", "스쿼트 점프", "사이드 플랭크",
];
export const AMOUNT_PRESETS = ["10회", "15회", "20회", "30회", "30초", "40초", "1분"];

export function normalizeItems(raw: unknown): FinisherItem[] {
  const arr = Array.isArray(raw) ? raw : [];
  const items = arr.slice(0, 3).map((i: any) => ({
    name: String(i?.name || "").trim().slice(0, 40),
    amount: String(i?.amount || "").trim().slice(0, 20),
    note: String(i?.note || "").trim().slice(0, 200) || null,
  }));
  while (items.length < 3) items.push({ name: "", amount: "", note: null });
  return items;
}

/** 게시 조건: 운동 3개 모두 운동명 + 횟수/시간 */
export function publishProblem(items: FinisherItem[]) {
  const missing = items.findIndex((i) => !i.name || !i.amount);
  return missing >= 0 ? `${missing + 1}번 운동의 운동명과 횟수(또는 시간)를 입력해 주세요.` : null;
}

export const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
