import pool from "@/lib/db";

// One-time SEO metadata batch update for existing blog posts.
// POST /api/hq/batch-update-posts-seo  — no body needed
// Returns { success, updated, skipped }

const UPDATES: { slug: string; title: string; description: string }[] = [
  // ── 철산점 ──────────────────────────────────────────────────────────────
  {
    slug: "before-choosing-cheolsan-boxing-gym-check-class-atmosphere",
    title: "철산 복싱장 수업 분위기 솔직 후기 | 스트롱복싱 철산점",
    description: "철산동·광명 복싱장 선택 전 실제 수업 분위기를 미리 확인하세요. 스트롱복싱 철산점, 관장 직접 지도, 초보자도 편안한 환경.",
  },
  {
    slug: "cheolsan-boxing-gym-workout",
    title: "철산동 복싱 개인 맞춤 지도 | 스트롱복싱 철산점 수업",
    description: "철산동 복싱 개인별 맞춤 지도로 초보자도 빠르게 실력이 늘어납니다. 광명·철산 지역 관장 직접 1:1 지도.",
  },
  {
    slug: "gwangmyeong-cheolsan-boxing-basic-structured-training",
    title: "광명 복싱 기본기부터 체계적으로 | 스트롱복싱 철산점",
    description: "철산동·광명 복싱 기본기부터 차근차근 배우는 체계적인 수업. 초보자부터 실전까지 관장 직접 지도.",
  },
  {
    slug: "gwangmyeong-boxing-stongboxing-cheolsan",
    title: "광명 복싱장 추천 | 회원들이 꾸준히 찾는 스트롱복싱 철산점",
    description: "광명·철산동 복싱장 스트롱복싱 철산점. 꾸준히 재등록하는 회원이 많은 이유, 직접 확인해보세요.",
  },
  {
    slug: "no-class-time-strongboxing-cheolsan-routine",
    title: "철산 복싱 운동 루틴 | 자유롭게 다니는 스트롱복싱 철산점",
    description: "정해진 수업시간 없이 원하는 시간에 운동할 수 있는 스트롱복싱 철산점 루틴. 직장인·학생 모두 환영.",
  },
  // ── 목동점 ──────────────────────────────────────────────────────────────
  {
    slug: "yangcheon-health-mokdong-diet-boxing-class-experience",
    title: "목동 다이어트 복싱 수업 체험기 | 스트롱복싱 목동점",
    description: "목동·오목교 근처 다이어트 복싱 수업 체험기. 초보자도 부담 없이 땀 흘리는 목동 스트롱복싱 수업 현장.",
  },
  {
    slug: "yangcheon-boxing-members-consistent-reasons-check-in-class",
    title: "목동 복싱장 회원 후기 | 꾸준히 다니는 이유가 있습니다",
    description: "목동·양천 복싱 회원들이 꾸준히 재등록하는 이유. 처음엔 반신반의했지만 직접 다녀보니 달랐던 스트롱복싱 목동점 솔직 후기.",
  },
  {
    slug: "mokdong-boxing-fun-and-fitness",
    title: "목동 운동 추천 | 복싱으로 체력·스트레스 해소까지",
    description: "목동에서 재미있게 할 수 있는 운동 찾는다면? 스트롱복싱 목동점에서 체력·다이어트·스트레스 해소를 한 번에.",
  },
  {
    slug: "mokdong-boxing-family-friendly-entry-guide",
    title: "목동 복싱장 추천 | 가족·학생·초보자 환영 스트롱복싱 목동점",
    description: "목동·목5동 복싱장. 중학생·고등학생·성인 가족 단위 수업 가능. 관장 직접 지도로 안전하게 배우는 복싱.",
  },
  {
    slug: "yangcheon-boxing-mokdong-gym-summer-special-class-morning-session",
    title: "목동 복싱 방학특강 | 학생 복싱 수업 스트롱복싱 목동점",
    description: "방학 중 목동 복싱 특강 수업 운영. 중학생·고등학생·초등학생 대상 수업. 스트롱복싱 목동점.",
  },
  {
    slug: "yangcheon-mokdong-strongboxing",
    title: "양천·목동 복싱장 | 운동 습관 만드는 스트롱복싱 목동점",
    description: "양천·목동에서 운동 습관을 만들고 싶다면 스트롱복싱 목동점. 입문자 환영, 관장 직접 지도.",
  },
  // ── 개봉점 ──────────────────────────────────────────────────────────────
  {
    slug: "gaebong-strongboxing-active-workout-time",
    title: "개봉동 복싱 수업 분위기 | 스트롱복싱 개봉점 일상",
    description: "개봉동·고척 복싱장 실제 수업 풍경. 초보자·직장인·여성 회원 모두 편안하게 운동하는 스트롱복싱 개봉점.",
  },
  {
    slug: "gaebong-dong-boxing-strongboxing",
    title: "개봉동 복싱장 | 구로구 개봉·고척 스트롱복싱 개봉점",
    description: "개봉동·고척동 근처 복싱장. 관장 직접 지도, 초보자·다이어트·직장인 맞춤 수업 운영하는 스트롱복싱 개봉점.",
  },
  // ── 신정점 ──────────────────────────────────────────────────────────────
  {
    slug: "yangcheon-shinjeong-strongboxing-center",
    title: "신정동 복싱장 | 양천구 복싱 스트롱복싱 신정점",
    description: "양천구 신정동 복싱장. 초보자·직장인 환영, 관장 직접 지도로 체력 관리부터 다이어트 복싱까지.",
  },
  {
    slug: "quick-change-with-strongboxing-shinjeong-kids-boxing",
    title: "신정동 키즈복싱 | 집중력·순발력 키우는 스트롱복싱 신정점",
    description: "양천구 신정동 어린이 복싱 수업. 집중력·순발력을 게임처럼 키웁니다. 스파링 없이 안전하게 배우는 스트롱복싱 신정점 키즈반.",
  },
  {
    slug: "strongboxing-shinjeong-kids-training",
    title: "신정점 어린이 체력훈련 | 즐겁게 뛰는 키즈복싱 수업",
    description: "아이 체력 걱정된다면? 스트롱복싱 신정점 키즈 체력훈련. 달리기·줄넘기·미트치기로 즐겁게 체력을 키웁니다.",
  },
  // ── 영등포점 ────────────────────────────────────────────────────────────
  {
    slug: "youngdeungpo-strongboxing-center",
    title: "영등포 복싱장 | 도림동 초보자·직장인 스트롱복싱 영등포점",
    description: "영등포·도림동 복싱장. 관장 직접 지도, 초보자부터 다이어트·체력 관리까지 맞춤 수업 운영하는 스트롱복싱 영등포점.",
  },
];

export async function POST() {
  const results: { slug: string; status: "updated" | "not_found" }[] = [];

  for (const row of UPDATES) {
    const [res]: any = await pool.query(
      `UPDATE homepage_posts SET title = ?, description = ? WHERE slug = ?`,
      [row.title, row.description, row.slug]
    );
    results.push({ slug: row.slug, status: res.affectedRows > 0 ? "updated" : "not_found" });
  }

  const updated = results.filter(r => r.status === "updated").length;
  const skipped = results.filter(r => r.status === "not_found").length;

  return Response.json({ success: true, updated, skipped, results });
}
