from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from .. import models, schemas
from ..utils import extract_pvs, get_artists_for_songs
from typing import List, Optional

router = APIRouter(
    prefix="/songs",
    tags=["songs"],
)

@router.get("/search", response_model=List[schemas.SongRanking])
def search_songs(
    query: str = Query(..., min_length=1, description="Search keyword for song title"),
    limit: int = 10,
    song_type: Optional[str] = Query(None, description="Filter by song type (e.g. Original)"),
    vocaloid_only: bool = Query(True, description="Filter for SynthV/Vocaloid songs only"),
    sort_by: str = Query('total_views', enum=['total_views', 'publish_date'], description="Sort by metric"),
    db: Session = Depends(get_db)
):
    """
    Search songs by name (English, Japanese, or Romaji).
    Returns rich metadata similar to rankings.
    """
    
    from ..utils import SYNTH_TYPES

    # Base Query
    sql_query = """
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
        WHERE (
            s.name_english LIKE :keyword OR 
            s.name_japanese LIKE :keyword OR 
            s.name_romaji LIKE :keyword
        )
    """
    
    params = {"keyword": f"%{query}%", "limit": limit}
    
    if song_type:
        sql_query += " AND s.song_type = :song_type"
        params["song_type"] = song_type

    if vocaloid_only:
        synth_list = "', '".join(SYNTH_TYPES)
        sql_query += f""" AND EXISTS (
            SELECT 1 FROM song_artists sa 
            JOIN artists a ON sa.artist_id = a.id 
            WHERE sa.song_id = s.id AND a.artist_type IN ('{synth_list}')
        )"""
        
    if sort_by == 'total_views':
        sql_query += " ORDER BY total_views DESC"
    elif sort_by == 'publish_date':
            sql_query += " ORDER BY s.publish_date DESC"
            
    sql_query += " LIMIT :limit"
    
    results = db.execute(text(sql_query), params).fetchall()
    
    song_ids = [row[0] for row in results]
    artists_map = get_artists_for_songs(db, song_ids)
    
    response = []
    for row in results:
        sid = row[0]
        yt_id, nico_id = extract_pvs(row[7])
        
        am = artists_map.get(sid, {'producers': [], 'vocalists': []})
        artist_string = ", ".join(am['producers']) if am['producers'] else "Unknown"
        vocaloid_string = ", ".join(am['vocalists']) if am['vocalists'] else "Unknown"
        
        response.append(schemas.SongRanking(
            id=sid,
            name_english=row[1],
            name_japanese=row[2],
            name_romaji=row[3],
            total_views=row[4],
            view_increment=0, 
            views_youtube=row[5],
            views_niconico=row[6],
            youtube_id=yt_id,
            niconico_id=nico_id,
            song_type=row[8],
            publish_date=row[9],
            artist_string=artist_string,
            vocaloid_string=vocaloid_string
        ))
        
    return response

@router.get("/{song_id}", response_model=schemas.SongDetail)
def get_song(song_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information for a specific song.
    """
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
        
    # Enrich with artist data
    artists_map = get_artists_for_songs(db, [song.id])
    am = artists_map.get(song.id, {'producers': [], 'vocalists': []})
    artist_string = ", ".join(am['producers']) if am['producers'] else "Unknown"
    vocaloid_string = ", ".join(am['vocalists']) if am['vocalists'] else "Unknown"
    
    yt_id, nico_id = extract_pvs(song.pv_data)
    
    # Return as dict to match schema with computed fields
    return {
        **song.__dict__,
        "total_views": song.youtube_views + song.niconico_views,
        "views_youtube": song.youtube_views,
        "views_niconico": song.niconico_views,
        "artist_string": artist_string,
        "vocaloid_string": vocaloid_string,
        "youtube_id": yt_id,
        "niconico_id": nico_id
    }
