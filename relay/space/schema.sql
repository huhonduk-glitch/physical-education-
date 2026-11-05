-- PE LOG 학교 공유 공간 (D1). 학생 정보 칸 없음
CREATE TABLE IF NOT EXISTS spaces (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  space TEXT NOT NULL,
  col TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated INTEGER NOT NULL,
  by TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (space, col, id)
);
CREATE INDEX IF NOT EXISTS items_space_col ON items (space, col, updated);
