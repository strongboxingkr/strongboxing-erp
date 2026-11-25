const XLSX = require('xlsx');
const fs = require('fs');

const files = [
  { path: 'C:/Users/admin/Downloads/철산 라카 리스트.xlsx', branch: '철산점' },
  { path: 'C:/Users/admin/Downloads/개봉 라카 리스트.xlsx', branch: '개봉점' },
  { path: 'C:/Users/admin/Downloads/신정 라카 리스트.xlsx', branch: '신정점' },
  { path: 'C:/Users/admin/Downloads/목동 라카 리스트.xlsx', branch: '목동점' },
];

function normalizePhone(v) {
  if (v == null) return '';
  return String(v).replace(/-/g, '').trim();
}

function parseDate(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return '';
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  return String(v).trim();
}

for (const f of files) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${f.branch}] ${f.path}`);
  console.log('='.repeat(60));

  const wb = XLSX.readFile(f.path, { cellDates: false, raw: true });
  console.log('시트:', wb.SheetNames);

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

    console.log(`\n  [시트: ${sheetName}] 총 ${data.length}행`);
    if (data.length > 0) {
      console.log('  헤더:', data[0].map((h, i) => `[${i}]${h}`).join(' | '));
    }

    // 데이터 행 분석 (최초 5개)
    let dataRows = 0;
    let samples = [];
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      const hasData = r.some(c => c !== '' && c !== null && c !== undefined);
      if (!hasData) continue;
      dataRows++;
      if (samples.length < 5) samples.push(r);
    }

    console.log(`  데이터 행: ${dataRows}`);
    samples.forEach((r, i) => {
      console.log(`  샘플${i+1}:`, r.map((c, j) => `[${j}]${c}`).join(' | '));
    });
  }
}
