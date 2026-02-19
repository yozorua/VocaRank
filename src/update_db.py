import sqlite3
import json
import os
import datetime
import requests
import time
from typing import Dict, Any, List, Tuple, Optional

# Configuration
DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../database'))
DB_PATH = os.path.join(DB_DIR, 'vocarank.db')

API_BASE = "https://vocadb.net/api"
MAX_CONSECUTIVE_ERRORS = 20 # Stop if we get 20 errors in a row (e.g. reach end of song list)
SLEEP_TIME = 0.5 # Be nice to the API

def get_utc_now_iso() -> str:
    """Returns current UTC time in ISO 8601 format."""
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def get_max_id(conn: sqlite3.Connection, table: str) -> int:
    """Gets the maximum ID from the specified table."""
    cursor = conn.cursor()
    try:
        cursor.execute(f"SELECT MAX(id) FROM {table}")
        result = cursor.fetchone()
        return result[0] if result and result[0] is not None else 0
    except Exception as e:
        print(f"Error checking max ID for {table}: {e}")
        return 0

def make_request(url: str) -> Optional[Dict[str, Any]]:
    """Helper to make HTTP GET request using requests."""
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 404 or response.status_code == 403:
            print(f"Warning: Failed to fetch {url}. Status: {response.status_code}")
            return None
        else:
            print(f"Warning: Failed to fetch {url}. Status: {response.status_code}")
            return None
    except Exception as e:
        print(f"Error requesting {url}: {e}")
        return None

def fetch_song(song_id: int) -> Optional[Dict[str, Any]]:
    """Fetches song data from VocaDB API."""
    url = f"{API_BASE}/songs/{song_id}?fields=Names,Artists,PVs,Tags&lang=English"
    return make_request(url)

def fetch_artist(artist_id: int) -> Optional[Dict[str, Any]]:
    """Fetches artist data from VocaDB API."""
    url = f"{API_BASE}/artists/{artist_id}?fields=Names,MainPicture,WebLinks"
    return make_request(url)

def parse_names(names_list: List[Dict[str, str]]) -> Dict[str, str]:
    """Parses the API 'names' (or AdditionalNames) list into english/japanese/romaji dict."""
    result = {'english': '', 'japanese': '', 'romaji': ''}
    
    if not isinstance(names_list, list):
        return result
        
    for name_entry in names_list:
        if not isinstance(name_entry, dict):
            continue
        lang = name_entry.get('language')
        val = name_entry.get('value')
        if lang == 'English':
            result['english'] = val
        elif lang == 'Japanese':
            result['japanese'] = val
        elif lang == 'Romaji':
            result['romaji'] = val
    return result

def transform_song_api(data: Dict[str, Any]) -> Tuple:
    """Transforms API song data to DB tuple."""
    names_list = data.get('names', [])
    if not names_list:
        names_list = data.get('additionalNames', [])
        
    names = parse_names(names_list)
    
    # Fallback to default name if specific ones are missing
    default_name = data.get('name', '')
    if not names['english'] and not names['japanese'] and not names['romaji']:
        names['english'] = default_name # Approximate fallback
    
    artist_ids = [a.get('artist', {}).get('id') for a in data.get('artists', []) if a.get('artist', {}).get('id')]
    
    # Original Song ID
    original_song_id = data.get('originalVersionId') # integer in API root
    
    # PVs
    pvs_raw = data.get('pvs', [])
    pvs_processed = []
    for pv in pvs_raw:
        pvs_processed.append({
            'name': pv.get('name'),
            'author': pv.get('author'),
            'publishDate': pv.get('publishDate'),
            'pvId': pv.get('pvId'),
            'service': pv.get('service'),
            'thumbUrl': pv.get('thumbUrl')
        })

    # Tags
    tags_raw = data.get('tags', [])
    tag_ids = [t.get('tag', {}).get('id') for t in tags_raw if t.get('tag', {}).get('id')]

    return (
        data.get('id'),
        names['english'],
        names['japanese'],
        names['romaji'],
        data.get('songType'),
        data.get('lengthSeconds'),
        json.dumps(artist_ids),
        data.get('publishDate'),
        original_song_id,
        json.dumps(pvs_processed),
        json.dumps(tag_ids),
        0, # niconico_views
        0, # youtube_views
        '[]', # niconico_history
        '[]', # youtube_history
        get_utc_now_iso()
    )

def transform_artist_api(data: Dict[str, Any]) -> Tuple:
    """Transforms API artist data to DB tuple."""
    names = parse_names(data.get('names', []))
    
    # Picture
    main_picture = data.get('mainPicture', {})
    picture_mime = main_picture.get('mime', '')
    picture_url_original = main_picture.get('urlOriginal', '')
    picture_url_thumb = main_picture.get('urlThumb', '')

    # WebLinks - Official only
    web_links = data.get('webLinks', [])
    official_links = []
    for link in web_links:
        if link.get('category') == 'Official':
            official_links.append({
                'category': 'Official',
                'description': link.get('description'),
                'url': link.get('url')
            })

    return (
        data.get('id'),
        data.get('artistType'),
        data.get('name', ''), # API root name is default
        data.get('defaultNameLanguage', ''),
        names['english'],
        names['japanese'],
        names['romaji'],
        picture_mime,
        picture_url_original,
        picture_url_thumb,
        json.dumps(official_links)
    )

def update_loop(conn: sqlite3.Connection, table: str, fetch_func: callable, transform_func: callable, insert_sql: str):
    """Generic update loop for a table."""
    cursor = conn.cursor()
    
    max_id = get_max_id(conn, table)
    print(f"[{table}] Max ID: {max_id}. Checking for new records...")
    
    current_id = max_id + 1
    
    consecutive_errors = 0
    updates_count = 0
    
    while consecutive_errors < MAX_CONSECUTIVE_ERRORS:
        data = fetch_func(current_id)
        
        if data:
            consecutive_errors = 0
            try:
                record = transform_func(data)
                cursor.execute(insert_sql, record)
                conn.commit()
                updates_count += 1
                print(f"[{table}] Added ID {current_id}: {data.get('name')}")
            except Exception as e:
                print(f"[{table}] Error inserting ID {current_id}: {e}")
        else:
            consecutive_errors += 1
            # print(f"[{table}] ID {current_id} not found ({consecutive_errors})")
            
        current_id += 1
        time.sleep(SLEEP_TIME)
        
    print(f"[{table}] Finished. Added {updates_count} new records. (Stopped after {MAX_CONSECUTIVE_ERRORS} misses)")



def ensure_artists_exist(conn: sqlite3.Connection, artist_ids: List[int]):
    """
    Checks if the given artist IDs exist in the artists table.
    If not, fetches them from VocaDB and inserts them.
    """
    if not artist_ids:
        return

    cursor = conn.cursor()
    
    # Check which ones exist
    placeholders = ','.join('?' for _ in artist_ids)
    cursor.execute(f"SELECT id FROM artists WHERE id IN ({placeholders})", artist_ids)
    existing_rows = cursor.fetchall()
    existing_ids = set(row[0] for row in existing_rows)
    
    missing_ids = [aid for aid in artist_ids if aid not in existing_ids]
    
    if not missing_ids:
        return
        
    print(f"[artists] Found {len(missing_ids)} missing artists. Auto-fetching...")
    
    # Prepare SQL for artist insertion
    artist_sql = '''
        INSERT OR REPLACE INTO artists (
            id, artist_type, name_default, name_default_lang,
            name_english, name_japanese, name_romaji,
            picture_mime, picture_url_original, picture_url_thumb, external_links
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''
    
    for aid in missing_ids:
        try:
            data = fetch_artist(aid)
            if data:
                record = transform_artist_api(data)
                cursor.execute(artist_sql, record)
                print(f"[artists] Auto-fetched ID {aid}: {data.get('name')}")
            else:
                print(f"[artists] Failed to fetch artist ID {aid}")
            time.sleep(SLEEP_TIME) # Be nice to API
        except Exception as e:
            print(f"[artists] Error fetching/inserting artist ID {aid}: {e}")
            
    conn.commit()

def update_song_by_id(conn: sqlite3.Connection, song_id: int):
    """Fetches and updates a specific song by ID, preserving existing view counts."""
    print(f"[songs] Force updating ID {song_id}...")
    cursor = conn.cursor()
    
    # Check for existing views to preserve
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
        print(f"[songs] Failed to fetch data for ID {song_id}")
        return

    try:
        # Transform but override views with existing
        base_record = transform_song_api(data)
        
        # ENSURE ARTISTS EXIST BEFORE INSERTING
        artist_ids = json.loads(base_record[6])
        ensure_artists_exist(conn, artist_ids)
        
        # Reconstruct record with preserved views
        # base_record indices: 
        # 11=nico_views, 12=yt_views, 13=nico_hist, 14=yt_hist
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
        
        # Update Relations
        artist_ids = json.loads(record[6])
        tag_ids = json.loads(record[10])
        
        cursor.execute("DELETE FROM song_artists WHERE song_id=?", (song_id,))
        for aid in artist_ids:
            cursor.execute("INSERT OR IGNORE INTO song_artists (song_id, artist_id) VALUES (?, ?)", (song_id, aid))
            
        cursor.execute("DELETE FROM song_tags WHERE song_id=?", (song_id,))
        for tid in tag_ids:
            cursor.execute("INSERT OR IGNORE INTO song_tags (song_id, tag_id) VALUES (?, ?)", (song_id, tid))
            
        conn.commit()
        print(f"[songs] Successfully updated ID {song_id}: {data.get('name')}")
        
    except Exception as e:
        print(f"[songs] Error updating ID {song_id}: {e}")

def fetch_new_songs_by_date(conn: sqlite3.Connection):
    """
    Fetches the most recently added songs from VocaDB and inserts/updates them.
    Only updates metadata, preserves view counts if song exists.
    """
    cursor = conn.cursor()
    table = 'songs'
    
    print(f"[{table}] Fetching new songs by AdditionDate...")
    
    # We will fetch page by page
    max_results = 100
    start_index = 0
    total_processed = 0
    
    # Safety brake: Stop if we fetch too many pages (e.g., 50 pages = 5000 songs)
    max_pages = 100 
    
    for page in range(max_pages):
        url = f"{API_BASE}/songs?sort=AdditionDate&fields=Names,Artists,Tags,PVs&maxResults={max_results}&start={start_index}&lang=English"
        data = make_request(url)
        
        if not data or 'items' not in data:
            print(f"[{table}] Failed to fetch page {page}. Stopping.")
            break
            
        items = data['items']
        if not items:
            print(f"[{table}] No more items found. Stopping.")
            break
            
        print(f"[{table}] Page {page}: processing {len(items)} items...")
        
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
            
            if existing:
                existing_count_in_batch += 1
                is_update = True
                nico_views = existing[0] if existing[0] else 0
                yt_views = existing[1] if existing[1] else 0
                nico_hist = existing[2] if existing[2] else '[]'
                yt_hist = existing[3] if existing[3] else '[]'
                
            # Insert or Update
            try:
                base_record = transform_song_api(song_data)
                
                # ENSURE ARTISTS EXIST BEFORE INSERTING
                artist_ids = json.loads(base_record[6])
                ensure_artists_exist(conn, artist_ids)
                
                record = list(base_record)
                record[11] = nico_views
                record[12] = yt_views
                record[13] = nico_hist
                record[14] = yt_hist
                
                # Copy-paste insert logic
                song_sql = '''
                    INSERT OR REPLACE INTO songs (
                        id, name_english, name_japanese, name_romaji, song_type, length_seconds,
                        artist_ids, publish_date, original_song_id, pv_data, tag_ids,
                        niconico_views, youtube_views, niconico_history, youtube_history, last_update_time
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                '''
                cursor.execute(song_sql, tuple(record))
                
                # Insert Relations (Delete old first if updating to ensure clean state)
                artist_ids = json.loads(record[6])
                tag_ids = json.loads(record[10])
                
                if is_update:
                    cursor.execute("DELETE FROM song_artists WHERE song_id=?", (song_id,))
                    cursor.execute("DELETE FROM song_tags WHERE song_id=?", (song_id,))

                for aid in artist_ids:
                    cursor.execute("INSERT OR IGNORE INTO song_artists (song_id, artist_id) VALUES (?, ?)", (song_id, aid))
                    
                for tid in tag_ids:
                    cursor.execute("INSERT OR IGNORE INTO song_tags (song_id, tag_id) VALUES (?, ?)", (song_id, tid))
                
            except Exception as e:
                print(f"[{table}] Error inserting/updating ID {song_id}: {e}")
        
        conn.commit()
        total_processed += len(items)
        
        if existing_count_in_batch == len(items):
            print(f"[{table}] All items in batch already exist. Stopping fetch loop.")
            break
            
        start_index += max_results
        time.sleep(SLEEP_TIME)
        
    print(f"[{table}] Finished. Processed {total_processed} records.")



def update_song_worker(conn_factory, song_id):
    """Worker function for threaded updates. Creates its own connection."""
    conn = conn_factory() # Create new connection for thread
    try:
        update_song_by_id(conn, song_id)
    except Exception as e:
        print(f"[songs] Error in worker for ID {song_id}: {e}")
    finally:
        conn.close()

def update_oldest_songs(conn: sqlite3.Connection, limit: int = 10000):
    """
    Updates a batch of songs that haven't been updated for the longest time.
    Uses parallel fetching to speed up the process.
    """
    import concurrent.futures
    import functools
    
    print(f"[songs] Checking for {limit} oldest records to refresh...")
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, name_english FROM songs 
        ORDER BY last_update_time ASC 
        LIMIT ?
    """, (limit,))
    
    oldest_songs = cursor.fetchall()
    
    if not oldest_songs:
        print("[songs] No songs found to update.")
        return
        
    print(f"[songs] Found {len(oldest_songs)} songs to refresh. Starting parallel update...")
    
    # We need a factory to create connections per thread because SQLite connections aren't thread-safe
    def create_conn():
        return sqlite3.connect(DB_PATH)

    # Use ThreadPoolExecutor
    # Max workers = 5 to be polite to VocaDB
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        # Map the worker to the song IDs
        # We process them in parallel
        futures = [executor.submit(update_song_worker, create_conn, row[0]) for row in oldest_songs]
        
        # Monitor progress
        completed = 0
        for future in concurrent.futures.as_completed(futures):
            completed += 1
            if completed % 100 == 0:
                print(f"[songs] Progress: {completed}/{len(oldest_songs)} refreshed.")
            
    print(f"[songs] Finished refreshing {len(oldest_songs)} old records.")

def main():
    import argparse
    parser = argparse.ArgumentParser(description="VocaRank Database Updater")
    parser.add_argument("--song", type=int, help="Force update a specific song by ID")
    parser.add_argument("--cron", action="store_true", help="Run the standard cron update loop")
    parser.add_argument("--limit", type=int, default=10000, help="Limit for auto-refresh (default: 10000)")
    args = parser.parse_args()

    # Ensure DB directory exists
    if not os.path.exists(DB_DIR):
        os.makedirs(DB_DIR)

    # Main connection for schema setup
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create tables if not exist (Schema definition...)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS artists (
            id INTEGER PRIMARY KEY,
            artist_type TEXT,
            name_default TEXT,
            name_default_lang TEXT,
            name_english TEXT,
            name_japanese TEXT,
            name_romaji TEXT,
            picture_mime TEXT,
            picture_url_original TEXT,
            picture_url_thumb TEXT,
            external_links TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS songs (
            id INTEGER PRIMARY KEY,
            name_english TEXT,
            name_japanese TEXT,
            name_romaji TEXT,
            song_type TEXT,
            length_seconds INTEGER,
            artist_ids TEXT, 
            publish_date TEXT,
            original_song_id INTEGER,
            pv_data TEXT,
            tag_ids TEXT,
            niconico_views INTEGER DEFAULT 0,
            youtube_views INTEGER DEFAULT 0,
            niconico_history TEXT DEFAULT '[]',
            youtube_history TEXT DEFAULT '[]',
            last_update_time TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS song_artists (
            song_id INTEGER,
            artist_id INTEGER,
            PRIMARY KEY (song_id, artist_id),
            FOREIGN KEY(song_id) REFERENCES songs(id),
            FOREIGN KEY(artist_id) REFERENCES artists(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS song_tags (
            song_id INTEGER,
            tag_id INTEGER,
            PRIMARY KEY (song_id, tag_id),
            FOREIGN KEY(song_id) REFERENCES songs(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS daily_snapshots (
            date TEXT,
            song_id INTEGER,
            niconico_views INTEGER,
            youtube_views INTEGER,
            PRIMARY KEY (date, song_id),
            FOREIGN KEY(song_id) REFERENCES songs(id)
        )
    ''')
    conn.commit()
    conn.close() # Close main connection before branching

    if args.song:
        conn = sqlite3.connect(DB_PATH)
        update_song_by_id(conn, args.song)
        conn.close()
    else:
        # Default behavior (cron)
        conn = sqlite3.connect(DB_PATH)
        
        artist_sql = '''
            INSERT OR REPLACE INTO artists (
                id, artist_type, name_default, name_default_lang,
                name_english, name_japanese, name_romaji,
                picture_mime, picture_url_original, picture_url_thumb, external_links
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        update_loop(conn, 'artists', fetch_artist, transform_artist_api, artist_sql)
        
        # 1. Fetch new songs (and update recent ones)
        fetch_new_songs_by_date(conn)
        
        conn.close() # Close before entering threaded function which makes its own conns
        
        # 2. Refresh a batch of old songs (e.g. 10000 per run ~ 30 mins with parallel)
        # This ensures the DB cycles through updates eventually
        # 800k songs / 10000 = 80 days (~2.5 months) cycle.
        # This finishes safely before the 4:00 AM views job.
        conn = sqlite3.connect(DB_PATH)
        update_oldest_songs(conn, limit=args.limit)
        conn.close()

if __name__ == "__main__":
    main()
