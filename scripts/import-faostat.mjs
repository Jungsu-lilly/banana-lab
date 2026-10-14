// FAOSTAT에서 내려받은 CSV로 src/data/production.json을 만들어요.
// 생산량은 1년에 한 번 바뀌어서 자동화하지 않고 손으로 한 번 돌려요.
//
// 1) https://www.fao.org/faostat/en/#data/QCL 접속
// 2) Countries: All, Elements: Production Quantity, Items: Bananas, Years: 최신 연도 → Download (CSV)
// 3) 파일을 data/raw/faostat.csv 로 저장
// 4) npm run data:faostat
import fs from 'node:fs';
import { writeJson } from './lib.mjs';

const file = process.argv[2] || 'data/raw/faostat.csv';
if (!fs.existsSync(file)) {
  console.error(`${file} 파일이 없어요. 위 주석대로 FAOSTAT CSV를 먼저 받아주세요.`);
  process.exit(1);
}

// FAOSTAT 영어 국가명 → 한국어 (상위권 위주, 없으면 영어 그대로)
const KO = {
  India: '인도', China: '중국', 'China, mainland': '중국', Indonesia: '인도네시아', Brazil: '브라질',
  Ecuador: '에콰도르', Philippines: '필리핀', Guatemala: '과테말라', Angola: '앙골라',
  'United Republic of Tanzania': '탄자니아', 'Costa Rica': '코스타리카', Mexico: '멕시코',
  Colombia: '콜롬비아', 'Viet Nam': '베트남', Peru: '페루', Cameroon: '카메룬', Nigeria: '나이지리아',
};
// 지역 합계 행은 빼요
const SKIP = /World|Africa|Americas|Asia|Europe|Oceania|countries|Union|Caribbean|Least|Low|Small|Net|Land|China, Hong|Taiwan/;

const rows = parseCsv(fs.readFileSync(file, 'utf8'));
const header = rows.shift();
const col = (name) => header.findIndex((h) => h.trim() === name);
const iArea = col('Area');
const iItem = col('Item');
const iElem = col('Element');
const iYear = col('Year');
const iUnit = col('Unit');
const iVal = col('Value');
if ([iArea, iItem, iElem, iYear, iVal].includes(-1)) {
  console.error('CSV 열 이름이 예상과 달라요. 첫 줄:', header.join(' | '));
  process.exit(1);
}

const recs = rows
  .filter((r) => r[iItem]?.startsWith('Banana') && r[iElem] === 'Production' && !SKIP.test(r[iArea]))
  .map((r) => ({ area: r[iArea], year: Number(r[iYear]), unit: r[iUnit], value: Number(r[iVal]) }))
  .filter((r) => r.value > 0);

if (recs.length === 0) {
  console.error('바나나 생산량 행을 못 찾았어요. Items에 Bananas, Elements에 Production을 골랐는지 확인해주세요.');
  process.exit(1);
}

const year = Math.max(...recs.map((r) => r.year));
const top = recs
  .filter((r) => r.year === year && r.area !== 'China') // 'China'는 대만 포함 합계라 'China, mainland'만 사용
  .sort((a, b) => b.value - a.value)
  .slice(0, 7);

writeJson('production.json', {
  isSample: false,
  source: `FAO FAOSTAT (${year})`,
  unit: '만 톤',
  year,
  countries: top.map((r) => ({ name: KO[r.area] || r.area, amount: Math.round(r.value / 10000) })),
});
console.log(`저장 완료 (${year}년):`, top.map((r) => `${r.area} ${Math.round(r.value / 10000)}만t`).join(', '));

// 따옴표 안 쉼표를 처리하는 작은 CSV 파서
function parseCsv(text) {
  const out = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.length > 1);
}
