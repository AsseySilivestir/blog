-- ═══════════════════════════════════════════════════════════════
--  Bantu Blog — SQLite Schema
--  The Bantu backend (server.b) creates these tables automatically
--  on first run, so you usually don't need to run this manually.
--
--  Manual use (if you want to inspect / reset the DB):
--    sqlite3 blog.db < schema.sql
-- ═══════════════════════════════════════════════════════════════

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    author      TEXT NOT NULL DEFAULT 'Anonymous',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Comments table (each post can have many comments)
CREATE TABLE IF NOT EXISTS comments (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     INTEGER NOT NULL,
    author      TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);

-- Likes table (one like per author per post)
CREATE TABLE IF NOT EXISTS likes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     INTEGER NOT NULL,
    author      TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(post_id, author),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);

-- Shares table (records each share action)
CREATE TABLE IF NOT EXISTS shares (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id     INTEGER NOT NULL,
    platform    TEXT NOT NULL DEFAULT 'copy',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_shares_post_id ON shares(post_id);

-- Enable foreign keys (off by default in SQLite)
PRAGMA foreign_keys = ON;
