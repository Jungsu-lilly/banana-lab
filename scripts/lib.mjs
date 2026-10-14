// 데이터 스크립트들이 같이 쓰는 작은 도구 모음
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve('src/data');

export function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
}

export function writeJson(name, value) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(value, null, 2) + '\n');
}

// 한국 시간 기준 날짜 (GitHub Actions 서버는 UTC라서 따로 계산)
export function kstDate(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

// "1,234" 같은 문자열을 숫자로. 값이 없으면("-", "") null
export function toNumber(v) {
  if (v === undefined || v === null) return null;
  const n = Number(String(v).replace(/,/g, '').trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`환경변수 ${name}가 없어요. .env 파일이나 GitHub Secrets에 넣어주세요.`);
    process.exit(1);
  }
  return v;
}
