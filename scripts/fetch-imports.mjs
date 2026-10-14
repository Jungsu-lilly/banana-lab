// 한국의 바나나 수입 원산지 비중을 관세청 API에서 받아 src/data/imports.json에 저장해요.
// 최근 12개월(지난달까지) 수입 중량 기준이에요.
//
// 실행:  npm run data:imports
//        npm run data:imports -- --dry   (저장하지 않고 국가별 합계만 출력)
//
// 필요한 환경변수: DATA_GO_KR_KEY (공공데이터포털 '일반 인증키(Decoding)')
// 공공데이터포털에서 "관세청_품목별 국가별 수출입실적(GW)" 활용신청이 먼저 필요해요.
import { writeJson, requireEnv, kstDate } from './lib.mjs';

const DRY = process.argv.includes('--dry');
const key = requireEnv('DATA_GO_KR_KEY');
const HS = '0803'; // 바나나(플랜틴 포함) HS 코드

// 바나나 수입이 있을 만한 나라들. 이 API는 국가코드가 필수라 하나씩 조회해요.
const COUNTRIES = {
  PH: '필리핀', EC: '에콰도르', VN: '베트남', GT: '과테말라', MX: '멕시코',
  PE: '페루', CO: '콜롬비아', CR: '코스타리카', KH: '캄보디아', LA: '라오스',
  TH: '태국', CN: '중국', TW: '대만', ID: '인도네시아',
};

// 지난달까지 12개월
const [y, m] = kstDate().split('-').map(Number);
const end = new Date(Date.UTC(y, m - 2, 1));
const start = new Date(Date.UTC(y, m - 13, 1));
const ym = (d) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
const strtYymm = ym(start);
const endYymm = ym(end);

const totals = {};
for (const [code, name] of Object.entries(COUNTRIES)) {
  const params = new URLSearchParams({ serviceKey: key, strtYymm, endYymm, hsSgn: HS, cntyCd: code });
  const res = await fetch(`https://apis.data.go.kr/1220000/nitemtrade/getNitemtradeList?${params}`);
  const xml = await res.text();
  const resultCode = tag(xml, 'resultCode');
  if (resultCode && resultCode !== '00') {
    console.error(`${name}: 오류 ${resultCode} ${tag(xml, 'resultMsg')}`);
    continue;
  }
  // 월별 행이 오고 마지막에 '총계' 행이 붙을 수 있어서, 바나나 HS코드 + 월 형식 행만 더해요.
  let kg = 0;
  for (const block of xml.match(/<item>[\s\S]*?<\/item>/g) || []) {
    const hs = tag(block, 'hsCd');
    const period = tag(block, 'year');
    if (!hs.startsWith(HS) || !/^\d{4}\.\d{2}$/.test(period)) continue;
    kg += Number(tag(block, 'impWgt')) || 0;
  }
  if (kg > 0) totals[name] = kg;
}

const sum = Object.values(totals).reduce((a, b) => a + b, 0);
if (DRY || sum === 0) {
  console.log(`${strtYymm}~${endYymm} 국가별 수입 중량(kg):`, totals);
  if (sum === 0) console.log('합계가 0이라 저장하지 않았어요. 활용신청 승인 여부와 키를 확인해주세요.');
  process.exit(0);
}

// 상위 4개국 + 나머지는 '기타'
const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
const top = sorted.slice(0, 4);
const restKg = sorted.slice(4).reduce((a, [, v]) => a + v, 0);
const origins = top.map(([name, kg]) => ({ name, share: round1((kg / sum) * 100), tons: Math.round(kg / 1000) }));
if (restKg > 0) origins.push({ name: '기타', share: round1((restKg / sum) * 100), tons: Math.round(restKg / 1000) });

writeJson('imports.json', {
  isSample: false,
  source: `관세청 수출입무역통계 (HS ${HS}, ${strtYymm.slice(0, 4)}.${strtYymm.slice(4)}~${endYymm.slice(0, 4)}.${endYymm.slice(4)}, 수입 중량 기준)`,
  unit: '%',
  totalTons: Math.round(sum / 1000),
  origins,
});
console.log('저장 완료:', origins);

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : '';
}
function round1(n) {
  return Math.round(n * 10) / 10;
}
