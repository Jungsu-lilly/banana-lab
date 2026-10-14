// Pages Functions(서버 코드)가 같이 쓰는 도구 모음

export const LIMITS = {
  perRequest: 30, // 한 번 요청에 최대 30개 (클라이언트가 1초마다 모아서 보냄)
  perDay: 3000, // 하루 최대 3000개 (매크로 방지)
  minIntervalMs: 700, // 같은 사람의 요청 사이 최소 간격
};

const ADJECTIVES = [
  '꿈꾸는', '졸린', '배고픈', '출근하는', '야근하는', '행복한', '수상한', '용감한', '느긋한', '반짝이는',
  '우아한', '덜 익은', '잘 익은', '퇴근하고픈', '심심한', '커피 마신', '말랑한', '진지한', '춤추는', '월요일의',
  '눈치 빠른', '점심 기다리는', '회의 중인', '노래하는', '숨은 고수',
];
const ANIMALS = [
  '하마', '캥거루', '펭귄', '수달', '쿼카', '판다', '고양이', '강아지', '다람쥐', '오리',
  '코알라', '미어캣', '알파카', '너구리', '햄스터', '고래', '문어', '거북이', '두더지', '카피바라',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const randomName = () => `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;

// 한국 시간 기준 날짜 (Cloudflare 서버는 UTC)
export function kstDay(offsetDays = 0) {
  return new Date(Date.now() + 9 * 3600 * 1000 + offsetDays * 86400 * 1000).toISOString().slice(0, 10);
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

const ID_RE = /^[0-9a-f-]{36}$/;
export const isValidId = (id) => typeof id === 'string' && ID_RE.test(id);

export async function getUser(db, id) {
  if (!isValidId(id)) return null;
  return db.prepare('SELECT id, name, last_feed_at FROM users WHERE id = ?').bind(id).first();
}

export async function topOf(db, day, limit) {
  const { results } = await db
    .prepare(
      `SELECT u.name AS name, f.count AS count
       FROM daily_feeds f JOIN users u ON u.id = f.user_id
       WHERE f.day = ? AND f.count > 0
       ORDER BY f.count DESC, f.updated_at ASC
       LIMIT ?`,
    )
    .bind(day, limit)
    .all();
  return results.map((r, i) => ({ rank: i + 1, name: r.name, count: r.count }));
}

// 내 순위: 나보다 많거나, 같은데 먼저 도달한 사람 수 + 1
export async function rankOf(db, day, userId) {
  const mine = await db
    .prepare('SELECT count, updated_at FROM daily_feeds WHERE day = ? AND user_id = ?')
    .bind(day, userId)
    .first();
  if (!mine || mine.count <= 0) return { count: 0, rank: null };
  const ahead = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM daily_feeds
       WHERE day = ? AND (count > ? OR (count = ? AND updated_at < ?))`,
    )
    .bind(day, mine.count, mine.count, mine.updated_at)
    .first();
  return { count: mine.count, rank: ahead.n + 1 };
}
