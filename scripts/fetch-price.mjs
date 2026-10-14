// 오늘의 바나나 소매가격을 KAMIS에서 받아 src/data/price.json에 쌓아요.
//
// 실행:  npm run data:price
//        npm run data:price -- --dry   (저장하지 않고 받아온 바나나 데이터만 출력)
//
// 필요한 환경변수: KAMIS_CERT_KEY, KAMIS_CERT_ID
// (키 없이 테스트하려면 둘 다 TEST로 넣어도 이 API는 동작해요)
import { readJson, writeJson, kstDate, toNumber } from './lib.mjs';

const DRY = process.argv.includes('--dry');
const KEEP_DAYS = 30;

const certKey = process.env.KAMIS_CERT_KEY || 'TEST';
const certId = process.env.KAMIS_CERT_ID || 'TEST';
const regday = process.env.PRICE_DATE || kstDate();

const params = new URLSearchParams({
  action: 'dailyPriceByCategoryList',
  p_product_cls_code: '01', // 01 소매, 02 도매
  p_country_code: '1101', // 서울
  p_regday: regday,
  p_convert_kg_yn: 'N',
  p_item_category_code: '400', // 과일류
  p_cert_key: certKey,
  p_cert_id: certId,
  p_returntype: 'json',
});
const url = `https://www.kamis.or.kr/service/price/xml.do?${params}`;

const res = await fetch(url);
if (!res.ok) {
  console.error(`KAMIS 응답 오류: HTTP ${res.status}`);
  process.exit(1);
}
const body = await res.json();

// 응답 모양: { data: { error_code: "000", item: [...] } }
// 데이터가 없는 날(주말·공휴일)엔 data가 배열이거나 error_code가 001이에요.
const data = Array.isArray(body.data) ? body.data[0] : body.data;
const items = Array.isArray(data?.item) ? data.item : data?.item ? [data.item] : [];
const bananas = items.filter((it) => String(it.item_name || '').includes('바나나'));

if (DRY) {
  console.log(`[${regday}] error_code=${data?.error_code ?? '-'} 과일류 ${items.length}건 중 바나나 ${bananas.length}건`);
  console.log(JSON.stringify(bananas, null, 2));
  process.exit(0);
}

if (bananas.length === 0) {
  console.log(`[${regday}] 바나나 가격이 없어요 (휴일이거나 아직 집계 전). 기존 데이터를 그대로 둘게요.`);
  process.exit(0);
}

// 여러 등급이 오면 '상품'을 우선 사용
const pick = bananas.find((b) => b.rank === '상품') || bananas[0];
const today = toNumber(pick.dpr1);
if (!today) {
  console.log(`[${regday}] 오늘 값이 비어 있어요 (dpr1=${pick.dpr1}). 기존 데이터를 그대로 둘게요.`);
  process.exit(0);
}

const current = readJson('price.json');
// 예시 데이터는 첫 실제 수집 때 버려요
let history = current.isSample ? [] : [...current.history];

// 처음 시작할 땐 '1일전' 값도 같이 넣어서 그래프가 바로 그려지게
const yesterday = toNumber(pick.dpr2);
const yDate = parseDayLabel(pick.day2, regday);
if (history.length === 0 && yesterday && yDate) {
  history.push({ date: yDate, price: yesterday });
}

history = history.filter((h) => h.date !== regday);
history.push({ date: regday, price: today });
history.sort((a, b) => a.date.localeCompare(b.date));
history = history.slice(-KEEP_DAYS);

writeJson('price.json', {
  isSample: false,
  source: 'KAMIS 농산물유통정보 (서울 소매가격)',
  item: `${pick.item_name}${pick.kind_name ? ` (${pick.kind_name})` : ''}`,
  unit: pick.unit || current.unit,
  rank: pick.rank || null,
  updatedAt: regday,
  history,
});
console.log(`[${regday}] 저장 완료: ${today}원 / ${pick.unit}, 누적 ${history.length}일`);

// "1일전 (10/12)" 같은 라벨에서 날짜를 뽑아요. 형식이 다르면 null
function parseDayLabel(label, baseDate) {
  const m = String(label || '').match(/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  let year = Number(baseDate.slice(0, 4));
  const month = Number(m[1]);
  if (month > Number(baseDate.slice(5, 7))) year -= 1; // 1월에 12월 값이 오는 경우
  return `${year}-${String(month).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}
