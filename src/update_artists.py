import sqlite3
import time
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add src directory to path to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from update_db import fetch_artist, transform_artist_api, DB_PATH

def migrate_schema(conn):
    """Adds new columns to artists table if they don't exist."""
    print("Checking schema...")
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(artists)")
    columns = [info[1] for info in cursor.fetchall()]
    
    new_cols = {
        'picture_mime': 'TEXT',
        'picture_url_original': 'TEXT',
        'picture_url_thumb': 'TEXT',
        'external_links': 'TEXT'
    }
    
    for col, dtype in new_cols.items():
        if col not in columns:
            print(f"Adding column {col}...")
            try:
                cursor.execute(f"ALTER TABLE artists ADD COLUMN {col} {dtype}")
            except Exception as e:
                print(f"Error adding column {col}: {e}")
    conn.commit()
    print("Schema check complete.")

def update_artist_worker(artist_id):
    """Worker function to fetch and transform artist data."""
    try:
        # Rate limit simulation (simple sleep)
        time.sleep(0.2) 
        data = fetch_artist(artist_id)
        if data:
            return transform_artist_api(data)
    except Exception as e:
        print(f"Error fetching {artist_id}: {e}")
    return None

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Update artists data")
    parser.add_argument("--limit", type=int, help="Limit number of artists to update")
    args = parser.parse_args()

    print("Starting update_artists.py...", flush=True)

    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}", flush=True)
        return

    conn = sqlite3.connect(DB_PATH)
    migrate_schema(conn)
    
    # Get all artist IDs
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM artists")
    artist_ids = [row[0] for row in cursor.fetchall()]
    conn.close() # Close for threads
    
    if not artist_ids:
        print("No artists found in database.", flush=True)
        return

    print(f"Found {len(artist_ids)} artists in database.", flush=True)
    
    # Apply limit if specified
    if args.limit:
        print(f"Limiting update to first {args.limit} artists.", flush=True)
        artist_ids = artist_ids[:args.limit]
    
    print(f"Processing {len(artist_ids)} artists...", flush=True)
    
    # SQL for update
    artist_sql = '''
        INSERT OR REPLACE INTO artists (
            id, artist_type, name_default, name_default_lang,
            name_english, name_japanese, name_romaji,
            picture_mime, picture_url_original, picture_url_thumb, external_links
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    '''

    updates = []
    # Use fewer workers to avoid hitting API rate limits too hard
    # VocaDB is generally lenient but let's be safe.
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(update_artist_worker, aid): aid for aid in artist_ids}
        
        count = 0
        total = len(artist_ids)
        
        conn = sqlite3.connect(DB_PATH)
        
        print("Starting batch update...", flush=True)
        for future in as_completed(futures):
            aid = futures[future]
            try:
                record = future.result()
                if record:
                    updates.append(record)
                    count += 1
                    
                    # Batch write every 50 records
                    if len(updates) >= 50:
                        cursor = conn.cursor()
                        cursor.executemany(artist_sql, updates)
                        conn.commit()
                        updates = []
                        print(f"Progress: {count}/{total}", flush=True)
            except Exception as e:
                print(f"Error processing result for {aid}: {e}", flush=True)
            
        # Final batch
        if updates:
            cursor = conn.cursor()
            cursor.executemany(artist_sql, updates)
            conn.commit()
            print(f"Progress: {count}/{total}", flush=True)
            
        print("Update complete.", flush=True)
        conn.close()

if __name__ == "__main__":
    main()
