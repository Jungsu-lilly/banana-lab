-- 익명 사용자: 브라우저마다 하나. 이름은 서버가 랜덤으로 지어줘요.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_feed_at INTEGER NOT NULL DEFAULT 0
);

-- 날짜(한국 시간)별 바나나 개수
CREATE TABLE IF NOT EXISTS daily_feeds (
  day TEXT NOT NULL,
  user_id TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (day, user_id)
);

-- 랭킹 조회용: 같은 개수면 먼저 도달한 사람이 위
CREATE INDEX IF NOT EXISTS idx_daily_rank ON daily_feeds (day, count DESC, updated_at);
