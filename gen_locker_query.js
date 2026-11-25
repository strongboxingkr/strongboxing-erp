const XLSX = require('xlsx');
const fs = require('fs');

const files = [
  { path: 'C:/Users/admin/Downloads/철산 라카 리스트.xlsx', branch: '철산점' },
  { path: 'C:/Users/admin/Downloads/개봉 라카 리스트.xlsx', branch: '개봉점' },
  { path: 'C:/Users/admin/Downloads/신정 라카 리스트.xlsx', branch: '신정점' },
  { path: 'C:/Users/admin/Downloads/목동 라카 리스트.xlsx', branch: '목동점' },
];

function normalizePhone(v) {
  return String(v || '').replace(/-/g, '').trim();
}

const pairs = new Set();
for (const f of files) {
  const wb = XLSX.readFile(f.path, { cellDates: false, raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const name = String(r[2] || '').trim();
    const phone = normalizePhone(r[5]);
    if (name && phone) {
      pairs.add(`('${name.replace(/'/g, "\\'")}','${phone}')`);
    }
  }
}

const inClause = [...pairs].join(',\n  ');
const sql = `SELECT member_id, branch_name, name, phone, DATE_FORMAT(start_date,'%Y-%m-%d') as start_date, DATE_FORMAT(end_date,'%Y-%m-%d') as end_date, status
FROM members
WHERE branch_name IN ('철산점','개봉점','신정점','목동점')
AND (name, phone) IN (
  ${inClause}
)
ORDER BY branch_name, name;`;

const outPath = 'C:/Users/admin/AppData/Local/Temp/locker_member_query.sql';
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`SQL 저장: ${outPath}`);
console.log(`조건 수: ${pairs.size}개`);
console.log('\n--- 실행할 명령어 ---');
console.log(`mysql -u root -p강bD strongboxing < /tmp/locker_member_query.sql > ~/locker_members.tsv`);
