CREATE TABLE IF NOT EXISTS chapter_story_seen (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 chapter_id TEXT NOT NULL,
 phase TEXT NOT NULL CHECK(phase IN ('start','end')),
 seen_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,chapter_id,phase)
);
PRAGMA user_version=6;
