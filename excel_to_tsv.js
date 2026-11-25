const XLSX = require('xlsx');
const fs = require('fs');

const files = [
  { path: 'C:\\Users\\admin\\Downloads\\철산 회원 리스트.xlsx', branch: '철산점' },
  { path: 'C:\\Users\\admin\\Downloads\\개봉 회원 리스트.xlsx', branch: '개봉점' },
  { path: 'C:\\Users\\admin\\Downloads\\신정 회원 리스트.xlsx', branch: '신정점' },
  { path: 'C:\\Users\\admin\\Downloads\\목동 회원 리스트.xlsx', branch: '목동점' },
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

function safe(v) {
  return String(v == null ? '' : v).replace(/[\t\n\r]/g, ' ').trim();
}

const headerRow = 'branch_name\tmember_no\tname\tphone\tbirth_date\tgender\tproduct_name\tstart_date\tend_date\tremaining_count\tstatus\tlocker\twear\tstaff_name\tmemo\tjoin_date\tpass_type\tsms\tcheckin_code_no';
const rows = [];

for (const f of files) {
  const wb = XLSX.readFile(f.path, { cellDates: false, raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  if (f.branch === '철산점') {
    console.error('헤더 확인:', data[0].map((h,i) => `[${i}]${h}`).join(' '));
  }

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[1] && !r[17]) continue;
    rows.push([
      f.branch,
      safe(r[17]),           // col18: 회원번호
      safe(r[1]),            // col2: 회원명
      normalizePhone(r[6]),  // col7: 전화번호
      parseDate(r[3]),       // col4: 생년월일
      safe(r[4]),            // col5: 성별
      safe(r[7]),            // col8: 프로그램
      parseDate(r[8]),       // col9: 시작일
      parseDate(r[9]),       // col10: 종료일
      safe(r[13]),           // col14: 잔여횟수
      safe(r[11]),           // col12: 상태
      safe(r[15]),           // col16: 락카
      safe(r[14]),           // col15: 옷
      safe(r[19]),           // col20: 담당자
      safe(r[20]),           // col21: 메모
      parseDate(r[23]),      // col24: 가입일
      safe(r[24]),           // col25: 구분
      safe(r[25]),           // col26: 문자수신
      safe(r[16]),           // col17: NO(2nd)
    ].join('\t'));
  }
}

const tsv = headerRow + '\n' + rows.join('\n');
const outPath = 'C:\\Users\\admin\\AppData\\Local\\Temp\\ezis_members.tsv';
fs.writeFileSync(outPath, tsv, 'utf8');
console.log(`저장: ${outPath}`);
console.log(`행 수: ${rows.length}`);

const b64 = Buffer.from(tsv, 'utf8').toString('base64');
const b64Path = 'C:\\Users\\admin\\AppData\\Local\\Temp\\ezis_members_b64.txt';
fs.writeFileSync(b64Path, b64, 'ascii');
console.log(`base64: ${b64Path} (${Math.round(b64.length/1024)}KB)`);
