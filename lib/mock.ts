export const branches = ['개봉점', '신정점', '목동점', '철산점'];

export const members = [
  { name: '김민지', phone: '010-1234-1111', branch: '철산점', product: '3개월권', remain: 24, endDate: '2026-07-12', status: '정상' },
  { name: '박서준', phone: '010-2222-3333', branch: '목동점', product: '주3회권', remain: 2, endDate: '2026-05-20', status: '정상' },
  { name: '이하나', phone: '010-9999-8888', branch: '개봉점', product: '1개월권', remain: 0, endDate: '2026-05-01', status: '만료' },
];

export const checkins = [
  { time: '14:03', name: '김민지', branch: '철산점', result: '출석 완료' },
  { time: '14:11', name: '박서준', branch: '목동점', result: '출석 완료' },
  { time: '14:23', name: '이하나', branch: '개봉점', result: '횟수 없음' },
];

export const payments = [
  { date: '2026-05-13', branch: '철산점', member: '김민지', type: '카드', amount: 472000, memo: '3개월권' },
  { date: '2026-05-13', branch: '목동점', member: '박서준', type: '계좌이체', amount: 160000, memo: '주3회권' },
];

export const crm = [
  { name: '최유리', phone: '010-5555-4444', branch: '철산점', status: '상담중', memo: '오픈 이벤트 문의 / 이번주 방문 예정' },
  { name: '강도윤', phone: '010-7777-1111', branch: '신정점', status: '재등록 예정', memo: '만료 3일 전 연락 필요' },
];
