import json
import time
from .core import (
    get_db_connection, setup_database_schema, log_message,
    API_BASE, make_request, transform_song_api, transform_artist_api, ensure_artists_exist_with_conn
)

def fetch_new_artists():
    """
    Fetches the most recently added artists from VocaDB and inserts them.
    Stops processing when it encounters a batch of artists that all already exist.
    """
    conn = get_db_connection()
    setup_database_schema(conn)
    cursor = conn.cursor()
    
    table = 'artists'
    log_message("INFO", f"[{table}] Fetching new artists by AdditionDate...")
    
    max_results = 100
    start_index = 0
    total_artists_inserted = 0
    max_pages = 50 # Safety brake (up to 5k artists backward)
    
    artist_sql = '''
        INSERT OR REPLACE INTO artists (
            id, artist_type, name_default, name_default_lang,
            name_english, name_japanese, name_romaji,
            picture_mime, picture_url_original, picture_url_thumb, external_links, last_update_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''

    for page in range(max_pages):
        url = f"{API_BASE}/artists?sort=AdditionDate&fields=Names,MainPicture,WebLinks&maxResults={max_results}&start={start_index}&lang=English"
        data = make_request(url)
        
        if not data or 'items' not in data:
            log_message("WARNING", f"[{table}] Failed to fetch page {page}. Stopping.")
            break
            
        items = data['items']
        if not items:
            log_message("INFO", f"[{table}] No more items found. Stopping.")
            break
            
        log_message("INFO", f"[{table}] Page {page}: processing {len(items)} items...")
        
        existing_count_in_batch = 0
        
        for artist_data in items:
            artist_id = artist_data.get('id')
            
            cursor.execute("SELECT id FROM artists WHERE id=?", (artist_id,))
            if cursor.fetchone():
                existing_count_in_batch += 1
                continue
                
            try:
                record = transform_artist_api(artist_data)
                cursor.execute(artist_sql, record)
                total_artists_inserted += 1
            except Exception as e:
                log_message("ERROR", f"[{table}] Error inserting ID {artist_id}: {e}")
                
        conn.commit()
        
        if existing_count_in_batch == len(items):
            log_message("SUCCESS", f"[{table}] All items in batch already exist. Stopping fetch loop.")
            break
            
        start_index += max_results
        time.sleep(0.5)
        
    log_message("SUCCESS", f"[{table}] Finished. Inserted {total_artists_inserted} new artists.")
    conn.close()

def fetch_new_songs():
    """
    Fetches the most recently added songs from VocaDB and inserts them.
    Stops processing when it encounters a batch of songs that all already exist.
    """
    conn = get_db_connection()
    setup_database_schema(conn)
    cursor = conn.cursor()
    
    table = 'songs'
    log_message("INFO", f"[{table}] Fetching new songs by AdditionDate...")
    
    max_results = 100
    start_index = 0
    total_songs_inserted = 0
    total_songs_updated = 0
    total_artists_fetched = 0
    max_pages = 100 # Safety brake (up to 10k songs backward)
    
    # Pre-compile statements
    song_sql = '''
        INSERT OR REPLACE INTO songs (
            id, name_english, name_japanese, name_romaji, song_type, length_seconds,
            artist_ids, publish_date, original_song_id, pv_data, tag_ids,
            niconico_views, youtube_views, niconico_history, youtube_history, last_update_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''

    for page in range(max_pages):
        url = f"{API_BASE}/songs?sort=AdditionDate&fields=Names,Artists,Tags,PVs&maxResults={max_results}&start={start_index}&lang=English"
        data = make_request(url)
        
        if not data or 'items' not in data:
            log_message("WARNING", f"[{table}] Failed to fetch page {page}. Stopping.")
            break
            
        items = data['items']
        if not items:
            log_message("INFO", f"[{table}] No more items found. Stopping.")
            break
            
        log_message("INFO", f"[{table}] Page {page}: processing {len(items)} items...")
        
        existing_count_in_batch = 0
        
        for song_data in items:
            song_id = song_data.get('id')
            
            # Check if exists and retrieve views
            cursor.execute("SELECT niconico_views, youtube_views, niconico_history, youtube_history FROM songs WHERE id=?", (song_id,))
            existing = cursor.fetchone()
            
            nico_views = 0
            yt_views = 0
            nico_hist = '[]'
            yt_hist = '[]'
            is_update = False
            
            if existing: # This song is already in our DB!
                existing_count_in_batch += 1
                is_update = True
                nico_views = existing[0] if existing[0] else 0
                yt_views = existing[1] if existing[1] else 0
                nico_hist = existing[2] if existing[2] else '[]'
                yt_hist = existing[3] if existing[3] else '[]'
                
            try:
                base_record = transform_song_api(song_data)
                
                # Fetch related artists safely
                artist_ids = json.loads(base_record[6])
                artists_inserted = ensure_artists_exist_with_conn(conn, artist_ids)
                total_artists_fetched += artists_inserted
                
                # Assign existing views to prevent resetting stats to 0
                record = list(base_record)
                record[11] = nico_views
                record[12] = yt_views
                record[13] = nico_hist
                record[14] = yt_hist
                
                cursor.execute(song_sql, tuple(record))
                
                tag_ids = json.loads(record[10])
                
                if is_update:
                    cursor.execute("DELETE FROM song_artists WHERE song_id=?", (song_id,))
                    cursor.execute("DELETE FROM song_tags WHERE song_id=?", (song_id,))
                    total_songs_updated += 1
                else:
                    total_songs_inserted += 1

                for aid in artist_ids:
                    cursor.execute("INSERT OR IGNORE INTO song_artists (song_id, artist_id) VALUES (?, ?)", (song_id, aid))
                    
                for tid in tag_ids:
                    cursor.execute("INSERT OR IGNORE INTO song_tags (song_id, tag_id) VALUES (?, ?)", (song_id, tid))
                
            except Exception as e:
                log_message("ERROR", f"[{table}] Error inserting/updating ID {song_id}: {e}")
        
        
        conn.commit()
        
        if existing_count_in_batch == len(items):
            log_message("SUCCESS", f"[{table}] All items in batch already exist. Stopping fetch loop.")
            break
            
        start_index += max_results
        time.sleep(0.5)
        
    log_message("SUCCESS", f"[{table}] Finished. Inserted {total_songs_inserted} new songs, updated {total_songs_updated} legacy songs, and auto-fetched {total_artists_fetched} missing artists.")
    conn.close()

if __name__ == "__main__":
    fetch_new_artists()
    fetch_new_songs()
