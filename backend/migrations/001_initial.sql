-- Run once against a new PostgreSQL database before starting APP_ENV=prod.
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(30) NOT NULL UNIQUE,
  phone VARCHAR(20) UNIQUE,
  data TEXT NOT NULL,
  password_hash TEXT
);
CREATE INDEX IF NOT EXISTS ix_users_username ON users (username);

CREATE TABLE IF NOT EXISTS habits (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_habits_user_id ON habits (user_id);

CREATE TABLE IF NOT EXISTS checkins (
  id VARCHAR(160) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  catalog_id VARCHAR(64) NOT NULL,
  day DATE NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_checkins_user_id ON checkins (user_id);

CREATE TABLE IF NOT EXISTS points_ledger (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_points_ledger_user_id ON points_ledger (user_id);

CREATE TABLE IF NOT EXISTS user_state (
  user_id VARCHAR(64) PRIMARY KEY,
  data TEXT NOT NULL
);
