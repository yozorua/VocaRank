import sqlite3
import concurrent.futures
import requests
from core import get_db_connection, log_message

API_BASE = "https://vocadb.net/api"
USER_AGENT = "VocaRank/1.0"

def check_and_delete_song(song_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        url = f"{API_BASE}/songs/{song_id}"
        headers = {'User-Agent': USER_AGENT, 'Accept': 'application/json'}
        resp = requests.get(url, headers=headers, timeout=10)
        
        if resp.status_code == 404:
            # Hard deleted from VocaDB entirely
            cursor.execute("DELETE FROM song_artists WHERE song_id=?", (song_id,))
            cursor.execute("DELETE FROM song_tags WHERE song_id=?", (song_id,))
            cursor.execute("DELETE FROM daily_snapshots WHERE song_id=?", (song_id,))
            cursor.execute("DELETE FROM songs WHERE id=?", (song_id,))
            conn.commit()
            log_message("INFO", f"Deleted 404 Not Found song ID {song_id}")
            return True
            
        if resp.status_code == 200:
            data = resp.json()
            if data.get('deleted') or data.get('mergedTo'):
                cursor.execute("DELETE FROM song_artists WHERE song_id=?", (song_id,))
                cursor.execute("DELETE FROM song_tags WHERE song_id=?", (song_id,))
                cursor.execute("DELETE FROM daily_snapshots WHERE song_id=?", (song_id,))
                cursor.execute("DELETE FROM songs WHERE id=?", (song_id,))
                conn.commit()
                log_message("INFO", f"Deleted merged/deleted song ID {song_id}")
                return True
                
        return False
    except Exception as e:
        log_message("ERROR", f"Error checking ID {song_id}: {e}")
        return False
    finally:
        conn.close()

def run_cleanup():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM songs ORDER BY id DESC")
    target_ids = [row[0] for row in cursor.fetchall()]
    conn.close()
    
    if not target_ids:
        log_message("INFO", "No songs found in database.")
        return
        
    log_message("INFO", f"Scanning {len(target_ids)} songs for merged/deleted status...")
    
    deleted_count = 0
    processed = 0
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(check_and_delete_song, song_id) for song_id in target_ids]
        for future in concurrent.futures.as_completed(futures):
            processed += 1
            if future.result():
                deleted_count += 1
            if processed % 500 == 0:
                log_message("INFO", f"Scanned {processed}/{len(target_ids)} songs... (Deleted {deleted_count} so far)")
                
    log_message("SUCCESS", f"Cleanup complete. Deleted a total of {deleted_count} invalid songs.")

if __name__ == "__main__":
    run_cleanup()
