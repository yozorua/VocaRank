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
    url = f"{API_BASE}/artists/{artist_id}?fields=Names"
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
    
    artist_ids = [a.get('id') for a in data.get('artists', []) if a.get('id')]
    
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
    
    return (
        data.get('id'),
        data.get('artistType'),
        data.get('name', ''), # API root name is default
        data.get('defaultNameLanguage', ''),
        names['english'],
        names['japanese'],
        names['romaji']
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

def fetch_new_songs_by_date(conn: sqlite3.Connection):
    """
    Fetches the most recently added songs from VocaDB and inserts them.
    Stops when it encounters songs that are already in the database.
    """
    cursor = conn.cursor()
    table = 'songs'
    
    print(f"[{table}] Fetching new songs by AdditionDate...")
    
    # We will fetch page by page
    max_results = 100
    start_index = 0
    total_added = 0
    
    # Safety brake: Stop if we fetch too many pages (e.g., 50 pages = 5000 songs)
    # just in case the DB is empty or something weird happens.
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
        new_count_in_batch = 0
        
        for song_data in items:
            song_id = song_data.get('id')
            
            # Check if exists
            cursor.execute("SELECT 1 FROM songs WHERE id=?", (song_id,))
            exists = cursor.fetchone()
            
            if exists:
                existing_count_in_batch += 1
                continue
                
            # Insert New
            try:
                record = transform_song_api(song_data)
                
                # Copy-paste insert logic
                song_sql = '''
                    INSERT OR REPLACE INTO songs (
                        id, name_english, name_japanese, name_romaji, song_type, length_seconds,
                        artist_ids, publish_date, original_song_id, pv_data, tag_ids,
                        niconico_views, youtube_views, niconico_history, youtube_history, last_update_time
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                '''
                cursor.execute(song_sql, record)
                
                # Insert Relations
                artist_ids = json.loads(record[6])
                tag_ids = json.loads(record[10])
                
                for aid in artist_ids:
                    cursor.execute("INSERT OR IGNORE INTO song_artists (song_id, artist_id) VALUES (?, ?)", (song_id, aid))
                    
                for tid in tag_ids:
                    cursor.execute("INSERT OR IGNORE INTO song_tags (song_id, tag_id) VALUES (?, ?)", (song_id, tid))
                
                new_count_in_batch += 1
                # print(f"[{table}] Added ID {song_id}: {song_data.get('name')}")
                
            except Exception as e:
                print(f"[{table}] Error inserting ID {song_id}: {e}")
        
        conn.commit()
        total_added += new_count_in_batch
        
        # Stop Condition: If all items in this batch already exist, we are caught up.
        if existing_count_in_batch == len(items):
            print(f"[{table}] All items in batch already exist. We are caught up!")
            break
            
        start_index += max_results
        time.sleep(SLEEP_TIME)
        
    print(f"[{table}] Finished. Added {total_added} new records.")

def main():
    # Ensure DB directory exists
    if not os.path.exists(DB_DIR):
        os.makedirs(DB_DIR)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS artists (
            id INTEGER PRIMARY KEY,
            artist_type TEXT,
            name_default TEXT,
            name_default_lang TEXT,
            name_english TEXT,
            name_japanese TEXT,
            name_romaji TEXT
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



    artist_sql = '''
        INSERT OR REPLACE INTO artists (
            id, artist_type, name_default, name_default_lang,
            name_english, name_japanese, name_romaji
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    '''
    update_loop(conn, 'artists', fetch_artist, transform_artist_api, artist_sql)
    
    
    fetch_new_songs_by_date(conn)
    
    conn.close()

if __name__ == "__main__":
    main()
