from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from .. import schemas
from ..utils import SYNTH_TYPES, RANKING_SYNTH_TYPES, extract_pvs, get_artists_for_songs
from ..models import RankingCache
from typing import List, Optional, Dict
import datetime
import json

router = APIRouter(
    prefix="/rankings",
    tags=["rankings"],
)

def get_gain_ranking(
    db: Session, 
    days_ago: int, 
    limit: int,
    song_type: str,
    vocaloid_only: bool,
    sort_by: str
) -> List[schemas.SongRanking]:
    
    max_date_res = db.execute(text("SELECT MAX(date) FROM daily_snapshots")).fetchone()
    if not max_date_res or not max_date_res[0]:
        return []
    
    current_date_str = max_date_res[0]
    current_date = datetime.datetime.strptime(current_date_str, "%Y-%m-%d")
    target_date = current_date - datetime.timedelta(days=days_ago)
    target_date_str = target_date.strftime("%Y-%m-%d")
    
    # Sort Logic
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
        AND (
            past.song_id IS NOT NULL 
            OR DATE(s.publish_date) >= DATE(:target_date)
        )
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
        params["synth_types"] = list(RANKING_SYNTH_TYPES)

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
        
        artist_string = " · ".join([p['name'] for p in producers]) if producers else "Unknown"
        vocaloid_string = " · ".join([v['name'] for v in vocalists]) if vocalists else "Unknown"
        
        response.append(schemas.SongRanking(
            id=sid, name_english=row[1], name_japanese=row[2], name_romaji=row[3],
            increment_total=row[4], increment_youtube=row[5], increment_niconico=row[6],
            views_youtube=row[7], views_niconico=row[8], total_views=row[9],
            youtube_id=yt_id, niconico_id=nico_id, niconico_thumb_url=nico_thumb,
            song_type=row[11], publish_date=row[12],
            artist_string=artist_string, vocaloid_string=vocaloid_string,
            artists=producers, vocalists=vocalists
        ))
        
    return response

# Common parameters dependency
def common_params(
    limit: int = 10,
    song_type: str = Query('Original,Remaster,Remix', description="Song type filter (comma-separated)"),
    vocaloid_only: bool = Query(True, description="Filter for SynthV/Vocaloid songs only"),
    sort_by: str = Query('increment_total', enum=['increment_total', 'increment_youtube', 'increment_niconico', 'total', 'youtube', 'niconico'], description="Sort by metric")
):
    return {"limit": limit, "song_type": song_type, "vocaloid_only": vocaloid_only, "sort_by": sort_by}


@router.get("/daily", response_model=List[schemas.SongRanking])
def get_daily_ranking(response: Response, params: dict = Depends(common_params), db: Session = Depends(get_db)):
    # Normalize frontend sort aliases to match the keys written by calculate_rankings_cache.py
    sort_key = params['sort_by']
    if sort_key == 'youtube':    sort_key = 'increment_youtube'
    elif sort_key == 'niconico': sort_key = 'increment_niconico'
    elif sort_key == 'total':    sort_key = 'increment_total'

    key_str = json.dumps(('daily', sort_key, 100, params['song_type'], params['vocaloid_only']))
    cached = db.query(RankingCache).filter(RankingCache.cache_key == key_str).first()
    if cached:
        response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=300"
        return json.loads(cached.data)[:params['limit']]
    
    return get_gain_ranking(db, 1, **params)

@router.get("/weekly", response_model=List[schemas.SongRanking])
def get_weekly_ranking(response: Response, params: dict = Depends(common_params), db: Session = Depends(get_db)):
    sort_key = params['sort_by']
    if sort_key == 'youtube':    sort_key = 'increment_youtube'
    elif sort_key == 'niconico': sort_key = 'increment_niconico'
    elif sort_key == 'total':    sort_key = 'increment_total'

    key_str = json.dumps(('weekly', sort_key, 100, params['song_type'], params['vocaloid_only']))
    cached = db.query(RankingCache).filter(RankingCache.cache_key == key_str).first()
    if cached:
        response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=300"
        return json.loads(cached.data)[:params['limit']]
        
    return get_gain_ranking(db, 7, **params)

@router.get("/monthly", response_model=List[schemas.SongRanking])
def get_monthly_ranking(response: Response, params: dict = Depends(common_params), db: Session = Depends(get_db)):
    sort_key = params['sort_by']
    if sort_key == 'youtube':    sort_key = 'increment_youtube'
    elif sort_key == 'niconico': sort_key = 'increment_niconico'
    elif sort_key == 'total':    sort_key = 'increment_total'

    key_str = json.dumps(('monthly', sort_key, 100, params['song_type'], params['vocaloid_only']))
    cached = db.query(RankingCache).filter(RankingCache.cache_key == key_str).first()
    if cached:
        response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=300"
        return json.loads(cached.data)[:params['limit']]
        
    return get_gain_ranking(db, 30, **params)

@router.get("/total", response_model=List[schemas.SongRanking])
def get_total_ranking(
    response: Response,
    limit: int = 10, 
    song_type: str = Query('Original,Remaster,Remix', description="Song type filter (comma-separated)"),
    vocaloid_only: bool = Query(True, description="Filter for SynthV/Vocaloid songs only"),
    sort_by: str = Query('total', enum=['total', 'youtube', 'niconico'], description="Sort by metric"),
    db: Session = Depends(get_db)
):
    key_str = json.dumps(('total', sort_by, 100, song_type, vocaloid_only))
    cached = db.query(RankingCache).filter(RankingCache.cache_key == key_str).first()
    if cached:
        response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=300"
        return json.loads(cached.data)[:limit]
        
    # Sort Logic
    order_clause = "(s.youtube_views + s.niconico_views) DESC"
    if sort_by == 'youtube':
        order_clause = "s.youtube_views DESC"
    elif sort_by == 'niconico':
        order_clause = "s.niconico_views DESC"
    
    query_str = f"""
        SELECT 
            s.id,
            s.name_english, s.name_japanese, s.name_romaji,
            (s.youtube_views + s.niconico_views) as total_views,
            s.youtube_views,
            s.niconico_views,
            s.pv_data,
            s.song_type,
            s.publish_date
        FROM songs s
        WHERE 1=1
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
        params["synth_types"] = list(RANKING_SYNTH_TYPES)

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
        
        artist_string = " · ".join([p['name'] for p in producers]) if producers else "Unknown"
        vocaloid_string = " · ".join([v['name'] for v in vocalists]) if vocalists else "Unknown"
        
        response.append(schemas.SongRanking(
            id=sid,
            name_english=row.name_english,
            name_japanese=row.name_japanese,
            name_romaji=row.name_romaji,
            total_views=row.total_views,
            increment_total=0,
            increment_youtube=0,
            increment_niconico=0,
            views_youtube=row.youtube_views,
            views_niconico=row.niconico_views,
            youtube_id=yt_id,
            niconico_id=nico_id,
            niconico_thumb_url=nico_thumb,
            song_type=row.song_type,
            publish_date=row.publish_date,
            artist_string=artist_string,
            vocaloid_string=vocaloid_string,
            artists=producers,
            vocalists=vocalists
        ))

    return response

@router.get("/custom", response_model=List[schemas.SongRanking])
def get_custom_ranking(
    limit: int = 100,
    song_type: str = Query('Original,Remaster,Remix,Cover', description="Song type filter (comma-separated)"),
    vocaloid_only: bool = Query(True, description="Filter for SynthV/Vocaloid songs only"),
    publish_date_start: Optional[str] = Query(None, description="Start date for publish_date (YYYY-MM-DD)"),
    publish_date_end: Optional[str] = Query(None, description="End date for publish_date (YYYY-MM-DD)"),
    views_min: Optional[int] = Query(None, description="Minimum total views"),
    views_max: Optional[int] = Query(None, description="Maximum total views"),
    artist_ids: Optional[str] = Query(None, description="Comma-separated required artist IDs"),
    sort_by: str = Query('total', description="Sort by: total, youtube, or niconico"),
    db: Session = Depends(get_db)
):
    # No caching for custom queries to save memory, as they are highly variable
    sort_map = {
        'youtube': 's.youtube_views DESC',
        'niconico': 's.niconico_views DESC',
    }
    order_clause = sort_map.get(sort_by, "(s.youtube_views + s.niconico_views) DESC")
    
    query_str = f"""
        SELECT 
            s.id,
            s.name_english, s.name_japanese, s.name_romaji,
            (s.youtube_views + s.niconico_views) as total_views,
            s.youtube_views,
            s.niconico_views,
            s.pv_data,
            s.song_type,
            s.publish_date
        FROM songs s
        WHERE 1=1
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
        params["synth_types"] = list(RANKING_SYNTH_TYPES)

    if publish_date_start:
        query_str += " AND DATE(s.publish_date) >= DATE(:publish_date_start)"
        params["publish_date_start"] = publish_date_start
        
    if publish_date_end:
        query_str += " AND DATE(s.publish_date) <= DATE(:publish_date_end)"
        params["publish_date_end"] = publish_date_end
        
    if views_min is not None:
        query_str += " AND (s.youtube_views + s.niconico_views) >= :views_min"
        params["views_min"] = views_min
        
    if views_max is not None:
        query_str += " AND (s.youtube_views + s.niconico_views) <= :views_max"
        params["views_max"] = views_max
        
    if artist_ids:
        artist_id_list = [int(x.strip()) for x in artist_ids.split(',') if x.strip().isdigit()]
        for idx, a_id in enumerate(artist_id_list):
            query_str += f""" AND EXISTS (
                SELECT 1 FROM song_artists sa{idx}
                WHERE sa{idx}.song_id = s.id AND sa{idx}.artist_id = :req_artist_{idx}
            )"""
            params[f"req_artist_{idx}"] = a_id

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
        
        artist_string = " · ".join([p['name'] for p in producers]) if producers else "Unknown"
        vocaloid_string = " · ".join([v['name'] for v in vocalists]) if vocalists else "Unknown"
        
        response.append(schemas.SongRanking(
            id=sid,
            name_english=row.name_english,
            name_japanese=row.name_japanese,
            name_romaji=row.name_romaji,
            total_views=row.total_views,
            increment_total=0,
            increment_youtube=0,
            increment_niconico=0,
            views_youtube=row.youtube_views,
            views_niconico=row.niconico_views,
            youtube_id=yt_id,
            niconico_id=nico_id,
            niconico_thumb_url=nico_thumb,
            song_type=row.song_type,
            publish_date=row.publish_date,
            artist_string=artist_string,
            vocaloid_string=vocaloid_string,
            artists=producers,
            vocalists=vocalists
        ))

    return response
