import os
import time
import json
import urllib.request
import urllib.parse
import urllib.error
import argparse
import datetime
from dotenv import load_dotenv
from typing import Dict, Any, List, Set, Tuple, Optional
from .core import get_db_connection, log_message, YOUTUBE_API_URL, NICONICO_API_URL, USER_AGENT, get_utc_now_iso

load_dotenv()

class YouTubeQuotaExceeded(Exception):
    pass

class KeyManager:
    def __init__(self, keys: List[str]):
        self.keys = [k.strip() for k in keys if k.strip()]
        self.current_index = 0
        self.exhausted_indices: Set[int] = set()

    def get_current_key(self) -> Optional[str]:
        if not self.keys:
            return None
        for i in range(len(self.keys)):
            idx = (self.current_index + i) % len(self.keys)
            if idx not in self.exhausted_indices:
                self.current_index = idx 
                return self.keys[idx]
        return None

    def mark_current_exhausted(self):
        if self.keys:
            log_message("WARNING", f"Key ending in ...{self.keys[self.current_index][-4:]} exhausted.")
            self.exhausted_indices.add(self.current_index)
            self.current_index = (self.current_index + 1) % len(self.keys)

def make_request(url: str, headers: Dict[str, str] = {}, data: bytes = None) -> Dict[str, Any]:
    req = urllib.request.Request(url, headers=headers, data=data)
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                content = response.read().decode('utf-8')
                return json.loads(content)
    except urllib.error.HTTPError as e:
        log_message("ERROR", f"HTTP Error {e.code} for {url}: {e.reason}")
        if e.code == 403:
             raise YouTubeQuotaExceeded(f"HTTP 403: {e.reason}")
    except Exception as e:
        log_message("ERROR", f"Error fetching {url}: {e}")
    return None

def fetch_youtube_views(video_ids: List[str], api_key: str) -> Tuple[Dict[str, int], bool]:
    if not video_ids: return {}, False
    if not api_key: return {}, False
        
    views_map = {}
    quota_exceeded = False
    
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i+50]
        ids_str = ",".join(batch)
        params = {'part': 'statistics', 'id': ids_str, 'key': api_key}
        query_string = urllib.parse.urlencode(params, safe=',')
        url = f"{YOUTUBE_API_URL}?{query_string}"
        
        try:
            data = make_request(url)
        except YouTubeQuotaExceeded as e:
            log_message("WARNING", f"YouTube quota exceeded: {e}. Stopping batch.")
            quota_exceeded = True
            break
        
        if data and 'items' in data:
            for item in data['items']:
                vid = item['id']
                view_count = item.get('statistics', {}).get('viewCount')
                if view_count is not None:
                    views_map[vid] = int(view_count)
                    
    return views_map, quota_exceeded

def fetch_niconico_views(video_ids: List[str]) -> Dict[str, int]:
    if not video_ids: return {}
        
    views_map = {}
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i+50]
        params = {
            'q': '', 'targets': 'title', 'fields': 'contentId,viewCounter',
            '_context': 'vocarank_etl', '_sort': '-viewCounter', '_limit': 100
        }
        for idx, vid in enumerate(batch):
            params[f'filters[contentId][{idx}]'] = vid
            
        data_encoded = urllib.parse.urlencode(params).encode('utf-8')
        headers = {'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded'}
        
        data_resp = make_request(NICONICO_API_URL, headers, data_encoded)
        if data_resp and 'data' in data_resp:
            for item in data_resp['data']:
                vid = item['contentId']
                views = item.get('viewCounter')
                if views is not None:
                    views_map[vid] = int(views)
    return views_map

def update_history(current_history_json: str, new_views: int) -> str:
    try:
        history = json.loads(current_history_json) if current_history_json else []
        if not isinstance(history, list): history = []
    except:
        history = []
        
    history.append({'date': get_utc_now_iso(), 'views': new_views})
    return json.dumps(history)

def main():
    parser = argparse.ArgumentParser(description="Fetch view counts.")
    parser.add_argument("--mode", choices=['all', 'popular'], default='all', help="Mode: 'all' to update everything, 'popular' (>= 100,000 views).")
    parser.add_argument("--id", type=int, help="Fetch view counts for a specific song ID.")
    args = parser.parse_args()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT id, pv_data, niconico_history, youtube_history, niconico_views, youtube_views FROM songs WHERE 1=1"
    
    if args.id:
        log_message("INFO", f"Mode: SPECIFIC ID ({args.id})")
        query += f" AND id = {args.id}"
        keys = os.getenv("YOUTUBE_KEYS_GENERAL", "").split(",")
    elif args.mode == 'popular':
        log_message("INFO", "Mode: POPULAR (>=100K YouTube Views or released in last 30 days)")
        query += " AND (youtube_views >= 100000 OR publish_date::date >= CURRENT_DATE - INTERVAL '30 days')"
        pop_keys = os.getenv("YOUTUBE_KEYS_POPULAR") or os.getenv("YOUTUBE_KEY_POPULAR")
        keys = pop_keys.split(",") if pop_keys else os.getenv("YOUTUBE_KEYS_GENERAL", "").split(",")
    else:
        log_message("INFO", "Mode: ALL")
        keys = os.getenv("YOUTUBE_KEYS_GENERAL", "").split(",")

    key_manager = KeyManager(keys)
    query += " ORDER BY last_update_time ASC"
    
    cursor.execute(query)
    rows = cursor.fetchall()
    log_message("INFO", f"Found {len(rows)} songs to process.")
    
    CHUNK_SIZE = 100
    count_processed = 0
    total_yt_updates = 0
    total_nico_updates = 0
    yt_quota_active = False
    
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i+CHUNK_SIZE]
        yt_ids_to_song = {} 
        nico_ids_to_song = {} 
        song_updates = {}
        batch_yt_updates = 0
        batch_nico_updates = 0
        
        for row in chunk:
            song_id, pv_data_json, nico_hist, yt_hist, current_nico_views, current_yt_views = row
            
            # Dynamically determine the primary PV IDs like the API does
            yt_id = None
            nico_id = None
            try:
                p = json.loads(pv_data_json)
                if isinstance(p, list):
                    for pv in p:
                        srv = pv.get('service')
                        if srv == 'Youtube' and not yt_id: yt_id = pv.get('pvId')
                        elif srv == 'NicoNicoDouga' and not nico_id: nico_id = pv.get('pvId')
            except: pass
            
            song_updates[song_id] = {
                'nico_views': current_nico_views, 'yt_views': current_yt_views,
                'nico_hist': nico_hist, 'yt_hist': yt_hist, 'pv_data': pv_data_json,
                'nico_id': nico_id, 'yt_id': yt_id,
                'nico_changed': False, 'yt_changed': False,
                'temp_yt_views': {}, 'temp_nico_views': {}
            }

            try:
                pvs = json.loads(pv_data_json)
                if not isinstance(pvs, list): continue
                for pv in pvs:
                    service = pv.get('service')
                    pvid = pv.get('pvId')
                    if not pvid: continue
                    if service == 'Youtube':
                        if pvid not in yt_ids_to_song: yt_ids_to_song[pvid] = []
                        yt_ids_to_song[pvid].append(song_id)
                    elif service == 'NicoNicoDouga':
                        if pvid not in nico_ids_to_song: nico_ids_to_song[pvid] = []
                        nico_ids_to_song[pvid].append(song_id)
            except:
                pass
        
        if yt_ids_to_song:
            yt_keys = list(yt_ids_to_song.keys())
            for j in range(0, len(yt_keys), 50):
                yt_batch = yt_keys[j:j+50]
                
                if yt_quota_active:
                    continue # Skip fetching this batch, but let niconico run later
                    
                while True:
                    api_key = key_manager.get_current_key()
                    if not api_key:
                        log_message("ERROR", "All YouTube keys exhausted.")
                        yt_quota_active = True
                        break # Break the while loop
                        
                    yt_views_map, quota_hit = fetch_youtube_views(yt_batch, api_key)
                    if quota_hit:
                        key_manager.mark_current_exhausted()
                        continue # Try next key
                        
                    for ytid, views in yt_views_map.items():
                        for sid in yt_ids_to_song[ytid]:
                            song_updates[sid]['temp_yt_views'][ytid] = views
                            song_updates[sid]['yt_changed'] = True
                    break # Success, escape while loop for this batch
        
        if nico_ids_to_song:
            nico_keys = list(nico_ids_to_song.keys())
            for j in range(0, len(nico_keys), 50):
                nico_batch = nico_keys[j:j+50]
                nico_views_map = fetch_niconico_views(nico_batch)
                for nicoid, views in nico_views_map.items():
                    for sid in nico_ids_to_song[nicoid]:
                        song_updates[sid]['temp_nico_views'][nicoid] = views
                        song_updates[sid]['nico_changed'] = True
                    
        for sid, up in song_updates.items():
            updates_sql = []
            params = []
            pv_changed = False
            
            try:
                pvs = json.loads(up['pv_data'])
                if isinstance(pvs, list):
                    yt_id = up['yt_id']
                    if yt_id and yt_id not in up['temp_yt_views'] and up['temp_yt_views']:
                        working_yt_pvs = [p for p in pvs
                                          if p.get('service') == 'Youtube'
                                          and p.get('pvId') in up['temp_yt_views']]
                        if working_yt_pvs:
                            # Read pre-correction view count BEFORE the per-PV loop overwrites it
                            pre_correction_views = working_yt_pvs[0].get('views')
                            dead_yt_pvs = [p for p in pvs
                                           if p.get('service') == 'Youtube'
                                           and p.get('pvId') not in up['temp_yt_views']]
                            other_pvs = [p for p in pvs if p.get('service') != 'Youtube']
                            pvs = working_yt_pvs + other_pvs + dead_yt_pvs
                            new_primary = working_yt_pvs[0]['pvId']
                            log_message("INFO", f"Song {sid}: Dead YouTube primary {yt_id!r} → promoting {new_primary!r}")
                            up['yt_id'] = new_primary
                            pv_changed = True
                            # Backfill past daily_snapshots to prevent artificial ranking jump.
                            # Use the working PV's last known view count as the baseline;
                            # fall back to today's fetched value (zeroes out gain) if never tracked.
                            baseline = pre_correction_views if pre_correction_views is not None else up['temp_yt_views'].get(new_primary, 0)
                            try:
                                cursor.execute(
                                    "UPDATE daily_snapshots SET youtube_views = %s WHERE song_id = %s AND date::date < CURRENT_DATE",
                                    (baseline, sid)
                                )
                                log_message("INFO", f"Song {sid}: Backfilled daily_snapshots to {baseline} to prevent ranking jump")
                            except Exception as e:
                                log_message("WARNING", f"Song {sid}: Failed to backfill snapshots: {e}")
                                conn.rollback()
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
                            if 'history' not in pv: pv['history'] = []
                            pv['history'].append({'date': get_utc_now_iso(), 'views': new_pv_views})
                            pv_changed = True
            except: pass

            if up['nico_changed'] and up['nico_id'] in up['temp_nico_views']:
                new_val = up['temp_nico_views'][up['nico_id']]
                if new_val != up['nico_views']:
                    total_nico_updates += 1
                    batch_nico_updates += 1
                new_hist = update_history(up['nico_hist'], new_val)
                updates_sql.append("niconico_views=%s")
                updates_sql.append("niconico_history=%s")
                params.extend([new_val, new_hist])
                
            if up['yt_changed'] and up['yt_id'] in up['temp_yt_views']:
                new_val = up['temp_yt_views'][up['yt_id']]
                if new_val != up['yt_views']:
                    total_yt_updates += 1
                    batch_yt_updates += 1
                new_hist = update_history(up['yt_hist'], new_val)
                updates_sql.append("youtube_views=%s")
                updates_sql.append("youtube_history=%s")
                params.extend([new_val, new_hist])
                
            if pv_changed:
                updates_sql.append("pv_data=%s")
                params.append(json.dumps(pvs))
                
            if updates_sql:
                updates_sql.append("last_update_time=%s")
                params.extend([get_utc_now_iso(), sid])
                sql = f"UPDATE songs SET {', '.join(updates_sql)} WHERE id=%s"
                try: cursor.execute(sql, tuple(params))
                except Exception as e: log_message("ERROR", f"Error updating song {sid}: {e}")

        conn.commit()
        count_processed += len(chunk)
        log_message("INFO", f"Fetching views: {count_processed}/{len(rows)} songs... ( Niconico: {batch_nico_updates} | YouTube: {batch_yt_updates})")
        time.sleep(0.5)

    log_message("SUCCESS", f"Finished checking {len(rows)} songs. Total Updates Found -> Niconico: {total_nico_updates} | YouTube: {total_yt_updates}.")
    log_message("INFO", "Note: The Niconico Snapshot Search API only updates data once per day (5:00 AM JST). Niconico updates will correctly be 0 if running multiple times per day.")

    if args.mode == 'all':
        today_date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
        log_message("INFO", f"Saving daily snapshots for {today_date}...")
        try:
            cursor.execute(f"""
                INSERT INTO daily_snapshots (date, song_id, niconico_views, youtube_views)
                SELECT '{today_date}', id, niconico_views, youtube_views FROM songs
                ON CONFLICT (date, song_id) DO UPDATE SET
                    niconico_views = EXCLUDED.niconico_views,
                    youtube_views = EXCLUDED.youtube_views
            """)
            conn.commit()
            log_message("SUCCESS", f"Daily snapshots saved for {today_date}.")
        except Exception as e:
             log_message("ERROR", f"Failed to save snapshots: {e}")

    conn.close()

if __name__ == "__main__":
    main()
