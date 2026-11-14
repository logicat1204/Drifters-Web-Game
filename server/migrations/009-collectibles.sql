CREATE TABLE IF NOT EXISTS owned_cards(
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK(quantity > 0),
  PRIMARY KEY(user_id,card_id)
);
CREATE TABLE IF NOT EXISTS card_chests(
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receipt TEXT NOT NULL,
  cards TEXT NOT NULL,
  PRIMARY KEY(user_id,receipt)
);
CREATE TABLE IF NOT EXISTS favorite_cards(
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL
);
PRAGMA user_version=9;
