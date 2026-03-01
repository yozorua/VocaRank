from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
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
    limit: int = 20,
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
            s.name_english ILIKE :keyword OR 
            s.name_japanese ILIKE :keyword OR 
            s.name_romaji ILIKE :keyword
        )
    """
    
    # Build base params
    params: dict = {"keyword": f"%{query}%", "limit": limit}

    # If query is purely numeric, also match by song ID
    try:
        song_id_val = int(query)
        sql_query = sql_query.replace(
            "WHERE (",
            "WHERE (s.id = :song_id OR "
        )
        params["song_id"] = song_id_val
    except ValueError:
        pass
    
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
        yt_id, nico_id, nico_thumb = extract_pvs(row[7])
        
        am = artists_map.get(sid, {'producers': [], 'vocalists': []})
        
        producers = am.get('producers', [])
        vocalists = am.get('vocalists', [])
        
        artist_string = " · ".join([p['name'] for p in producers]) if producers else "Unknown"
        vocaloid_string = " · ".join([v['name'] for v in vocalists]) if vocalists else "Unknown"
        
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
    
    yt_id, nico_id, nico_thumb = extract_pvs(song.pv_data)

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

    from sqlalchemy import func
    counts = db.query(models.SongVote.vote_type, func.count(models.SongVote.id)).filter_by(song_id=song_id).group_by(models.SongVote.vote_type).all()
    mood_votes = {"happy": 0, "sad": 0, "love": 0, "hype": 0, "chill": 0, "emotional": 0}
    for vt, c in counts:
        if vt in mood_votes:
            mood_votes[vt] = c

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
        niconico_id=nico_id,
        niconico_thumb_url=nico_thumb,
        youtube_history=song.youtube_history,
        niconico_history=song.niconico_history,
        mood_votes=mood_votes
    )

# --- Comments ---

from .auth import get_current_user
from datetime import datetime
import pytz

@router.get("/{song_id}/comments", response_model=List[schemas.SongCommentOut])
def get_song_comments(song_id: int, db: Session = Depends(get_db)):
    """Fetch all comments for a specific song."""
    comments = db.query(models.SongComment).options(
        joinedload(models.SongComment.user)
    ).filter(models.SongComment.song_id == song_id).order_by(models.SongComment.created_at.desc()).all()
    
    return [schemas.SongCommentOut(
        id=c.id,
        song_id=c.song_id,
        user_id=c.user_id,
        content=c.content,
        created_at=c.created_at,
        updated_at=c.updated_at,
        user=schemas.CommentUser(
            id=c.user.id,
            name=c.user.name,
            picture_url=c.user.picture_url
        )
    ) for c in comments]

@router.post("/{song_id}/comments", response_model=schemas.SongCommentOut)
def create_song_comment(
    song_id: int, 
    comment: schemas.SongCommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Post a new comment on a song."""
    # Verify song exists
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    new_comment = models.SongComment(
        song_id=song_id,
        user_id=current_user.id,
        content=comment.content,
        created_at=datetime.now(pytz.utc).isoformat()
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    
    # Reload with user relationship
    db.refresh(current_user)

    return schemas.SongCommentOut(
        id=new_comment.id,
        song_id=new_comment.song_id,
        user_id=new_comment.user_id,
        content=new_comment.content,
        created_at=new_comment.created_at,
        updated_at=new_comment.updated_at,
        user=schemas.CommentUser(
            id=current_user.id,
            name=current_user.name,
            picture_url=current_user.picture_url
        )
    )

@router.delete("/{song_id}/comments/{comment_id}", status_code=204)
def delete_song_comment(
    song_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Delete a user's own comment."""
    comment = db.query(models.SongComment).filter(
        models.SongComment.id == comment_id,
        models.SongComment.song_id == song_id
    ).first()
    
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
        
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
        
    db.delete(comment)
    db.commit()
    return None
