import json
import os
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt

from ..database import get_db
from .. import models, schemas
from .auth import get_current_user_from_token, JWT_SECRET, ALGORITHM
from ..utils import SYNTH_TYPES

router = APIRouter(prefix="/playlists", tags=["playlists"], redirect_slashes=False)

_bearer = HTTPBearer(auto_error=False)

def get_optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> models.User | None:
    """Returns the current user if a valid token is provided, otherwise None."""
    if not creds:
        return None
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        return db.query(models.User).filter(models.User.id == int(user_id)).first()
    except Exception:
        return None

STATIC_DIR = os.path.join(os.path.dirname(__file__), "../static")
COVER_DIR  = os.path.join(STATIC_DIR, "playlist_covers")
os.makedirs(COVER_DIR, exist_ok=True)

API_BASE = os.getenv("API_BASE_URL", "")  # e.g. https://vocarank.live/api


# ── helpers ──────────────────────────────────────────────────────────────────

def _pv(song: models.Song) -> dict:
    try:
        return json.loads(song.pv_data or "[]")[0] if song.pv_data else {}
    except Exception:
        return {}

def _youtube_id(song: models.Song) -> Optional[str]:
    try:
        pvs = json.loads(song.pv_data or "[]")
        for pv in pvs:
            if pv.get("service") == "Youtube":
                return pv.get("pvId")
    except Exception:
        pass
    return None

def _niconico_id(song: models.Song) -> Optional[str]:
    try:
        pvs = json.loads(song.pv_data or "[]")
        for pv in pvs:
            if pv.get("service") == "NicoNicoDouga":
                return pv.get("pvId")
    except Exception:
        pass
    return None

def _niconico_thumb(song: models.Song) -> Optional[str]:
    """Extracts NicoNico thumbnail URL from pv_data (same source as extract_pvs uses)."""
    try:
        pvs = json.loads(song.pv_data or "[]")
        for pv in pvs:
            if pv.get("service") == "NicoNicoDouga":
                return pv.get("thumbUrl")
    except Exception:
        pass
    return None

def _artist_string(song: models.Song) -> str:
    return " · ".join(
        a.name_default or a.name_english or ""
        for a in song.artists
        if a.artist_type not in ("Vocaloid", "UTAU", "OtherVoiceSynthesizer",
                                  "CoverArtist", "Animator")
    ) or "Unknown"

def _songwriter_string(song: models.Song) -> str:
    """Producers/composers separated by · for display (same as artist_string but dot-separated)."""
    names = [
        a.name_default or a.name_english or ""
        for a in song.artists
        if a.artist_type not in ("Vocaloid", "UTAU", "OtherVoiceSynthesizer",
                                  "CoverArtist", "Animator")
    ]
    return " · ".join(names) or "Unknown"

def _vocalist_string(song: models.Song) -> Optional[str]:
    names = [
        a.name_default or a.name_english or ""
        for a in song.artists
        if a.artist_type in ("Vocaloid", "UTAU", "OtherVoiceSynthesizer")
    ]
    return " · ".join(names) if names else None

def _build_song_out(ps: models.PlaylistSong) -> schemas.PlaylistSongOut:
    song = ps.song
    producers, vocalists, others = [], [], []
    for a in song.artists:
        obj = schemas.ArtistTiny(
            id=a.id,
            name=a.name_default or a.name_english or '',
            artist_type=a.artist_type,
            picture_url_thumb=getattr(a, 'picture_url_thumb', None),
        )
        if a.artist_type in ('Producer', 'Circle', 'OtherGroup'):
            producers.append(obj)
        elif a.artist_type in SYNTH_TYPES:
            vocalists.append(obj)
        else:
            others.append(obj)
    if not producers and others:
        producers = others
    return schemas.PlaylistSongOut(
        song_id=song.id,
        position=ps.position,
        name_english=song.name_english,
        name_japanese=song.name_japanese,
        name_romaji=song.name_romaji,
        youtube_id=_youtube_id(song),
        niconico_id=_niconico_id(song),
        niconico_thumb_url=_niconico_thumb(song),
        artist_string=_artist_string(song),
        songwriter_string=_songwriter_string(song),
        vocalist_string=_vocalist_string(song),
        song_type=getattr(song, 'song_type', None),
        artists=producers,
        vocalists=vocalists,
    )

def _build_playlist_out(
    pl: models.Playlist,
    db: Session,
    current_user_id: Optional[int] = None,
    include_songs: bool = False,
    preview_only: bool = False,
) -> schemas.PlaylistOut:
    fav_count = len(pl.favorites)
    is_fav = any(f.user_id == current_user_id for f in pl.favorites) if current_user_id else False
    if include_songs:
        songs_slice = pl.songs[:4] if preview_only else pl.songs
        songs_out = [_build_song_out(ps) for ps in songs_slice]
    else:
        songs_out = []
    total_secs = sum(
        ps.song.length_seconds
        for ps in pl.songs
        if ps.song.length_seconds
    ) or None
    return schemas.PlaylistOut(
        id=pl.id,
        user_id=pl.user_id,
        title=pl.title,
        description=pl.description,
        cover_url=pl.cover_url,
        is_public=pl.is_public,
        created_at=pl.created_at,
        updated_at=pl.updated_at,
        song_count=len(pl.songs),
        total_duration_seconds=total_secs,
        favorite_count=fav_count,
        is_favorited=is_fav,
        owner=schemas.PlaylistOwner(
            id=pl.user.id,
            name=pl.user.name,
            picture_url=pl.user.picture_url,
        ),
        songs=songs_out,
    )

def _optional_user(token: str = Depends(lambda: None), db: Session = Depends(get_db)):
    """Returns user if bearer token present, None otherwise."""
    return None  # public endpoints override via separate dep


# ── GET /playlists/count — total public playlist count ────────────────────────

@router.get("/count")
def count_playlists(
    query: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(models.Playlist).filter(models.Playlist.is_public == 1)
    if query:
        q = q.filter(models.Playlist.title.ilike(f"%{query}%"))
    return {"total": q.count()}


# ── GET /playlists/ — browse public playlists ─────────────────────────────────

@router.get("", response_model=list[schemas.PlaylistOut])
def list_playlists(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    query: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    offset = (page - 1) * per_page
    q = db.query(models.Playlist).filter(models.Playlist.is_public == 1)
    if query:
        q = q.filter(models.Playlist.title.ilike(f"%{query}%"))
    playlists = (
        q.order_by(models.Playlist.created_at.desc())
        .offset(offset).limit(per_page)
        .all()
    )
    return [_build_playlist_out(pl, db, preview_only=True, include_songs=True) for pl in playlists]


# ── GET /playlists/mine — current user's playlists ────────────────────────────

@router.get("/mine", response_model=list[schemas.PlaylistOut])
def my_playlists(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    playlists = (
        db.query(models.Playlist)
        .filter(models.Playlist.user_id == current_user.id)
        .order_by(models.Playlist.created_at.desc())
        .all()
    )
    return [_build_playlist_out(pl, db, current_user.id, include_songs=True, preview_only=True) for pl in playlists]


# ── GET /playlists/mine/song-check — which of my playlists contain a song ─────

@router.get("/mine/song-check", response_model=list[int])
def my_playlists_containing_song(
    song_id: int = Query(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    """Returns list of the current user's playlist IDs that contain the given song."""
    rows = (
        db.query(models.PlaylistSong.playlist_id)
        .join(models.Playlist, models.Playlist.id == models.PlaylistSong.playlist_id)
        .filter(
            models.Playlist.user_id == current_user.id,
            models.PlaylistSong.song_id == song_id,
        )
        .all()
    )
    return [r.playlist_id for r in rows]


# ── GET /playlists/favorites — current user's favorited playlists ─────────────

@router.get("/favorites", response_model=list[schemas.PlaylistOut])
def my_favorite_playlists(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    favs = (
        db.query(models.PlaylistFavorite)
        .filter(models.PlaylistFavorite.user_id == current_user.id)
        .all()
    )
    playlist_ids = [f.playlist_id for f in favs]
    if not playlist_ids:
        return []
    playlists = (
        db.query(models.Playlist)
        .filter(models.Playlist.id.in_(playlist_ids))
        .order_by(models.Playlist.updated_at.desc())
        .all()
    )
    return [_build_playlist_out(pl, db, current_user.id, include_songs=True, preview_only=True) for pl in playlists]


# ── GET /playlists/{id} — playlist detail ────────────────────────────────────

@router.get("/{playlist_id}", response_model=schemas.PlaylistOut)
def get_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User | None = Depends(get_optional_user),
):
    pl = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if not pl.is_public:
        # Only the owner can see private playlists
        if not current_user or current_user.id != pl.user_id:
            raise HTTPException(status_code=403, detail="This playlist is private")
    uid = current_user.id if current_user else None
    return _build_playlist_out(pl, db, current_user_id=uid, include_songs=True)


# ── POST /playlists/ — create ─────────────────────────────────────────────────

@router.post("", response_model=schemas.PlaylistOut, status_code=201)
def create_playlist(
    data: schemas.PlaylistCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    now = datetime.utcnow().isoformat()
    pl = models.Playlist(
        user_id=current_user.id,
        title=data.title,
        description=data.description,
        is_public=data.is_public,
        created_at=now,
        updated_at=now,
    )
    db.add(pl)
    db.commit()
    db.refresh(pl)
    return _build_playlist_out(pl, db, current_user.id)


# ── PATCH /playlists/{id} — edit ─────────────────────────────────────────────

@router.patch("/{playlist_id}", response_model=schemas.PlaylistOut)
def update_playlist(
    playlist_id: int,
    data: schemas.PlaylistUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    pl = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404)
    # Non-admins can only edit their own playlists
    if pl.user_id != current_user.id and not getattr(current_user, 'is_admin', False):
        raise HTTPException(status_code=403, detail="Not your playlist")
    if data.title is not None:
        pl.title = data.title
    if data.description is not None:
        pl.description = data.description
    if data.is_public is not None:
        pl.is_public = data.is_public
    # Only admins can set/clear live_id (live_id=0 means unassign → set NULL)
    if data.live_id is not None and getattr(current_user, 'is_admin', False):
        pl.live_id = data.live_id if data.live_id > 0 else None
    pl.updated_at = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(pl)
    return _build_playlist_out(pl, db, current_user.id, include_songs=True)


# ── DELETE /playlists/{id} ────────────────────────────────────────────────────

@router.delete("/{playlist_id}", status_code=204)
def delete_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    pl = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404)
    if pl.user_id != current_user.id:
        raise HTTPException(status_code=403)
    db.delete(pl)
    db.commit()


# ── POST /playlists/{id}/songs — add song ─────────────────────────────────────

@router.post("/{playlist_id}/songs", response_model=schemas.PlaylistOut)
def add_song(
    playlist_id: int,
    data: schemas.PlaylistAddSong,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    pl = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404)
    if pl.user_id != current_user.id:
        raise HTTPException(status_code=403)
    song = db.query(models.Song).filter(models.Song.id == data.song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    existing = db.query(models.PlaylistSong).filter_by(
        playlist_id=playlist_id, song_id=data.song_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Song already in playlist")
    max_pos = max((ps.position for ps in pl.songs), default=-1) + 1
    ps = models.PlaylistSong(
        playlist_id=playlist_id,
        song_id=data.song_id,
        position=max_pos,
        added_at=datetime.utcnow().isoformat(),
    )
    db.add(ps)
    pl.updated_at = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(pl)
    return _build_playlist_out(pl, db, current_user.id, include_songs=True)


# ── DELETE /playlists/{id}/songs/{song_id} — remove song ─────────────────────

@router.delete("/{playlist_id}/songs/{song_id}", response_model=schemas.PlaylistOut)
def remove_song(
    playlist_id: int,
    song_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    pl = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404)
    if pl.user_id != current_user.id:
        raise HTTPException(status_code=403)
    ps = db.query(models.PlaylistSong).filter_by(
        playlist_id=playlist_id, song_id=song_id).first()
    if ps:
        db.delete(ps)
        pl.updated_at = datetime.utcnow().isoformat()
        db.commit()
        db.refresh(pl)
    return _build_playlist_out(pl, db, current_user.id, include_songs=True)


# ── PATCH /playlists/{id}/songs/reorder — reorder songs ──────────────────────

from pydantic import BaseModel as PydanticBase

class ReorderBody(PydanticBase):
    song_ids: list[int]  # ordered list of song_ids

@router.patch("/{playlist_id}/songs/reorder", response_model=schemas.PlaylistOut)
def reorder_songs(
    playlist_id: int,
    body: ReorderBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    pl = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404)
    if pl.user_id != current_user.id:
        raise HTTPException(status_code=403)
    for pos, sid in enumerate(body.song_ids):
        ps = db.query(models.PlaylistSong).filter_by(
            playlist_id=playlist_id, song_id=sid).first()
        if ps:
            ps.position = pos
    pl.updated_at = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(pl)
    return _build_playlist_out(pl, db, current_user.id, include_songs=True)


# ── POST /playlists/{id}/favorite — toggle ────────────────────────────────────

@router.post("/{playlist_id}/favorite")
def toggle_favorite(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    pl = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404)
    if not pl.is_public and pl.user_id != current_user.id:
        raise HTTPException(status_code=403)
    fav = db.query(models.PlaylistFavorite).filter_by(
        playlist_id=playlist_id, user_id=current_user.id).first()
    if fav:
        db.delete(fav)
        is_favorited = False
    else:
        db.add(models.PlaylistFavorite(
            playlist_id=playlist_id, user_id=current_user.id))
        is_favorited = True
    db.commit()
    count = db.query(models.PlaylistFavorite).filter_by(playlist_id=playlist_id).count()
    return {"is_favorited": is_favorited, "favorite_count": count}


# ── POST /playlists/{id}/cover — upload custom cover ─────────────────────────

_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
_ALLOWED_EXT  = {".jpg", ".jpeg", ".png", ".webp"}
_MAX_COVER_BYTES = 5 * 1024 * 1024  # 5 MB

@router.post("/{playlist_id}/cover")
async def upload_cover(
    playlist_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    pl = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404)
    if pl.user_id != current_user.id:
        raise HTTPException(status_code=403)

    # 1. Validate declared MIME type
    if file.content_type not in _ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WEBP images are allowed.")

    # 2. Validate file extension
    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in _ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WEBP images are allowed.")

    data = await file.read()

    # 3. Enforce size limit
    if len(data) > _MAX_COVER_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")

    # 4. Verify it is a genuine image (re-encode through Pillow to strip any embedded payloads)
    from PIL import Image, UnidentifiedImageError
    import io
    try:
        # verify() checks integrity but closes the handle — re-open afterward
        probe = Image.open(io.BytesIO(data))
        probe.verify()
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except (UnidentifiedImageError, Exception):
        raise HTTPException(status_code=400, detail="Invalid or corrupted image file.")

    img.thumbnail((600, 600))
    filename = f"playlist_{playlist_id}.jpg"
    save_path = os.path.join(COVER_DIR, filename)
    img.save(save_path, "JPEG", quality=85)

    pl.cover_url = f"/api/static/playlist_covers/{filename}?v={int(time.time())}"
    pl.updated_at = datetime.utcnow().isoformat()
    db.commit()
    return {"cover_url": pl.cover_url}


# ── DELETE /playlists/{id}/cover — remove custom cover ───────────────────────

@router.delete("/{playlist_id}/cover", status_code=204)
def remove_cover(
    playlist_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_from_token),
):
    pl = db.query(models.Playlist).filter(models.Playlist.id == playlist_id).first()
    if not pl:
        raise HTTPException(status_code=404)
    if pl.user_id != current_user.id:
        raise HTTPException(status_code=403)

    # Delete the file from disk if it is a locally stored cover
    if pl.cover_url and "/api/static/playlist_covers/" in pl.cover_url:
        filename = pl.cover_url.split("/api/static/playlist_covers/")[-1].split("?")[0]
        file_path = os.path.join(COVER_DIR, filename)
        if os.path.isfile(file_path):
            os.remove(file_path)

    pl.cover_url = None
    pl.updated_at = datetime.utcnow().isoformat()
    db.commit()
