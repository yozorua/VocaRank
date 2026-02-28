from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..cache import song_dates_cache, cache_lock
from typing import List, Optional

router = APIRouter(
    prefix="/artists",
    tags=["artists"],
)

@router.get("/search", response_model=List[schemas.Artist])
def search_artists(
    query: str = Query(..., min_length=1, description="Search keyword for artist name"),
    limit: int = 20,
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
            a.name_default ILIKE :keyword OR 
            a.name_english ILIKE :keyword OR 
            a.name_japanese ILIKE :keyword OR
            a.name_romaji ILIKE :keyword
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

@router.get("/graph", response_model=dict)
def get_artist_graph(db: Session = Depends(get_db)):
    """
    Returns a network graph of artists based on collaborations.
    Reads stringified JSON directly from the offline calculate_network_graph.py script.
    """
    from sqlalchemy import text
    import json
    
    # Try TTLCache first (in-memory)
    from ..cache import graph_cache, cache_lock
    with cache_lock:
        if "network" in graph_cache:
            return graph_cache["network"]
            
    # Try Database Persistent Cache (SQLite)
    sql = "SELECT json_data FROM system_cache WHERE key_name = 'network_graph'"
    row = db.execute(text(sql)).fetchone()
    
    if not row or not row[0]:
        # If the crontab script hasn't run yet, return an empty graph
        return {"nodes": [], "links": []}
        
    try:
        # Parse the JSON string from sqlite back into a dict for FastAPI's response model
        result = json.loads(row[0]) 
    except json.JSONDecodeError:
        return {"nodes": [], "links": []}
    
    # Store it back into the TTLCache for fast subsequent access
    with cache_lock:
        graph_cache["network"] = result
        
    return result

@router.get("/graph/vocalists", response_model=dict)
def get_vocalist_graph(db: Session = Depends(get_db)):
    """
    Returns a network graph of explicit vocalists collaborations.
    Reads stringified JSON directly from the offline calculate_network_graph.py script.
    """
    from sqlalchemy import text
    import json
    
    from ..cache import graph_cache, cache_lock
    with cache_lock:
        if "vocalist_network" in graph_cache:
            return graph_cache["vocalist_network"]
            
    # Try Database Persistent Cache (SQLite)
    sql = "SELECT json_data FROM system_cache WHERE key_name = 'vocalist_network_graph'"
    row = db.execute(text(sql)).fetchone()
    
    if not row or not row[0]:
        return {"nodes": [], "links": []}
        
    try:
        result = json.loads(row[0]) 
    except json.JSONDecodeError:
        return {"nodes": [], "links": []}
    
    with cache_lock:
        graph_cache["vocalist_network"] = result
        
    return result


@router.get("/{artist_id}", response_model=schemas.Artist)
def get_artist(artist_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information for a specific artist.
    """
    artist = db.query(models.Artist).filter(models.Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")

    # Calculate active range
    from sqlalchemy import func
    dates = db.query(
        func.min(models.Song.publish_date),
        func.max(models.Song.publish_date)
    ).join(models.song_artists, models.Song.id == models.song_artists.c.song_id)\
     .filter(models.song_artists.c.artist_id == artist_id).first()

    artist.first_song_date = dates[0]
    artist.last_song_date = dates[1]

    return artist

@router.get("/{artist_id}/songs", response_model=List[schemas.SongRanking])
def get_artist_songs(
    artist_id: int,
    limit: Optional[int] = None,
    sort_by: str = Query('total_views', enum=['total_views', 'publish_date'], description="Sort by metric"),
    db: Session = Depends(get_db)
):
    """
    Get songs associated with a specific artist.
    """
    from sqlalchemy import text
    from ..utils import extract_pvs, get_artists_for_songs
    
    order_clause = "total_views DESC"
    if sort_by == 'publish_date':
        order_clause = "s.publish_date DESC"

    # 1. Fetch songs linked to this artist
    sql_query = f"""
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
        ORDER BY {order_clause}
    """
    if limit is not None:
        sql_query += " LIMIT :limit"
        results = db.execute(text(sql_query), {"artist_id": artist_id, "limit": limit}).fetchall()
    else:
        results = db.execute(text(sql_query), {"artist_id": artist_id}).fetchall()
    
    if not results:
        return []

    # 2. Enrich with all artists for these songs (to show "feat. X" etc.)
    song_ids = [row[0] for row in results]
    artists_map = get_artists_for_songs(db, song_ids)
    
    response = []
    for row in results:
        sid = row[0]
        yt_id, nico_id, nico_thumb = extract_pvs(row[7])
        
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
            increment_total=0,
            increment_youtube=0,
            increment_niconico=0,
            views_youtube=row[5],
            views_niconico=row[6],
            youtube_id=yt_id,
            niconico_id=nico_id,
            niconico_thumb_url=nico_thumb,
            song_type=row[8],
            publish_date=row[9],
            artist_string=artist_string,
            vocaloid_string=vocaloid_string,
            artists=producers,
            vocalists=vocalists
        ))
        
    return response

@router.get("/{artist_id}/song-dates", response_model=List[dict])
def get_artist_song_dates(
    artist_id: int,
    db: Session = Depends(get_db)
):
    """
    Returns song counts grouped by year for the publish-activity histogram.
    Results are cached in-process for 1 hour (TTLCache) so mega-artists
    like Miku only pay the ~1s SQL cost once per hour.
    """
    with cache_lock:
        if artist_id in song_dates_cache:
            return song_dates_cache[artist_id]

    from sqlalchemy import text
    sql = """
        SELECT CAST(SUBSTR(s.publish_date, 1, 4) AS INTEGER) AS year,
               COUNT(*) AS count
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        WHERE sa.artist_id = :artist_id
          AND s.publish_date IS NOT NULL
          AND LENGTH(s.publish_date) >= 4
        GROUP BY year
        ORDER BY year ASC
    """
    rows = db.execute(text(sql), {"artist_id": artist_id}).fetchall()
    result = [{"year": r[0], "count": r[1]} for r in rows]

    with cache_lock:
        song_dates_cache[artist_id] = result

    return result
