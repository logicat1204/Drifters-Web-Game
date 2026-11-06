CREATE TABLE IF NOT EXISTS owned_music (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 song_id TEXT NOT NULL,
 acquired_at INTEGER NOT NULL,
 PRIMARY KEY (user_id,song_id)
);
PRAGMA user_version=5;
