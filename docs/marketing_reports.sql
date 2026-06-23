-- 마케팅 성과 분석 테이블
-- 실행: MySQL에서 아래 쿼리를 실행하세요

CREATE TABLE IF NOT EXISTS marketing_reports (
  report_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
  branch_name   VARCHAR(100) NOT NULL,
  report_date   DATE NOT NULL,
  lead_source   VARCHAR(50)  NOT NULL,
  ad_cost       INT DEFAULT 0,
  impressions   INT DEFAULT 0,
  clicks        INT DEFAULT 0,
  inquiries     INT DEFAULT 0,
  reservations  INT DEFAULT 0,
  registrations INT DEFAULT 0,
  revenue       INT DEFAULT 0,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_report (branch_name, report_date, lead_source)
);

-- lead_source 값 목록
-- NAVER_AD          : 네이버 검색광고
-- NAVER_PLACE       : 네이버 플레이스
-- NAVER_RESERVATION : 네이버 예약
-- WEBSITE           : 홈페이지
-- INSTAGRAM_AD      : 인스타그램 광고
-- FACEBOOK_AD       : 페이스북 광고
-- DANGGEUN          : 당근 광고
-- KAKAOMAP          : 카카오맵
-- REFERRAL          : 지인소개
-- WALK_IN           : 지나가다 방문
-- OTHER             : 기타
