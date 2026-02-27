"""
Migration: add playlists, playlist_songs, playlist_favorites tables.
Run once from the repo root: python -m api.migrate_playlists
DELETE this file after running.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '../database/vocarank.db')

def migrate():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS playlists (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL REFERENCES users(id),
            title       TEXT NOT NULL,
            description TEXT,
            cover_url   TEXT,
            is_public   INTEGER DEFAULT 1,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS playlist_songs (
            playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
            song_id     INTEGER NOT NULL REFERENCES songs(id),
            position    INTEGER NOT NULL DEFAULT 0,
            added_at    TEXT DEFAULT (datetime('now')),
            PRIMARY KEY (playlist_id, song_id)
        );

        CREATE TABLE IF NOT EXISTS playlist_favorites (
            playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
            user_id     INTEGER NOT NULL REFERENCES users(id),
            PRIMARY KEY (playlist_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_playlists_user     ON playlists(user_id);
        CREATE INDEX IF NOT EXISTS idx_playlist_songs_pl  ON playlist_songs(playlist_id);
        CREATE INDEX IF NOT EXISTS idx_playlist_favs_pl   ON playlist_favorites(playlist_id);
        CREATE INDEX IF NOT EXISTS idx_playlist_favs_user ON playlist_favorites(user_id);
    """)
    conn.commit()
    conn.close()
    print("Migration complete: playlists, playlist_songs, playlist_favorites created.")

if __name__ == "__main__":
    migrate()
