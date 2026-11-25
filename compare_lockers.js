const XLSX = require('xlsx');
const fs = require('fs');

// ── 이지스포 라커 Excel 로드 ───────────────────────────────
const excelFiles = [
  { path: 'C:/Users/admin/Downloads/철산 라카 리스트.xlsx', branch: '철산점' },
  { path: 'C:/Users/admin/Downloads/개봉 라카 리스트.xlsx', branch: '개봉점' },
  { path: 'C:/Users/admin/Downloads/신정 라카 리스트.xlsx', branch: '신정점' },
  { path: 'C:/Users/admin/Downloads/목동 라카 리스트.xlsx', branch: '목동점' },
];

function normalizePhone(v) {
  return String(v || '').replace(/-/g, '').trim();
}
function parseDate(v) {
  if (!v) return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s = String(v).trim();
  return s || null;
}
function safe(v) { return String(v == null ? '' : v).trim(); }

const ezisLockers = [];

for (const f of excelFiles) {
  const wb = XLSX.readFile(f.path, { cellDates: false, raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    const no = parseInt(r[1], 10);
    if (isNaN(no)) continue;
    ezisLockers.push({
      branch: f.branch,
      part: safe(r[0]),
      locker_no: no,
      name: safe(r[2]),
      start_date: parseDate(r[3]),
      end_date: parseDate(r[4]),
      phone: normalizePhone(r[5]),
      ticket_memo: safe(r[6]),
      locker_memo: safe(r[7]),
    });
  }
}

const ezisAssigned = ezisLockers.filter(l => l.name !== '');

console.log('\n===== 이지스포 라커 현황 =====');
const byBranch = {};
for (const l of ezisLockers) {
  if (!byBranch[l.branch]) byBranch[l.branch] = { total: 0, assigned: 0 };
  byBranch[l.branch].total++;
  if (l.name) byBranch[l.branch].assigned++;
}
for (const [b, s] of Object.entries(byBranch)) {
  console.log(`  ${b}: 슬롯 ${s.total}개, 배정 ${s.assigned}건`);
}

console.log('\n===== 이지스포 배정 목록 =====');
for (const l of ezisAssigned) {
  console.log(`  [${l.branch}] #${l.locker_no} ${l.name} ${l.start_date || '?'}~${l.end_date || '?'} tel:${l.phone}`);
}

// ── ERP 데이터 로드 (별도 추출 필요) ──
const erpFile = 'C:/Users/admin/AppData/Local/Temp/erp_lockers_full.tsv';
if (!fs.existsSync(erpFile)) {
  console.log('\n[ERP 파일 없음] 서버에서 아래 명령 실행 후 erp_lockers.tsv를 로컬에 저장 필요');
  process.exit(0);
}

const lines = fs.readFileSync(erpFile, 'utf8').split('\n').filter(Boolean);
const headers = lines[0].split('\t').map(h => h.trim());
const erpLockers = lines.slice(1).map(line => {
  const cols = line.split('\t');
  const obj = {};
  headers.forEach((h, i) => obj[h] = (cols[i] || '').trim());
  return obj;
});

console.log('\n===== ERP vs 이지스포 라커 비교 =====');

const erpByKey = {};
for (const e of erpLockers) {
  const key = `${e.branch_name}|${e.locker_no}`;
  if (!erpByKey[key]) erpByKey[key] = e;
}

const match = [], conflict = [], ezis_only = [], erp_only = [], date_diff = [];

for (const ez of ezisAssigned) {
  const key = `${ez.branch}|${ez.locker_no}`;
  const erp = erpByKey[key];
  if (!erp) {
    ezis_only.push({ ...ez, note: 'ERP 슬롯 없음 (번호 범위 초과 또는 미생성)' });
  } else if (!erp.member_name) {
    ezis_only.push({ ...ez, note: 'ERP 슬롯 있음 / 미배정' });
  } else if (erp.member_name === ez.name) {
    if (erp.end_date !== ez.end_date) {
      date_diff.push({ ...ez, erp_end: erp.end_date });
    } else {
      match.push(ez);
    }
  } else {
    conflict.push({ ...ez, erp_name: erp.member_name, erp_end: erp.end_date });
  }
}

for (const e of erpLockers.filter(e => e.member_name)) {
  const key = `${e.branch_name}|${e.locker_no}`;
  const found = ezisAssigned.find(ez => `${ez.branch}|${ez.locker_no}` === key);
  if (!found) erp_only.push(e);
}

console.log(`\n  완전 일치: ${match.length}건`);
console.log(`  기간 차이: ${date_diff.length}건`);
console.log(`  이름 충돌: ${conflict.length}건`);
console.log(`  이지스포에만: ${ezis_only.length}건`);
console.log(`  ERP에만 (이지스포 빈칸): ${erp_only.length}건`);

if (conflict.length) {
  console.log('\n[이름 충돌 — 자동 변경 불가]');
  conflict.forEach(r => console.log(`  ${r.branch} #${r.locker_no}: 이지스포=${r.name} / ERP=${r.erp_name}`));
}
if (date_diff.length) {
  console.log('\n[기간 차이]');
  date_diff.forEach(r => console.log(`  ${r.branch} #${r.locker_no} ${r.name}: 이지스포=${r.end_date} / ERP=${r.erp_end}`));
}
if (ezis_only.length) {
  console.log('\n[이지스포에만 — 신규 이관 후보]');
  ezis_only.forEach(r => console.log(`  ${r.branch} #${r.locker_no} ${r.name} ~${r.end_date} (${r.note})`));
}
if (erp_only.length) {
  console.log('\n[ERP에만 — 이지스포 Excel에 없음, 건드리지 말 것]');
  erp_only.forEach(r => console.log(`  ${r.branch_name} #${r.locker_no}: ${r.member_name} ~${r.end_date}`));
}
