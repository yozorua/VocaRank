from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
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
