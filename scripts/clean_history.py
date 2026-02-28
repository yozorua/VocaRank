import psycopg2
import json
import datetime

from core import get_db_connection, log_message

def clean_history():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cutoff = datetime.datetime(2026, 2, 17, 0, 0, tzinfo=datetime.timezone.utc)
    
    log_message("INFO", f"Deleting daily_snapshots on or before 2026-02-16...")
    cursor.execute("DELETE FROM daily_snapshots WHERE date <= '2026-02-16'")
    deleted_snapshots = cursor.rowcount
    log_message("SUCCESS", f"Deleted {deleted_snapshots} daily_snapshots.")
    
    log_message("INFO", f"Cleaning JSON history in songs table before {cutoff.isoformat()}...")
    cursor.execute("SELECT id, youtube_history, niconico_history FROM songs")
    rows = cursor.fetchall()
    
    updated_songs = 0
    total_points_deleted = 0
    
    for row in rows:
        song_id = row[0]
        yt_hist_str = row[1]
        nico_hist_str = row[2]
        
        changed = False
        
        try:
            yt_hist = json.loads(yt_hist_str) if yt_hist_str else []
            nico_hist = json.loads(nico_hist_str) if nico_hist_str else []
            
            new_yt_hist = []
            for p in yt_hist:
                d = datetime.datetime.fromisoformat(p['date'])
                if d >= cutoff:
                    new_yt_hist.append(p)
                else:
                    total_points_deleted += 1
                    
            if len(yt_hist) != len(new_yt_hist):
                changed = True
                
            new_nico_hist = []
            for p in nico_hist:
                d = datetime.datetime.fromisoformat(p['date'])
                if d >= cutoff:
                    new_nico_hist.append(p)
                else:
                    total_points_deleted += 1
                    
            if len(nico_hist) != len(new_nico_hist):
                changed = True
                
            if changed:
                cursor.execute(
                    "UPDATE songs SET youtube_history=%s, niconico_history=%s WHERE id=%s", 
                    (json.dumps(new_yt_hist), json.dumps(new_nico_hist), song_id)
                )
                updated_songs += 1
                
        except Exception as e:
            log_message("ERROR", f"Failed to parse or clean song {song_id}: {e}")
            
    conn.commit()
    conn.close()
    
    log_message("SUCCESS", f"Cleaned {updated_songs} songs, deleted {total_points_deleted} historical datapoints.")

if __name__ == '__main__':
    clean_history()
