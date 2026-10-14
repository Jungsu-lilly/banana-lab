// POST /api/feed  { id, count }
// 모아둔 바나나 클릭 수를 기록해요. 매크로를 막기 위해 요청당·하루 한도와 요청 간격 제한이 있어요.
import { json, getUser, kstDay, rankOf, LIMITS } from '../../server/lib.js';

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: '요청 형식이 잘못됐어요.' }, 400);
  }

  const user = await getUser(env.DB, body.id);
  if (!user) return json({ error: '등록되지 않은 사용자예요. 새로고침해 주세요.' }, 401);

  const now = Date.now();
  if (now - user.last_feed_at < LIMITS.minIntervalMs) {
    return json({ error: '너무 빨라요. 캥거루 대리가 체할 것 같아요.' }, 429);
  }

  const count = Math.min(Math.max(Math.floor(Number(body.count) || 0), 0), LIMITS.perRequest);
  if (count === 0) return json({ error: '바나나 개수가 없어요.' }, 400);

  const day = kstDay();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO daily_feeds (day, user_id, count, updated_at) VALUES (?, ?, MIN(?, ?), ?)
       ON CONFLICT (day, user_id) DO UPDATE
       SET count = MIN(count + excluded.count, ?), updated_at = excluded.updated_at`,
    ).bind(day, user.id, count, LIMITS.perDay, now, LIMITS.perDay),
    env.DB.prepare('UPDATE users SET last_feed_at = ? WHERE id = ?').bind(now, user.id),
  ]);

  // 가끔 오래된 기록 정리 (8일 지난 것)
  if (Math.random() < 0.01) {
    await env.DB.prepare('DELETE FROM daily_feeds WHERE day < ?').bind(kstDay(-8)).run();
  }

  const me = await rankOf(env.DB, day, user.id);
  return json({ day, ...me, cap: LIMITS.perDay });
}
