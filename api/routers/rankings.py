from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from .. import schemas
from ..utils import SYNTH_TYPES, extract_pvs, get_artists_for_songs
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
        order_clause = "(today.youtube_views - past.youtube_views) DESC"
    elif sort_by == 'niconico':
        order_clause = "(today.niconico_views - past.niconico_views) DESC"
    elif sort_by == 'increment_youtube':
        order_clause = "(today.youtube_views - past.youtube_views) DESC"
    elif sort_by == 'increment_niconico':
        order_clause = "(today.niconico_views - past.niconico_views) DESC"
    elif sort_by == 'total':
        order_clause = "(today.youtube_views + today.niconico_views) DESC"
    
    query_str = f"""
        SELECT 
            s.id,
            s.name_english, s.name_japanese, s.name_romaji,
            (today.youtube_views + today.niconico_views) - (past.youtube_views + past.niconico_views) as increment_total,
            (today.youtube_views - past.youtube_views) as increment_youtube,
            (today.niconico_views - past.niconico_views) as increment_niconico,
            today.youtube_views,
            today.niconico_views,
            (today.youtube_views + today.niconico_views) as total_views,
            s.pv_data,
            s.song_type,
            s.publish_date
        FROM daily_snapshots today
        JOIN daily_snapshots past ON today.song_id = past.song_id 
        JOIN songs s ON s.id = today.song_id
        WHERE today.date = :current_date AND past.date = :target_date
    """
    
    params = {"current_date": current_date_str, "target_date": target_date_str, "limit": limit}
    
    if song_type:
        types = [t.strip() for t in song_type.split(',')]
        if len(types) == 1:
            query_str += " AND s.song_type = :song_type"
            params["song_type"] = types[0]
        else:
            # Manual IN clause construction for safety across drivers
            clean_types = [t.replace("'", "''") for t in types]
            type_str = "', '".join(clean_types)
            query_str += f" AND s.song_type IN ('{type_str}')"
        
    if vocaloid_only:
        synth_list = "', '".join(SYNTH_TYPES)
        query_str += f""" AND EXISTS (
            SELECT 1 FROM song_artists sa 
            JOIN artists a ON sa.artist_id = a.id 
            WHERE sa.song_id = s.id AND a.artist_type IN ('{synth_list}')
        )"""

    query_str += f" ORDER BY {order_clause} LIMIT :limit"
    
    sql = text(query_str)
    results = db.execute(sql, params).fetchall()
    
    # Process
    song_ids = [row[0] for row in results]
    artists_map = get_artists_for_songs(db, song_ids)
    
    response = []
    for row in results:
        sid = row[0]
        yt_id, nico_id = extract_pvs(row[10])
        
        am = artists_map.get(sid, {'producers': [], 'vocalists': []})
        
        producers = am.get('producers', [])
        vocalists = am.get('vocalists', [])
        
        artist_string = ", ".join([p['name'] for p in producers]) if producers else "Unknown"
        vocaloid_string = ", ".join([v['name'] for v in vocalists]) if vocalists else "Unknown"
        
        response.append(schemas.SongRanking(
            id=sid,
            name_english=row[1],
            name_japanese=row[2],
            name_romaji=row[3],
            increment_total=row[4],
            increment_youtube=row[5],
            increment_niconico=row[6],
            views_youtube=row[7],
            views_niconico=row[8],
            total_views=row[9],
            youtube_id=yt_id,
            niconico_id=nico_id,
            song_type=row[11],
            publish_date=row[12],
            artist_string=artist_string,
            vocaloid_string=vocaloid_string,
            artists=producers,
            vocalists=vocalists
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
def get_daily_ranking(params: dict = Depends(common_params), db: Session = Depends(get_db)):
    return get_gain_ranking(db, 1, **params)

@router.get("/weekly", response_model=List[schemas.SongRanking])
def get_weekly_ranking(params: dict = Depends(common_params), db: Session = Depends(get_db)):
    return get_gain_ranking(db, 7, **params)

@router.get("/monthly", response_model=List[schemas.SongRanking])
def get_monthly_ranking(params: dict = Depends(common_params), db: Session = Depends(get_db)):
    return get_gain_ranking(db, 30, **params)

@router.get("/total", response_model=List[schemas.SongRanking])
def get_total_ranking(
    limit: int = 10, 
    song_type: str = Query('Original,Remaster,Remix', description="Song type filter (comma-separated)"),
    vocaloid_only: bool = Query(True, description="Filter for SynthV/Vocaloid songs only"),
    sort_by: str = Query('total', enum=['total', 'youtube', 'niconico'], description="Sort by metric"),
    db: Session = Depends(get_db)
):
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
    
    params = {"limit": limit}
    
    if song_type:
        types = [t.strip() for t in song_type.split(',')]
        if len(types) == 1:
            query_str += " AND s.song_type = :song_type"
            params["song_type"] = types[0]
        else:
            # Manual IN clause construction for safety across drivers
            clean_types = [t.replace("'", "''") for t in types]
            type_str = "', '".join(clean_types)
            query_str += f" AND s.song_type IN ('{type_str}')"
        
    if vocaloid_only:
        synth_list = "', '".join(SYNTH_TYPES)
        query_str += f""" AND EXISTS (
            SELECT 1 FROM song_artists sa 
            JOIN artists a ON sa.artist_id = a.id 
            WHERE sa.song_id = s.id AND a.artist_type IN ('{synth_list}')
        )"""

    query_str += f" ORDER BY {order_clause} LIMIT :limit"
    
    sql = text(query_str)
    results = db.execute(sql, params).fetchall()
    
    song_ids = [row[0] for row in results]
    artists_map = get_artists_for_songs(db, song_ids)
    
    response = []
    for row in results:
        sid = row[0]
        yt_id, nico_id = extract_pvs(row[7])
        
        am = artists_map.get(sid, {'producers': [], 'vocalists': []})
        
        producers = am.get('producers', [])
        vocalists = am.get('vocalists', [])
        
        artist_string = ", ".join([p['name'] for p in producers]) if producers else "Unknown"
        vocaloid_string = ", ".join([v['name'] for v in vocalists]) if vocalists else "Unknown"
        
        response.append(schemas.SongRanking(
            id=sid,
            name_english=row[1],
            name_japanese=row[2],
            name_romaji=row[3],
            total_views=row[4],
            increment_total=0,
            increment_youtube=0,
            increment_niconico=0,
            views_youtube=row[5],
            views_niconico=row[6],
            youtube_id=yt_id,
            niconico_id=nico_id,
            song_type=row[8],
            publish_date=row[9],
            artist_string=artist_string,
            vocaloid_string=vocaloid_string,
            artists=producers,
            vocalists=vocalists
        ))
        
    return response
