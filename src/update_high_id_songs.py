
import sqlite3
import json
import os
import requests
import time
import concurrent.futures
import threading
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

# Configuration
DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../database'))
DB_PATH = os.path.join(DB_DIR, 'vocarank.db')
API_BASE = "https://vocadb.net/api"
SLEEP_TIME = 0.1  # Reduced sleep for speed
MAX_WORKERS = 10  # Increased parallelism

# Thread-safe counters
processed_count = 0
updated_count = 0
error_count = 0
lock = threading.Lock()

def get_utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def make_request(url: str) -> Optional[Dict[str, Any]]:
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception:
        return None

def fetch_song(song_id: int) -> Optional[Dict[str, Any]]:
    url = f"{API_BASE}/songs/{song_id}?fields=Names,Artists,PVs,Tags&lang=English"
    return make_request(url)

# Reusing transformation logic (simplified for this script)
def transform_song_api(data: Dict[str, Any], existing_views: tuple) -> tuple:
    names = {'english': '', 'japanese': '', 'romaji': ''}
    for n in data.get('names', []) or data.get('additionalNames', []):
        if n.get('language') == 'English': names['english'] = n.get('value')
        elif n.get('language') == 'Japanese': names['japanese'] = n.get('value')
        elif n.get('language') == 'Romaji': names['romaji'] = n.get('value')
    
    default_name = data.get('name', '')
    if not any(names.values()): names['english'] = default_name

    artist_ids = [a.get('artist', {}).get('id') for a in data.get('artists', []) if a.get('artist', {}).get('id')]
    
    pvs = [{'service': pv.get('service'), 'pvId': pv.get('pvId'), 'url': pv.get('url')} for pv in data.get('pvs', [])]
    tag_ids = [t.get('tag', {}).get('id') for t in data.get('tags', []) if t.get('tag', {}).get('id')]

    # Preserve existing views
    nico_views, yt_views, nico_hist, yt_hist = existing_views

    return (
        data.get('id'),
        names['english'],
        names['japanese'],
        names['romaji'],
        data.get('songType'),
        data.get('lengthSeconds'),
        json.dumps(artist_ids),
        data.get('publishDate'),
        data.get('originalVersionId'),
        json.dumps(pvs),
        json.dumps(tag_ids),
        nico_views,
        yt_views,
        nico_hist,
        yt_hist,
        get_utc_now_iso()
    )

def worker(song_id: int):
    global processed_count, updated_count, error_count

    # Create thread-local connection
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # Check if song exists and get views
        cursor.execute("SELECT niconico_views, youtube_views, niconico_history, youtube_history FROM songs WHERE id=?", (song_id,))
        existing = cursor.fetchone()
        existing_views = existing if existing else (0, 0, '[]', '[]')

        # Check existing artists to flag unknown ones
        if existing:
            cursor.execute("SELECT artist_id FROM song_artists WHERE song_id=?", (song_id,))
            linked_artists = {row[0] for row in cursor.fetchall()}
        else:
            linked_artists = set()

        # Fetch from API
        data = fetch_song(song_id)
        if not data:
            return  # Skip if not found or error

        # Check for unknown artists in the new data
        new_artist_ids = [a.get('artist', {}).get('id') for a in data.get('artists', []) if a.get('artist', {}).get('id')]
        
        # Verify if these artists exist in our DB
        unknown_artists = []
        for aid in new_artist_ids:
            cursor.execute("SELECT 1 FROM artists WHERE id=?", (aid,))
            if not cursor.fetchone():
                unknown_artists.append(aid)

        if unknown_artists:
            print(f"[!] Song {song_id} has UNKNOWN artists: {unknown_artists}")

        # Update Song
        record = transform_song_api(data, existing_views)
        
        sql = '''
            INSERT OR REPLACE INTO songs (
                id, name_english, name_japanese, name_romaji, song_type, length_seconds,
                artist_ids, publish_date, original_song_id, pv_data, tag_ids,
                niconico_views, youtube_views, niconico_history, youtube_history, last_update_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        cursor.execute(sql, record)

        # Update Relations
        cursor.execute("DELETE FROM song_artists WHERE song_id=?", (song_id,))
        for aid in new_artist_ids:
            cursor.execute("INSERT OR IGNORE INTO song_artists (song_id, artist_id) VALUES (?, ?)", (song_id, aid))
            
        cursor.execute("DELETE FROM song_tags WHERE song_id=?", (song_id,))
        tag_ids = json.loads(record[10]) # Get from record
        for tid in tag_ids:
            cursor.execute("INSERT OR IGNORE INTO song_tags (song_id, tag_id) VALUES (?, ?)", (song_id, tid))

        conn.commit()
        
        with lock:
            updated_count += 1

    except Exception as e:
        with lock:
            error_count += 1
            print(f"Error on {song_id}: {e}")
    finally:
        conn.close()
        with lock:
            processed_count += 1
        time.sleep(SLEEP_TIME)


def main():
    # Connect briefly to get max ID
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT MAX(id) FROM songs")
    max_id = cursor.fetchone()[0] or 0
    conn.close()

    if max_id == 0:
        print("No songs found in DB.")
        return

    print(f"Starting full update from ID {max_id} down to 1.")

    # Generate list of IDs to check
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Fetch ALL IDs in descending order
    cursor.execute("SELECT id FROM songs ORDER BY id DESC")
    target_ids = [row[0] for row in cursor.fetchall()]
    conn.close()

    total_songs = len(target_ids)
    print(f"Target: {total_songs} songs (Full Range). Max Workers: {MAX_WORKERS}")
    
    start_time = time.time()

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(worker, song_id) for song_id in target_ids]
        
        # Monitor Loop
        completion_count = 0
        while any(f.running() for f in futures):
            # Calculate dynamic ETA
            elapsed = time.time() - start_time
            rate = processed_count / elapsed if elapsed > 0 else 0
            eta = (total_songs - processed_count) / rate if rate > 0 else 0
            
            print(f"Progress: {processed_count}/{total_songs} | Upd: {updated_count} | Err: {error_count} | Rate: {rate:.1f}/s | ETA: {eta/60:.1f}m", end='\r')
            time.sleep(0.5)
            
            # Break if all futures done (double check)
            if processed_count >= total_songs:
                break

    print(f"\nDone! Processed {processed_count} songs in {time.time() - start_time:.1f}s.")


if __name__ == "__main__":
    main()
