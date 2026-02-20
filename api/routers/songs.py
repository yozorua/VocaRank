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

    from sqlalchemy import bindparam

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
        sql_query += """ AND EXISTS (
            SELECT 1 FROM song_artists sa 
            JOIN artists a ON sa.artist_id = a.id 
            WHERE sa.song_id = s.id AND a.artist_type IN :synth_types
        )"""
        params["synth_types"] = list(SYNTH_TYPES)
        
    if sort_by == 'total_views':
        sql_query += " ORDER BY total_views DESC"
    elif sort_by == 'publish_date':
        sql_query += " ORDER BY s.publish_date DESC"
            
    sql_query += " LIMIT :limit"
    
    sql = text(sql_query)
    
    if "synth_types" in params:
        sql = sql.bindparams(bindparam('synth_types', expanding=True))
        
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

@router.get("/{song_id}", response_model=schemas.SongDetail)
def get_song(song_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information for a specific song.
    """
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
        
    # Enrich with artist data
    artist_map = get_artists_for_songs(db, [song_id])
    am = artist_map.get(song_id, {'producers': [], 'vocalists': []})
    
    producers = am.get('producers', [])
    vocalists = am.get('vocalists', [])
    
    artist_string = ", ".join([p['name'] for p in producers]) if producers else "Unknown"
    vocaloid_string = ", ".join([v['name'] for v in vocalists]) if vocalists else "Unknown"
    
    yt_id, nico_id = extract_pvs(song.pv_data)

    original_song_data = None
    if song.original_song_id:
        original = db.query(models.Song).filter(models.Song.id == song.original_song_id).first()
        if original:
            original_song_data = schemas.SongList(
                id=original.id,
                name_english=original.name_english,
                name_japanese=original.name_japanese,
                name_romaji=original.name_romaji,
                publish_date=original.publish_date,
                song_type=original.song_type,
                youtube_views=original.youtube_views,
                niconico_views=original.niconico_views
            )

    return schemas.SongDetail(
        id=song.id,
        name_english=song.name_english,
        name_japanese=song.name_japanese,
        name_romaji=song.name_romaji,
        publish_date=song.publish_date,
        song_type=song.song_type,
        length_seconds=song.length_seconds,
        original_song_id=song.original_song_id,
        original_song=original_song_data,
        views_youtube=song.youtube_views,
        views_niconico=song.niconico_views,
        total_views=song.youtube_views + song.niconico_views,
        artist_string=artist_string,
        vocaloid_string=vocaloid_string,
        artists=producers,
        vocalists=vocalists,
        youtube_id=yt_id,
        niconico_id=nico_id
    )
