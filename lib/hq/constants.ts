export const BRANCHES = [
  {
    id: "gaebong",
    name: "개봉점",
    phone: "02-2678-1234",
    address: "서울시 구로구 개봉동",
    instagram: "strongboxing_gaebong",
    hours: "월-금 13:00~23:00",
  },
  {
    id: "sinjeong",
    name: "신정점",
    phone: "02-2643-1234",
    address: "서울시 양천구 신정동",
    instagram: "strongboxing_sinjeong",
    hours: "월-금 10:00~24:00 / 토 10:00~16:00",
  },
  {
    id: "mokdong",
    name: "목동점",
    phone: "02-2649-1234",
    address: "서울시 양천구 목동",
    instagram: "strongboxing_mokdong",
    hours: "월-금 14:00~24:00 / 토 11:00~16:00",
  },
  {
    id: "cheolsan",
    name: "철산점",
    phone: "02-2066-0406",
    address: "경기도 광명시 철산동 56-14 3층",
    instagram: "strongboxing_cheolsan",
    hours: "월-금 14:00~23:00 / 토일 14:00~18:00",
  },
  {
    id: "yeongdeungpo",
    name: "영등포점",
    phone: "02-2630-1234",
    address: "서울시 영등포구",
    instagram: "stron_gboxinggym",
    hours: "월-금 13:00~23:00",
  },
] as const;

export type BranchId = typeof BRANCHES[number]["id"];

export const HQ_BRAND = "STRONG HQ";
export const HQ_SUBTITLE = "STRONG BOXING 운영 시스템";
export const PRIMARY = "#E53935";
export const BG = "#0F1115";
export const CARD = "#181C22";
export const BORDER = "#2A313C";
export const TEXT = "#F8FAFC";
export const SUBTEXT = "#94A3B8";
