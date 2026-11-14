CREATE TABLE IF NOT EXISTS verified_online_matches(
  id TEXT PRIMARY KEY,
  season INTEGER,
  finished_at INTEGER NOT NULL,
  results TEXT NOT NULL,
  evidence BLOB NOT NULL
);
CREATE INDEX IF NOT EXISTS online_matches_season ON verified_online_matches(season);
CREATE TABLE IF NOT EXISTS ranked_wallets(
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  golden_keys INTEGER NOT NULL DEFAULT 0 CHECK(golden_keys >= 0)
);
CREATE TABLE IF NOT EXISTS ranked_claims(
  season INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(season,user_id)
);
PRAGMA user_version=10;
