import sqlite3
import argparse
import concurrent.futures
import json
from .core import (
    get_db_connection, get_max_id, fetch_song, 
    transform_song_api, ensure_artists_exist_with_conn, log_message
)

def update_song_by_id(conn: sqlite3.Connection, song_id: int):
    """Fetches and updates a specific song by ID, preserving existing view counts."""
    cursor = conn.cursor()
    
    cursor.execute("SELECT niconico_views, youtube_views, niconico_history, youtube_history FROM songs WHERE id=?", (song_id,))
    existing = cursor.fetchone()
    
    nico_views = 0
    yt_views = 0
    nico_hist = '[]'
    yt_hist = '[]'
    
    if existing:
        nico_views = existing[0] if existing[0] else 0
        yt_views = existing[1] if existing[1] else 0
        nico_hist = existing[2] if existing[2] else '[]'
        yt_hist = existing[3] if existing[3] else '[]'
        
    data = fetch_song(song_id)
    if not data:
        log_message("WARNING", f"[songs] Failed to fetch data for ID {song_id}")
        return

    try:
        base_record = transform_song_api(data)
        
        artist_ids = json.loads(base_record[6])
        ensure_artists_exist_with_conn(conn, artist_ids)
        
        record = list(base_record)
        record[11] = nico_views
        record[12] = yt_views
        record[13] = nico_hist
        record[14] = yt_hist
        
        song_sql = '''
            INSERT OR REPLACE INTO songs (
                id, name_english, name_japanese, name_romaji, song_type, length_seconds,
                artist_ids, publish_date, original_song_id, pv_data, tag_ids,
                niconico_views, youtube_views, niconico_history, youtube_history, last_update_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        cursor.execute(song_sql, tuple(record))
        
        artist_ids = json.loads(record[6])
        tag_ids = json.loads(record[10])
        
        cursor.execute("DELETE FROM song_artists WHERE song_id=?", (song_id,))
        for aid in artist_ids:
            cursor.execute("INSERT OR IGNORE INTO song_artists (song_id, artist_id) VALUES (?, ?)", (song_id, aid))
            
        cursor.execute("DELETE FROM song_tags WHERE song_id=?", (song_id,))
        for tid in tag_ids:
            cursor.execute("INSERT OR IGNORE INTO song_tags (song_id, tag_id) VALUES (?, ?)", (song_id, tid))
            
        conn.commit()
    except Exception as e:
        log_message("ERROR", f"Error updating ID {song_id}: {e}")

def update_song_worker(song_id: int):
    """Worker function for threaded updates. Creates its own connection per thread."""
def update_song_worker(song_id: int):
    """Worker function for threaded updates. Creates its own connection per thread."""
    conn = get_db_connection()
    try:
        update_song_by_id(conn, song_id)
    except Exception as e:
        log_message("ERROR", f"Error in worker for ID {song_id}: {e}")
    finally:
        conn.close()

def update_artist_by_id(conn: sqlite3.Connection, artist_id: int) -> bool:
    """Fetches and updates a specific artist by ID. Returns True if materially changed."""
    from .core import fetch_artist, transform_artist_api
    cursor = conn.cursor()
    changed = False
    
    data = fetch_artist(artist_id)
    if not data:
        log_message("WARNING", f"Failed to fetch data for ID {artist_id}")
        return False

    try:
        record = transform_artist_api(data)
        
        cursor.execute("SELECT name_english, picture_url_thumb FROM artists WHERE id=?", (artist_id,))
        existing = cursor.fetchone()
        
        if not existing or record[4] != existing[0] or record[9] != existing[1]:
            changed = True
            
        artist_sql = '''
            INSERT OR REPLACE INTO artists (
                id, artist_type, name_default, name_default_lang,
                name_english, name_japanese, name_romaji,
                picture_mime, picture_url_original, picture_url_thumb, external_links, last_update_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        cursor.execute(artist_sql, record)
        conn.commit()
    except Exception as e:
        log_message("ERROR", f"Error updating ID {artist_id}: {e}")
        
    return changed

def update_artist_worker(artist_id: int) -> bool:
    """Worker function for threaded artist updates. Returns True if materially changed."""
    conn = get_db_connection()
    try:
        return update_artist_by_id(conn, artist_id)
    except Exception as e:
        log_message("ERROR", f"Error in worker for ID {artist_id}: {e}")
        return False
    finally:
        conn.close()

def refresh_artists(limit: int = 10000):
    """
    Runs 5 parallel threads to update artists quickly.
    """
    log_message("INFO", f"Checking for {limit} artists to refresh...")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id FROM artists 
        ORDER BY last_update_time ASC 
        LIMIT ?
    """, (limit,))
    target_ids = [row[0] for row in cursor.fetchall()]
    conn.close()
    
    if not target_ids:
        log_message("INFO", "No artists found to update.")
        return
    
    log_message("INFO", f"Found {len(target_ids)} artists to refresh.")
    
    total_processed = 0
    actually_changed = 0
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(update_artist_worker, aid) for aid in target_ids]
        for future in concurrent.futures.as_completed(futures):
            total_processed += 1
            if future.result():
                actually_changed += 1
            if total_processed % 100 == 0:
                log_message("INFO", f"Updating artists: {total_processed}/{len(target_ids)} refreshed...")
            
    log_message("SUCCESS", f"Finished processing {total_processed} records. Detected material changes for ~{actually_changed} artists.")

def refresh_songs(mode: str, limit: int = 10000):
    """
    Sequentially fetches and updates songs safely with SQLite WAL.
    """
    import time
    if mode == "oldest":
        log_message("INFO", f"Checking for {limit} old songs to refresh...")
    else:
        log_message("INFO", f"Checking for {limit} newest songs to refresh...")
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    if mode == "oldest":
        cursor.execute("""
            SELECT id FROM songs 
            ORDER BY last_update_time ASC 
            LIMIT ?
        """, (limit,))
        target_ids = [row[0] for row in cursor.fetchall()]
        
    elif mode == "newest":
        max_id = get_max_id(conn, 'songs')
        if max_id == 0:
            conn.close()
            return

        start_id = max_id
        end_id = max(1, max_id - limit)
        
        cursor.execute("SELECT id FROM songs WHERE id <= ? AND id > ? ORDER BY id DESC", (start_id, end_id))
        target_ids = [row[0] for row in cursor.fetchall()]
    
    if not target_ids:
        conn.close()
        log_message("INFO", "No songs found to update.")
        return
        
    log_message("INFO", f"Found {len(target_ids)} songs to refresh.")

    import concurrent.futures
    completed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(update_song_worker, song_id) for song_id in target_ids]
        for future in concurrent.futures.as_completed(futures):
            completed += 1
            if completed % 100 == 0:
                log_message("INFO", f"Updating songs: {completed}/{len(target_ids)} refreshed...")
            
    log_message("SUCCESS", f"Finished refreshing {completed} records.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VocaRank Existing Database Metadata Updater")
    parser.add_argument("--songs", type=int, help="Update N oldest songs by last_update_time (Rolling update)")
    parser.add_argument("--newest-songs", type=int, help="Update N newest songs by id")
    parser.add_argument("--artists", type=int, help="Update N artists by last_update_time (Rolling update)")
    parser.add_argument("--song", type=int, help="Update single song by id")
    args = parser.parse_args()

    if args.song:
        conn = get_db_connection()
        update_song_by_id(conn, args.song)
        conn.close()
    elif args.artists:
        refresh_artists(args.artists)
    elif args.songs:
        refresh_songs("oldest", args.songs)
    elif args.newest_songs:
        refresh_songs("newest", args.newest_songs)
    else:
        print("Please specify a target flag (e.g., --songs 1000, --newest-songs 1000, --artists 1000, or --song ID)")
