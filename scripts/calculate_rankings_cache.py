import os
import sys
import datetime
import json
from sqlalchemy import text
from sqlalchemy.orm import Session
import pytz

# Allow running from root dir
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api.database import SessionLocal, engine
from api.models import Base, RankingCache
from api.utils import SYNTH_TYPES, extract_pvs, get_artists_for_songs
import api.schemas as schemas
from .core import log_message

def get_gain_ranking(db: Session, days_ago: int, limit: int, song_type: str, vocaloid_only: bool, sort_by: str) -> list:
    max_date_res = db.execute(text("SELECT MAX(date) FROM daily_snapshots")).fetchone()
    if not max_date_res or not max_date_res[0]:
        return []
    
    current_date_str = max_date_res[0]
    current_date = datetime.datetime.strptime(current_date_str, "%Y-%m-%d")
    target_date = current_date - datetime.timedelta(days=days_ago)
    target_date_str = target_date.strftime("%Y-%m-%d")
    
    order_clause = "increment_total DESC"
    if sort_by == 'youtube':
        order_clause = "increment_youtube DESC"
    elif sort_by == 'niconico':
        order_clause = "increment_niconico DESC"
    elif sort_by == 'increment_youtube':
        order_clause = "increment_youtube DESC"
    elif sort_by == 'increment_niconico':
        order_clause = "increment_niconico DESC"
    elif sort_by == 'total':
        order_clause = "total_views DESC"
    
    query_str = f"""
        SELECT 
            s.id,
            s.name_english, s.name_japanese, s.name_romaji,
            CASE 
                WHEN past.song_id IS NULL THEN (today.youtube_views + today.niconico_views) 
                ELSE (today.youtube_views + today.niconico_views) - (past.youtube_views + past.niconico_views) 
            END as increment_total,
            CASE 
                WHEN past.song_id IS NULL THEN today.youtube_views
                ELSE (today.youtube_views - past.youtube_views)
            END as increment_youtube,
            CASE 
                WHEN past.song_id IS NULL THEN today.niconico_views
                ELSE (today.niconico_views - past.niconico_views)
            END as increment_niconico,
            today.youtube_views,
            today.niconico_views,
            (today.youtube_views + today.niconico_views) as total_views,
            s.pv_data,
            s.song_type,
            s.publish_date
        FROM daily_snapshots today
        LEFT JOIN daily_snapshots past ON today.song_id = past.song_id AND past.date = :target_date
        JOIN songs s ON s.id = today.song_id
        WHERE today.date = :current_date
        AND (past.song_id IS NOT NULL OR DATE(s.publish_date) >= DATE(:target_date))
        AND NOT (
            past.song_id IS NOT NULL 
            AND (past.youtube_views + past.niconico_views) = 0
            AND (today.youtube_views + today.niconico_views) > 0
            AND DATE(s.publish_date) < DATE(:target_date)
        )
    """
    
    from sqlalchemy import bindparam
    params = {"current_date": current_date_str, "target_date": target_date_str, "limit": limit, "days_ago": days_ago}
    
    if song_type:
        types = [t.strip() for t in song_type.split(',')]
        if len(types) == 1:
            query_str += " AND s.song_type = :single_song_type"
            params["single_song_type"] = types[0]
        else:
            query_str += " AND s.song_type IN :song_types"
            params["song_types"] = types
        
    if vocaloid_only:
        query_str += """ AND EXISTS (
            SELECT 1 FROM song_artists sa 
            JOIN artists a ON sa.artist_id = a.id 
            WHERE sa.song_id = s.id AND a.artist_type IN :synth_types
        )"""
        params["synth_types"] = list(SYNTH_TYPES)

    query_str += f" ORDER BY {order_clause} LIMIT :limit"
    sql = text(query_str)
    
    if "song_types" in params:
        sql = sql.bindparams(bindparam('song_types', expanding=True))
    if "synth_types" in params:
        sql = sql.bindparams(bindparam('synth_types', expanding=True))
        
    results = db.execute(sql, params).fetchall()
    
    song_ids = [row[0] for row in results]
    artists_map = get_artists_for_songs(db, song_ids)
    
    response = []
    for row in results:
        sid = row[0]
        yt_id, nico_id, nico_thumb = extract_pvs(row[10])
        am = artists_map.get(sid, {'producers': [], 'vocalists': []})
        producers = am.get('producers', [])
        vocalists = am.get('vocalists', [])
        
        artist_string = ", ".join([p['name'] for p in producers]) if producers else "Unknown"
        vocaloid_string = ", ".join([v['name'] for v in vocalists]) if vocalists else "Unknown"
        
        response.append({
            "id": sid, "name_english": row[1], "name_japanese": row[2], "name_romaji": row[3],
            "increment_total": row[4], "increment_youtube": row[5], "increment_niconico": row[6],
            "views_youtube": row[7], "views_niconico": row[8], "total_views": row[9],
            "youtube_id": yt_id, "niconico_id": nico_id, "niconico_thumb_url": nico_thumb,
            "song_type": row[11], "publish_date": row[12],
            "artist_string": artist_string, "vocaloid_string": vocaloid_string,
            "artists": producers, "vocalists": vocalists
        })
        
    return response

def get_total_ranking(db: Session, limit: int, song_type: str, vocaloid_only: bool, sort_by: str) -> list:
    order_clause = "(s.youtube_views + s.niconico_views) DESC"
    if sort_by == 'youtube':
        order_clause = "s.youtube_views DESC"
    elif sort_by == 'niconico':
        order_clause = "s.niconico_views DESC"
    
    query_str = f"""
        SELECT 
            s.id, s.name_english, s.name_japanese, s.name_romaji,
            (s.youtube_views + s.niconico_views) as total_views,
            s.youtube_views, s.niconico_views, s.pv_data, s.song_type, s.publish_date
        FROM songs s WHERE 1=1
    """
    
    from sqlalchemy import bindparam
    params = {"limit": limit}
    
    if song_type:
        types = [t.strip() for t in song_type.split(',')]
        if len(types) == 1:
            query_str += " AND s.song_type = :single_song_type"
            params["single_song_type"] = types[0]
        else:
            query_str += " AND s.song_type IN :song_types"
            params["song_types"] = types
        
    if vocaloid_only:
        query_str += """ AND EXISTS (
            SELECT 1 FROM song_artists sa 
            JOIN artists a ON sa.artist_id = a.id 
            WHERE sa.song_id = s.id AND a.artist_type IN :synth_types
        )"""
        params["synth_types"] = list(SYNTH_TYPES)

    query_str += f" ORDER BY {order_clause} LIMIT :limit"
    sql = text(query_str)
    
    if "song_types" in params:
        sql = sql.bindparams(bindparam('song_types', expanding=True))
    if "synth_types" in params:
        sql = sql.bindparams(bindparam('synth_types', expanding=True))
        
    result = db.execute(sql, params).fetchall()
    
    song_ids = [row.id for row in result]
    artists_map = get_artists_for_songs(db, song_ids)
    
    response = []
    for row in result:
        sid = row.id
        yt_id, nico_id, nico_thumb = extract_pvs(row.pv_data)
        am = artists_map.get(sid, {'producers': [], 'vocalists': []})
        producers = am.get('producers', [])
        vocalists = am.get('vocalists', [])
        
        artist_string = ", ".join([p['name'] for p in producers]) if producers else "Unknown"
        vocaloid_string = ", ".join([v['name'] for v in vocalists]) if vocalists else "Unknown"
        
        response.append({
            "id": sid, "name_english": row.name_english, "name_japanese": row.name_japanese, "name_romaji": row.name_romaji,
            "total_views": row.total_views, "increment_total": 0, "increment_youtube": 0, "increment_niconico": 0,
            "views_youtube": row.youtube_views, "views_niconico": row.niconico_views,
            "youtube_id": yt_id, "niconico_id": nico_id, "niconico_thumb_url": nico_thumb,
            "song_type": row.song_type, "publish_date": row.publish_date,
            "artist_string": artist_string, "vocaloid_string": vocaloid_string,
            "artists": producers, "vocalists": vocalists
        })

    return response

def save_cache(db: Session, key_tuple: tuple, data: list):
    key_str = json.dumps(key_tuple)
    data_str = json.dumps(data)
    now_str = datetime.datetime.now(pytz.utc).isoformat()
    
    existing = db.query(RankingCache).filter(RankingCache.cache_key == key_str).first()
    if existing:
        existing.data = data_str
        existing.updated_at = now_str
    else:
        new_cache = RankingCache(cache_key=key_str, data=data_str, updated_at=now_str)
        db.add(new_cache)
    db.commit()

def calculate_all():
    log_message("INFO", "Creating tables if missing...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    log_message("INFO", "Starting background ranking aggregation...")
    
    try:
        limit = 100
        song_type = "Original,Remaster,Remix"
        vocaloid_only = True
        
        params = {"limit": limit, "song_type": song_type, "vocaloid_only": vocaloid_only}
        
        for sort_opt in ["increment_total", "increment_youtube", "increment_niconico"]:
            log_message("INFO", f"Aggregating Daily [{sort_opt}]")
            d_res = get_gain_ranking(db, 1, sort_by=sort_opt, **params)
            save_cache(db, ('daily', sort_opt, limit, song_type, vocaloid_only), d_res)
            
            log_message("INFO", f"Aggregating Weekly [{sort_opt}]")
            w_res = get_gain_ranking(db, 7, sort_by=sort_opt, **params)
            save_cache(db, ('weekly', sort_opt, limit, song_type, vocaloid_only), w_res)
            
            log_message("INFO", f"Aggregating Monthly [{sort_opt}]")
            m_res = get_gain_ranking(db, 30, sort_by=sort_opt, **params)
            save_cache(db, ('monthly', sort_opt, limit, song_type, vocaloid_only), m_res)
            
        for t_sort_opt in ["total", "youtube", "niconico"]:
            log_message("INFO", f"Aggregating All-Time Total [{t_sort_opt}]")
            t_res = get_total_ranking(db, limit=limit, song_type=song_type, vocaloid_only=vocaloid_only, sort_by=t_sort_opt)
            save_cache(db, ('total', t_sort_opt, limit, song_type, vocaloid_only), t_res)
            
        log_message("SUCCESS", "Aggregation complete! Results seamlessly committed to Database Cache.")
    except Exception as e:
        log_message("ERROR", f"Critical error during generation: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    calculate_all()
