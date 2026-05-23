import AppShell from '@/components/AppShell';

export default function StaffPage() {
  return (
    <AppShell title="직원 / 스케줄">
      <div className="grid">
        <div className="card"><h3>오늘 근무</h3><div className="num">8명</div></div>
        <div className="card"><h3>휴무</h3><div className="num">2명</div></div>
        <div className="card"><h3>대타</h3><div className="num">1명</div></div>
        <div className="card"><h3>추가근무</h3><div className="num">3건</div></div>
      </div>
      <div style={{ marginTop: 16 }} className="table-wrap">
        <table>
          <thead><tr><th>직원</th><th>지점</th><th>근무시간</th><th>상태</th><th>관리자 메모</th></tr></thead>
          <tbody>
            <tr><td>홍코치</td><td>철산점</td><td>14:00~23:00</td><td>정상</td><td>관리자만 표시</td></tr>
            <tr><td>박코치</td><td>목동점</td><td>18:00~23:00</td><td>대타</td><td>관리자만 표시</td></tr>
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
