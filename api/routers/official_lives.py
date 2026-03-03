import io
import os
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from .auth import get_current_user_from_token

router = APIRouter(redirect_slashes=False)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "../static")
LIVE_COVER_DIR = os.path.join(STATIC_DIR, "live_covers")
os.makedirs(LIVE_COVER_DIR, exist_ok=True)

_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
_ALLOWED_EXT  = {".jpg", ".jpeg", ".png", ".webp"}
_MAX_COVER_BYTES = 5 * 1024 * 1024


def get_admin_user(
    current_user: models.User = Depends(get_current_user_from_token),
) -> models.User:
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def _build_live_out(live: models.OfficialLive) -> schemas.OfficialLiveOut:
    return schemas.OfficialLiveOut(
        id=live.id,
        name=live.name,
        slug=live.slug,
        description=live.description,
        cover_url=live.cover_url,
        display_order=live.display_order,
        created_at=live.created_at,
        playlist_count=len(live.playlists),
    )


# ── GET /official-lives — list all ───────────────────────────────────────────

@router.get("", response_model=list[schemas.OfficialLiveOut])
def list_lives(db: Session = Depends(get_db)):
    lives = (
        db.query(models.OfficialLive)
        .order_by(models.OfficialLive.display_order.asc(), models.OfficialLive.created_at.asc())
        .all()
    )
    return [_build_live_out(live) for live in lives]


# ── GET /official-lives/{slug} — detail with playlists ───────────────────────

@router.get("/{slug}", response_model=schemas.OfficialLiveOut)
def get_live(slug: str, db: Session = Depends(get_db)):
    live = db.query(models.OfficialLive).filter(models.OfficialLive.slug == slug).first()
    if not live:
        raise HTTPException(status_code=404, detail="Official live not found")
    return _build_live_out(live)


# ── GET /official-lives/{slug}/playlists — playlists for a live ──────────────

@router.get("/{slug}/playlists")
def get_live_playlists(slug: str, db: Session = Depends(get_db)):
    live = db.query(models.OfficialLive).filter(models.OfficialLive.slug == slug).first()
    if not live:
        raise HTTPException(status_code=404, detail="Official live not found")

    import json

    def _pv_first(song: models.Song):
        try:
            return json.loads(song.pv_data or "[]")[0] if song.pv_data else {}
        except Exception:
            return {}

    def _youtube_id(song: models.Song):
        try:
            for pv in json.loads(song.pv_data or "[]"):
                if pv.get("service") == "Youtube":
                    return pv.get("pvId")
        except Exception:
            pass
        return None

    def _niconico_thumb(song: models.Song):
        try:
            for pv in json.loads(song.pv_data or "[]"):
                if pv.get("service") == "NicoNicoDouga":
                    return pv.get("thumbUrl")
        except Exception:
            pass
        return None

    result = []
    sorted_playlists = sorted(live.playlists, key=lambda p: (p.live_display_order or 0, p.id))
    for pl in sorted_playlists:
        preview_songs = [
            {
                "song_id": ps.song_id,
                "youtube_id": _youtube_id(ps.song),
                "niconico_thumb_url": _niconico_thumb(ps.song),
                "name_english": ps.song.name_english,
                "name_japanese": ps.song.name_japanese,
            }
            for ps in pl.songs[:4]
        ]
        total_secs = sum(
            ps.song.length_seconds for ps in pl.songs if ps.song.length_seconds
        ) or None
        result.append({
            "id": pl.id,
            "user_id": pl.user_id,
            "title": pl.title,
            "description": pl.description,
            "cover_url": pl.cover_url,
            "is_public": pl.is_public,
            "created_at": pl.created_at,
            "updated_at": pl.updated_at,
            "song_count": len(pl.songs),
            "total_duration_seconds": total_secs,
            "favorite_count": len(pl.favorites),
            "is_favorited": False,
            "owner": {
                "id": pl.user.id,
                "name": pl.user.name,
                "picture_url": pl.user.picture_url,
            },
            "songs": preview_songs,
            "live_id": pl.live_id,
        })
    return result


# ── POST /official-lives/{live_id}/reorder — reorder playlists ───────────────

class ReorderRequest(BaseModel):
    playlist_ids: list[int]


@router.post("/{live_id}/reorder", status_code=200)
def reorder_live_playlists(
    live_id: int,
    data: ReorderRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    live = db.query(models.OfficialLive).filter(models.OfficialLive.id == live_id).first()
    if not live:
        raise HTTPException(status_code=404, detail="Official live not found")
    for order, pl_id in enumerate(data.playlist_ids):
        pl = db.query(models.Playlist).filter(
            models.Playlist.id == pl_id,
            models.Playlist.live_id == live_id,
        ).first()
        if pl:
            pl.live_display_order = order
    db.commit()
    return {"ok": True}


# ── POST /official-lives — create ─────────────────────────────────────────────

@router.post("", response_model=schemas.OfficialLiveOut, status_code=201)
def create_live(
    data: schemas.OfficialLiveCreate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    existing = db.query(models.OfficialLive).filter(models.OfficialLive.slug == data.slug).first()
    if existing:
        raise HTTPException(status_code=409, detail="Slug already in use")
    live = models.OfficialLive(
        name=data.name,
        slug=data.slug,
        description=data.description,
        display_order=data.display_order,
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(live)
    db.commit()
    db.refresh(live)
    return _build_live_out(live)


# ── PATCH /official-lives/{id} — update ──────────────────────────────────────

@router.patch("/{live_id}", response_model=schemas.OfficialLiveOut)
def update_live(
    live_id: int,
    data: schemas.OfficialLiveUpdate,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    live = db.query(models.OfficialLive).filter(models.OfficialLive.id == live_id).first()
    if not live:
        raise HTTPException(status_code=404, detail="Official live not found")
    if data.name is not None:
        live.name = data.name
    if data.slug is not None:
        conflict = db.query(models.OfficialLive).filter(
            models.OfficialLive.slug == data.slug,
            models.OfficialLive.id != live_id,
        ).first()
        if conflict:
            raise HTTPException(status_code=409, detail="Slug already in use")
        live.slug = data.slug
    if data.description is not None:
        live.description = data.description or None
    if data.display_order is not None:
        live.display_order = data.display_order
    db.commit()
    db.refresh(live)
    return _build_live_out(live)


# ── DELETE /official-lives/{id} — delete ─────────────────────────────────────

@router.delete("/{live_id}", status_code=204)
def delete_live(
    live_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    live = db.query(models.OfficialLive).filter(models.OfficialLive.id == live_id).first()
    if not live:
        raise HTTPException(status_code=404, detail="Official live not found")
    # Unassign all playlists first
    for pl in live.playlists:
        pl.live_id = None
    # Remove cover file if exists
    if live.cover_url and "/api/static/live_covers/" in live.cover_url:
        filename = live.cover_url.split("/api/static/live_covers/")[-1].split("?")[0]
        file_path = os.path.join(LIVE_COVER_DIR, filename)
        if os.path.isfile(file_path):
            os.remove(file_path)
    db.delete(live)
    db.commit()


# ── POST /official-lives/{id}/cover — upload cover ───────────────────────────

@router.post("/{live_id}/cover")
async def upload_live_cover(
    live_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    live = db.query(models.OfficialLive).filter(models.OfficialLive.id == live_id).first()
    if not live:
        raise HTTPException(status_code=404, detail="Official live not found")

    if file.content_type not in _ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WEBP images are allowed.")
    ext = os.path.splitext(file.filename or "")[-1].lower()
    if ext not in _ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WEBP images are allowed.")

    data = await file.read()
    if len(data) > _MAX_COVER_BYTES:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")

    from PIL import Image, UnidentifiedImageError
    try:
        probe = Image.open(io.BytesIO(data))
        probe.verify()
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except (UnidentifiedImageError, Exception):
        raise HTTPException(status_code=400, detail="Invalid or corrupted image file.")

    img.thumbnail((800, 800))
    filename = f"live_{live_id}.jpg"
    save_path = os.path.join(LIVE_COVER_DIR, filename)
    img.save(save_path, "JPEG", quality=85)

    live.cover_url = f"/api/static/live_covers/{filename}?v={int(time.time())}"
    db.commit()
    return {"cover_url": live.cover_url}


# ── DELETE /official-lives/{id}/cover — remove cover ─────────────────────────

@router.delete("/{live_id}/cover", status_code=204)
def remove_live_cover(
    live_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(get_admin_user),
):
    live = db.query(models.OfficialLive).filter(models.OfficialLive.id == live_id).first()
    if not live:
        raise HTTPException(status_code=404, detail="Official live not found")

    if live.cover_url and "/api/static/live_covers/" in live.cover_url:
        filename = live.cover_url.split("/api/static/live_covers/")[-1].split("?")[0]
        file_path = os.path.join(LIVE_COVER_DIR, filename)
        if os.path.isfile(file_path):
            os.remove(file_path)

    live.cover_url = None
    db.commit()
