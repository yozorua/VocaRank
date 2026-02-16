import sqlite3
import json
import os
import datetime
import urllib.request
import urllib.parse
import urllib.error
import time
import argparse
from typing import Dict, Any, List, Set, Tuple

class YouTubeQuotaExceeded(Exception):
    """Exception raised when YouTube API quota is exceeded (HTTP 403)."""
    pass

# Configuration
# Path: src/fetch_views.py -> database/vocarank.db
DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../database'))
DB_PATH = os.path.join(DB_DIR, 'vocarank.db')

YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/videos"
NICONICO_API_URL = "https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search"
# USER_AGENT = "VocaRank/1.0 (contact: your_email@example.com)" # Identify yourself
USER_AGENT = "VocaRank/1.0"

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

def make_request(url: str, headers: Dict[str, str] = {}, data: bytes = None) -> Dict[str, Any]:
    """Helper to make HTTP GET/POST request."""
    req = urllib.request.Request(url, headers=headers, data=data)
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                content = response.read().decode('utf-8')
                return json.loads(content)
    except urllib.error.HTTPError as e:
        log_message("ERROR", f"HTTP Error {e.code} for {url}: {e.reason}")
        if e.code == 403:
             # This is typically a quota or restricted access error for YouTube
             raise YouTubeQuotaExceeded(f"HTTP 403: {e.reason}")
        if e.code == 400:
             try:
                 log_message("ERROR", e.read().decode('utf-8'))
             except:
                 pass
    except Exception as e:
        log_message("ERROR", f"Error fetching {url}: {e}")
    return None

def fetch_youtube_views(video_ids: List[str], api_key: str) -> Tuple[Dict[str, int], bool]:
    """
    Fetches view counts for a list of YouTube video IDs.
    Returns (views_map, quota_exceeded_flag).
    """
    if not video_ids:
        return {}, False
    if not api_key:
        log_message("WARNING", "No API key provided for YouTube fetching.")
        return {}, False
        
    views_map = {}
    quota_exceeded = False
    log_message("INFO", f"Fetching YouTube views for {len(video_ids)} videos...")
    
    # Batch size 50
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i+50]
        ids_str = ",".join(batch)
        params = {
            'part': 'statistics',
            'id': ids_str,
            'key': api_key
        }
        query_string = urllib.parse.urlencode(params, safe=',')
        url = f"{YOUTUBE_API_URL}?{query_string}"
        
        try:
            data = make_request(url)
        except YouTubeQuotaExceeded as e:
            log_message("WARNING", f"YouTube API quota exceeded: {e}. Stopping YouTube requests for this batch.")
            quota_exceeded = True
            break
        
        if data:
            if 'error' in data:
                log_message("ERROR", f"YouTube API returned error: {data['error']}")
            elif 'items' in data:
                for item in data['items']:
                    vid = item['id']
                    stats = item.get('statistics', {})
                    view_count = stats.get('viewCount')
                    if view_count is not None:
                        views_map[vid] = int(view_count)
            else:
               log_message("WARNING", f"Unexpected response format from YouTube: {data.keys()}")
        else:
            log_message("WARNING", f"No data received from YouTube API for batch {i//50 + 1}.")
                    
    return views_map, quota_exceeded

def fetch_niconico_views(video_ids: List[str]) -> Dict[str, int]:
    """Fetches view counts for a list of Niconico video IDs."""
    if not video_ids:
        return {}
        
    views_map = {}
    
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i+50]
        
        params = {
            'q': '',
            'targets': 'title', 
            'fields': 'contentId,viewCounter',
            '_context': 'vocarank_etl',
            '_sort': '-viewCounter',
            '_limit': 100
        }
        
        for idx, vid in enumerate(batch):
            params[f'filters[contentId][{idx}]'] = vid
            
        data_encoded = urllib.parse.urlencode(params).encode('utf-8')
        
        headers = {
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        data_resp = make_request(NICONICO_API_URL, headers, data_encoded)
        if data_resp and 'data' in data_resp:
            for item in data_resp['data']:
                vid = item['contentId']
                views = item.get('viewCounter')
                if views is not None:
                    views_map[vid] = int(views)
            
    return views_map

def update_history(current_history_json: str, new_views: int) -> str:
    """Appends new view count to history JSON."""
    try:
        if not current_history_json:
            history = []
        else:
            history = json.loads(current_history_json)
            if not isinstance(history, list):
                history = []
    except:
        history = []
        
    now_iso = get_utc_now_iso()
    
    history.append({
        'date': now_iso,
        'views': new_views
    })
    
    return json.dumps(history)

def main():
    parser = argparse.ArgumentParser(description="Fetch view counts for VocaDB songs.")
    parser.add_argument("--youtube-key", help="YouTube Data API Key")
    parser.add_argument("--limit", type=int, default=0, help="Limit number of songs to process (0 = all)")
    parser.add_argument("--skip-youtube", action="store_true", help="Skip YouTube fetching")
    parser.add_argument("--skip-niconico", action="store_true", help="Skip Niconico fetching")
    args = parser.parse_args()
    
    if not os.path.exists(DB_PATH):
        log_message("ERROR", f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    log_message("INFO", "Scanning database for songs...")
    
    query = """
        SELECT id, pv_data, niconico_history, youtube_history, niconico_views, youtube_views 
        FROM songs 
        WHERE 1=1
    """
    params = []
    
    if args.skip_niconico:
        query += " AND pv_data LIKE '%Youtube%'"
        
    if args.skip_youtube:
        query += " AND pv_data LIKE '%NicoNicoDouga%'"
        
    query += " ORDER BY last_update_time ASC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    if args.limit > 0:
        rows = rows[:args.limit]
        
    log_message("INFO", f"Found {len(rows)} songs to process.")
    
    CHUNK_SIZE = 100
    
    count_processed = 0
    yt_quota_active = False
    
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i+CHUNK_SIZE]
        
        yt_ids_to_song = {} 
        nico_ids_to_song = {} 
        
        song_updates = {} # song_id -> {'nico_views': X, 'nico_hist': Y, ...}

        for row in chunk:
            song_id, pv_data_json, nico_hist, yt_hist, current_nico_views, current_yt_views = row
            
            # Initialize potential updates
            song_updates[song_id] = {
                'nico_views': current_nico_views,
                'yt_views': current_yt_views,
                'nico_hist': nico_hist,
                'yt_hist': yt_hist,
                'nico_changed': False,
                'yt_changed': False,
                'pv_data': pv_data_json,
                'temp_yt_views': {}, # pvid -> views
                'temp_nico_views': {} # pvid -> views
            }

            try:
                pvs = json.loads(pv_data_json)
                if not isinstance(pvs, list): continue
                
                for pv in pvs:
                    service = pv.get('service')
                    pvid = pv.get('pvId')
                    if not pvid: continue
                    
                    if service == 'Youtube' and not args.skip_youtube:
                        if pvid not in yt_ids_to_song: yt_ids_to_song[pvid] = []
                        yt_ids_to_song[pvid].append(song_id)
                    elif service == 'NicoNicoDouga' and not args.skip_niconico:
                        if pvid not in nico_ids_to_song: nico_ids_to_song[pvid] = []
                        nico_ids_to_song[pvid].append(song_id)
            except:
                pass

        # Fetch YouTube
        if args.youtube_key and yt_ids_to_song and not yt_quota_active:
            yt_views_map, quota_hit = fetch_youtube_views(list(yt_ids_to_song.keys()), args.youtube_key)
            if quota_hit:
                log_message("ERROR", "YouTube API quota exceeded. Stopping all fetching activities (including Niconico) to prevent further errors.")
                yt_quota_active = True
                # Break out of the chunks loop effectively stopping all processing
                break
            
            for ytid, views in yt_views_map.items():
                for sid in yt_ids_to_song[ytid]:
                    song_updates[sid]['temp_yt_views'][ytid] = views
                    song_updates[sid]['yt_changed'] = True

        # Fetch Niconico
        if nico_ids_to_song:
            nico_views_map = fetch_niconico_views(list(nico_ids_to_song.keys()))
            for nicoid, views in nico_views_map.items():
                for sid in nico_ids_to_song[nicoid]:
                    song_updates[sid]['temp_nico_views'][nicoid] = views
                    song_updates[sid]['nico_changed'] = True
        
        # Apply updates
        for sid, up in song_updates.items():
            updates_sql = []
            params = []
            
            # Update pv_data with individual views
            pvs = []
            pv_changed = False
            try:
                pvs = json.loads(up['pv_data'])
                if isinstance(pvs, list):
                    for pv in pvs:
                        service = pv.get('service')
                        pvid = pv.get('pvId')
                        new_pv_views = None
                        
                        if service == 'Youtube' and pvid in up['temp_yt_views']:
                            new_pv_views = up['temp_yt_views'][pvid]
                        elif service == 'NicoNicoDouga' and pvid in up['temp_nico_views']:
                            new_pv_views = up['temp_nico_views'][pvid]
                            
                        if new_pv_views is not None:
                            pv['views'] = new_pv_views
                            
                            # Update per-PV history
                            if 'history' not in pv:
                                pv['history'] = []
                            
                            # Append new history entry
                            pv['history'].append({
                                'date': get_utc_now_iso(),
                                'views': new_pv_views
                            })
                            
                            pv_changed = True
            except:
                pass

            if not args.skip_niconico and up['nico_changed']:
                # Calculate MAX instead of SUM
                new_val = max(up['temp_nico_views'].values()) if up['temp_nico_views'] else 0
                new_hist = update_history(up['nico_hist'], new_val)
                updates_sql.append("niconico_views=?, niconico_history=?")
                params.extend([new_val, new_hist])
                
            if not args.skip_youtube and up['yt_changed']:
                # Calculate MAX instead of SUM
                new_val = max(up['temp_yt_views'].values()) if up['temp_yt_views'] else 0
                new_hist = update_history(up['yt_hist'], new_val)
                updates_sql.append("youtube_views=?, youtube_history=?")
                params.extend([new_val, new_hist])
                
            if pv_changed:
                updates_sql.append("pv_data=?")
                params.append(json.dumps(pvs))
                
            if updates_sql:
                updates_sql.append("last_update_time=?")
                params.append(get_utc_now_iso())
                params.append(sid)
                
                sql = f"UPDATE songs SET {', '.join(updates_sql)} WHERE id=?"
                try:
                    cursor.execute(sql, params)
                except Exception as e:
                    log_message("ERROR", f"Error updating song {sid}: {e}")
            else:
                # rolling update
                try:
                    cursor.execute("UPDATE songs SET last_update_time=? WHERE id=?", 
                                  (get_utc_now_iso(), sid))
                except Exception as e:
                    log_message("ERROR", f"Error updating timestamp for song {sid}: {e}")

        conn.commit()
        count_processed += len(chunk)
        log_message("INFO", f"Processed {count_processed} / {len(rows)} songs...")
        time.sleep(0.5)

    conn.close()
    log_message("SUCCESS", "Fetching complete.")

if __name__ == "__main__":
    main()
