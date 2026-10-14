// POST /api/register
// 처음 온 사람에게 랜덤 ID와 이름을 발급해요. ID는 브라우저에만 저장되는 일종의 비밀번호예요.
import { json, randomName } from '../../server/lib.js';

export async function onRequestPost({ env }) {
  const id = crypto.randomUUID();
  let name = randomName();

  // 이미 있는 이름이면 몇 번 다시 뽑고, 그래도 겹치면 번호를 붙여요
  for (let i = 0; i < 5; i++) {
    const taken = await env.DB.prepare('SELECT 1 FROM users WHERE name = ?').bind(name).first();
    if (!taken) break;
    name = i < 4 ? randomName() : `${name} ${Math.floor(10 + Math.random() * 90)}호`;
  }

  await env.DB.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)')
    .bind(id, name, Date.now())
    .run();

  return json({ id, name }, 201);
}
