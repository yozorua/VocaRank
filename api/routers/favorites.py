from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from ..utils import extract_pvs, get_artists_for_songs
from .auth import get_current_user
from datetime import datetime

router = APIRouter(
    prefix="/favorites",
    tags=["favorites"],
)

@router.post("/song/{song_id}")
def favorite_song(song_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
        
    fav = db.query(models.UserFavoriteSong).filter_by(user_id=current_user.id, song_id=song_id).first()
    if not fav:
        new_fav = models.UserFavoriteSong(user_id=current_user.id, song_id=song_id, created_at=datetime.utcnow().isoformat())
        db.add(new_fav)
        db.commit()
    return {"success": True, "is_favorite": True}

@router.delete("/song/{song_id}")
def unfavorite_song(song_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    fav = db.query(models.UserFavoriteSong).filter_by(user_id=current_user.id, song_id=song_id).first()
    if fav:
        db.delete(fav)
        db.commit()
    return {"success": True, "is_favorite": False}

@router.get("/song/{song_id}/check")
def check_favorite_song(song_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    fav = db.query(models.UserFavoriteSong).filter_by(user_id=current_user.id, song_id=song_id).first()
    return {"is_favorite": fav is not None}

@router.post("/artist/{artist_id}")
def favorite_artist(artist_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    artist = db.query(models.Artist).filter(models.Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")
        
    fav = db.query(models.UserFavoriteArtist).filter_by(user_id=current_user.id, artist_id=artist_id).first()
    if not fav:
        new_fav = models.UserFavoriteArtist(user_id=current_user.id, artist_id=artist_id, created_at=datetime.utcnow().isoformat())
        db.add(new_fav)
        db.commit()
    return {"success": True, "is_favorite": True}

@router.delete("/artist/{artist_id}")
def unfavorite_artist(artist_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    fav = db.query(models.UserFavoriteArtist).filter_by(user_id=current_user.id, artist_id=artist_id).first()
    if fav:
        db.delete(fav)
        db.commit()
    return {"success": True, "is_favorite": False}

@router.get("/artist/{artist_id}/check")
def check_favorite_artist(artist_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    fav = db.query(models.UserFavoriteArtist).filter_by(user_id=current_user.id, artist_id=artist_id).first()
    return {"is_favorite": fav is not None}

@router.get("/songs", response_model=list[schemas.SongRanking])
def get_user_favorite_songs(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Retrieve all songs favorited by the current user, sorted by newest first."""
    favorites = (
        db.query(models.Song)
        .join(models.UserFavoriteSong, models.Song.id == models.UserFavoriteSong.song_id)
        .filter(models.UserFavoriteSong.user_id == current_user.id)
        .order_by(models.UserFavoriteSong.created_at.desc())
        .all()
    )

    if not favorites:
        return []

    song_ids = [s.id for s in favorites]
    artists_map = get_artists_for_songs(db, song_ids)

    response = []
    for song in favorites:
        yt_id, nico_id, nico_thumb = extract_pvs(song.pv_data)
        
        am = artists_map.get(song.id, {'producers': [], 'vocalists': []})
        producers = am.get('producers', [])
        vocalists = am.get('vocalists', [])
        
        artist_string = " · ".join([p['name'] for p in producers]) if producers else "Unknown"
        vocaloid_string = " · ".join([v['name'] for v in vocalists]) if vocalists else "Unknown"

        response.append(schemas.SongRanking(
            id=song.id,
            name_english=song.name_english,
            name_japanese=song.name_japanese,
            name_romaji=song.name_romaji,
            total_views=(song.youtube_views or 0) + (song.niconico_views or 0),
            increment_total=0,
            increment_youtube=0,
            increment_niconico=0,
            views_youtube=song.youtube_views or 0,
            views_niconico=song.niconico_views or 0,
            youtube_id=yt_id,
            niconico_id=nico_id,
            niconico_thumb_url=nico_thumb,
            song_type=song.song_type,
            publish_date=song.publish_date,
            artist_string=artist_string,
            vocaloid_string=vocaloid_string,
            artists=producers,
            vocalists=vocalists
        ))

    return response

@router.get("/artists", response_model=list[schemas.Artist])
def get_user_favorite_artists(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Retrieve all artists favorited by the current user, sorted by newest first."""
    favorites = (
        db.query(models.Artist)
        .join(models.UserFavoriteArtist, models.Artist.id == models.UserFavoriteArtist.artist_id)
        .filter(models.UserFavoriteArtist.user_id == current_user.id)
        .order_by(models.UserFavoriteArtist.created_at.desc())
        .all()
    )
    
    # We must explicitly attach the is_favorite boolean for the UI
    for artist in favorites:
        artist.is_favorite = True
        
    return favorites
