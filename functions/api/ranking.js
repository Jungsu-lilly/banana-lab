// GET /api/ranking?id=...
// 오늘 TOP 10, 어제 TOP 3(명예의 전당), 그리고 내 이름·오늘 순위·어제 순위를 돌려줘요.
import { json, getUser, kstDay, topOf, rankOf } from '../../server/lib.js';

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('id');
  const today = kstDay();
  const yesterday = kstDay(-1);

  const [top, hall] = await Promise.all([topOf(env.DB, today, 10), topOf(env.DB, yesterday, 3)]);

  let me = null;
  const user = await getUser(env.DB, id);
  if (user) {
    const [t, y] = await Promise.all([rankOf(env.DB, today, user.id), rankOf(env.DB, yesterday, user.id)]);
    me = { name: user.name, count: t.count, rank: t.rank, yesterdayRank: y.rank, yesterdayCount: y.count };
  }

  return json({ day: today, top, hall, me });
}
