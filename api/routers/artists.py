from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from typing import List, Optional

router = APIRouter(
    prefix="/artists",
    tags=["artists"],
)

@router.get("/search", response_model=List[schemas.Artist])
def search_artists(
    query: str = Query(..., min_length=1, description="Search keyword for artist name"),
    limit: int = 10,
    artist_type: Optional[str] = Query(None, description="Filter by artist type (e.g. Producer, Vocaloid)"),
    db: Session = Depends(get_db)
):
    """
    Search artists by name.
    """
    keyword = f"%{query}%"
    
    # Sort by total views of their songs (popularity)
    sql = """
        SELECT a.id, a.artist_type, a.name_default, a.name_default_lang, 
               a.name_english, a.name_japanese, a.name_romaji,
               a.picture_mime, a.picture_url_original, a.picture_url_thumb, a.external_links,
               COALESCE(SUM(s.youtube_views + s.niconico_views), 0) as total_views
        FROM artists a
        LEFT JOIN song_artists sa ON a.id = sa.artist_id
        LEFT JOIN songs s ON sa.song_id = s.id
        WHERE (
            a.name_default LIKE :keyword OR 
            a.name_english LIKE :keyword OR 
            a.name_japanese LIKE :keyword
        )
    """
    
    params = {"keyword": keyword, "limit": limit}
    
    if artist_type:
        sql += " AND a.artist_type = :artist_type"
        params["artist_type"] = artist_type
        
    sql += """
        GROUP BY a.id
        ORDER BY total_views DESC
        LIMIT :limit
    """
    
    from sqlalchemy import text
    results = db.execute(text(sql), params).fetchall()
    
    # Map back to Artist schema
    artists = []
    for row in results:
        artists.append(models.Artist(
            id=row[0],
            artist_type=row[1],
            name_default=row[2],
            # name_default_lang=row[3], # Schema doesn't use this yet but model does
            name_english=row[4],
            name_japanese=row[5],
            name_romaji=row[6],
            picture_mime=row[7],
            picture_url_original=row[8],
            picture_url_thumb=row[9],
            external_links=row[10]
        ))
        
    return artists

@router.get("/{artist_id}", response_model=schemas.Artist)
def get_artist(artist_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information for a specific artist.
    """
    artist = db.query(models.Artist).filter(models.Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")
    return artist

@router.get("/{artist_id}/songs", response_model=List[schemas.SongRanking])
def get_artist_songs(
    artist_id: int, 
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    Get songs associated with a specific artist.
    """
    from sqlalchemy import text
    from ..utils import extract_pvs, get_artists_for_songs
    
    # 1. Fetch songs linked to this artist
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
        JOIN song_artists sa ON s.id = sa.song_id
        WHERE sa.artist_id = :artist_id
        ORDER BY total_views DESC
        LIMIT :limit
    """
    
    results = db.execute(text(sql_query), {"artist_id": artist_id, "limit": limit}).fetchall()
    
    if not results:
        return []

    # 2. Enrich with all artists for these songs (to show "feat. X" etc.)
    song_ids = [row[0] for row in results]
    artists_map = get_artists_for_songs(db, song_ids)
    
    response = []
    for row in results:
        sid = row[0]
        yt_id, nico_id = extract_pvs(row[7])
        
        am = artists_map.get(sid, {'producers': [], 'vocalists': []})
        
        producers = am['producers']
        vocalists = am['vocalists']
        
        artist_string = ", ".join([p['name'] for p in producers]) if producers else "Unknown"
        vocaloid_string = ", ".join([v['name'] for v in vocalists]) if vocalists else "Unknown"
        
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
            vocaloid_string=vocaloid_string,
            artists=producers,
            vocalists=vocalists
        ))
        
    return response
