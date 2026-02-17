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
    
    q = db.query(models.Artist).filter(
        (models.Artist.name_default.ilike(keyword)) |
        (models.Artist.name_english.ilike(keyword)) |
        (models.Artist.name_japanese.ilike(keyword))
    )
    
    if artist_type:
        q = q.filter(models.Artist.artist_type == artist_type)
        
    return q.limit(limit).all()

@router.get("/{artist_id}", response_model=schemas.Artist)
def get_artist(artist_id: int, db: Session = Depends(get_db)):
    """
    Get detailed information for a specific artist.
    """
    artist = db.query(models.Artist).filter(models.Artist.id == artist_id).first()
    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")
    return artist
