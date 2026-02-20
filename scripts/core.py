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
YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos"
NICONICO_API_URL = "https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search"
USER_AGENT = "VocaRank/1.0"
SYNTH_TYPES = (
    'Vocaloid', 'UTAU', 'CeVIO', 'SynthesizerV', 'NEUTRINO', 
    'AIVOICE', 'VOICEVOX', 'NewType', 'Voiceroid', 'ACEVirtualSinger'
)


def get_db_connection() -> sqlite3.Connection:
    """Gets a SQLite connection safely configured for concurrency."""
    # Ensure DB directory exists
    if not os.path.exists(DB_DIR):
        os.makedirs(DB_DIR)

    conn = sqlite3.connect(DB_PATH, timeout=30.0) # Long timeout to avoid "database is locked"
    # Enable WAL mode for strict concurrent Read-Write capabilities
    conn.execute("PRAGMA journal_mode=WAL;")
    # Ensure foreign keys are enabled (if needed by schemas)
    conn.execute("PRAGMA foreign_keys=ON;") 
    return conn

def setup_database_schema(conn: sqlite3.Connection):
    """Initializes the database schema if tables don't exist."""
    cursor = conn.cursor()
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
            external_links TEXT,
            last_update_time TEXT
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

def log_message(level: str, message: str):
    """Prints a message with timestamp and color."""
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    colors = {
        'INFO': '\033[94m', # Blue
        'SUCCESS': '\033[92m', # Green
        'WARNING': '\033[93m', # Yellow
        'ERROR': '\033[91m', # Red
        'DEBUG': '\033[90m', # Grey
        'RESET': '\033[0m'
    }
    
    color = colors.get(level, colors['RESET'])
    reset = colors['RESET']
    
    print(f"[{now} | {color}{level}{reset}] {message}")

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
        log_message("ERROR", f"Error checking max ID for {table}: {e}")
        return 0

def make_request(url: str, max_retries: int = 3) -> Optional[Dict[str, Any]]:
    """Helper to make HTTP GET request using requests with retry logic."""
    for attempt in range(max_retries):
        try:
            # Increased timeout to 20 seconds to give VocaDB more time to respond
            response = requests.get(url, timeout=20)
            if response.status_code == 200:
                return response.json()
            elif response.status_code in (404, 403):
                # 404 Not Found usually means the ID was deleted from VocaDB
                log_message("WARNING", f"Failed to fetch {url}. Status: {response.status_code}")
                return None
            else:
                log_message("WARNING", f"Attempt {attempt+1}: Failed to fetch {url}. Status: {response.status_code}")
        except requests.exceptions.Timeout:
            log_message("WARNING", f"Attempt {attempt+1}: Read timed out for {url}")
        except Exception as e:
            log_message("ERROR", f"Attempt {attempt+1}: Error requesting {url}: {e}")
            
        if attempt < max_retries - 1:
            time.sleep(2 * (attempt + 1)) # Exponential backoff: sleep 2s, then 4s, etc.
            
    log_message("ERROR", f"Gave up on {url} after {max_retries} attempts.")
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
    """Parses the API 'names' list into english/japanese/romaji dict."""
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
        names['english'] = default_name
    
    artist_ids = [a.get('artist', {}).get('id') for a in data.get('artists', []) if a.get('artist', {}).get('id')]
    original_song_id = data.get('originalVersionId') 
    
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
        0, 0, '[]', '[]', # placeholder for niconico_views, youtube_views, niconico_history, youtube_history
        get_utc_now_iso()
    )

def transform_artist_api(data: Dict[str, Any]) -> Tuple:
    """Transforms API artist data to DB tuple."""
    names = parse_names(data.get('names', []))
    
    main_picture = data.get('mainPicture', {})
    picture_mime = main_picture.get('mime', '')
    picture_url_original = main_picture.get('urlOriginal', '')
    picture_url_thumb = main_picture.get('urlThumb', '')

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
        data.get('name', ''), 
        data.get('defaultNameLanguage', ''),
        names['english'],
        names['japanese'],
        names['romaji'],
        picture_mime,
        picture_url_original,
        picture_url_thumb,
        json.dumps(official_links),
        get_utc_now_iso()
    )

def ensure_artists_exist_with_conn(conn: sqlite3.Connection, artist_ids: List[int], sleep_time: float = 0.1) -> int:
    """Checks missing artist IDs and fetches them from VocaDB. Returns count of new artists inserted."""
    if not artist_ids:
        return 0

    cursor = conn.cursor()
    placeholders = ','.join('?' for _ in artist_ids)
    cursor.execute(f"SELECT id FROM artists WHERE id IN ({placeholders})", artist_ids)
    existing_ids = set(row[0] for row in cursor.fetchall())
    
    missing_ids = [aid for aid in artist_ids if aid not in existing_ids]
    if not missing_ids:
        return 0
        
    log_message("INFO", f"[artists] Found {len(missing_ids)} missing artists. Auto-fetching...")
    
    artist_sql = '''
        INSERT OR REPLACE INTO artists (
            id, artist_type, name_default, name_default_lang,
            name_english, name_japanese, name_romaji,
            picture_mime, picture_url_original, picture_url_thumb, external_links, last_update_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''
    
    inserted_count = 0
    for aid in missing_ids:
        try:
            data = fetch_artist(aid)
            if data:
                record = transform_artist_api(data)
                cursor.execute(artist_sql, record)
                inserted_count += 1
                log_message("SUCCESS", f"[artists] Auto-fetched ID {aid}: {data.get('name')}")
            else:
                log_message("WARNING", f"[artists] Failed to fetch artist ID {aid}")
            time.sleep(sleep_time)
        except Exception as e:
            log_message("ERROR", f"[artists] Error fetching/inserting artist ID {aid}: {e}")
            
    conn.commit()
    return inserted_count
