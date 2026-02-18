from pydantic import BaseModel
from typing import List, Optional, Any

# --- Artist Schemas ---
class ArtistBase(BaseModel):
    id: int
    name_default: str
    artist_type: Optional[str] = None
    
    class Config:
        orm_mode = True

class Artist(ArtistBase):
    name_english: Optional[str] = None
    name_japanese: Optional[str] = None
    name_romaji: Optional[str] = None

# --- Song Schemas ---
class SongBase(BaseModel):
    id: int
    name_english: Optional[str] = None
    name_japanese: Optional[str] = None
    name_romaji: Optional[str] = None
    publish_date: Optional[str] = None
    song_type: Optional[str] = None
    
    class Config:
        orm_mode = True

class SongList(SongBase):
    """Lightweight schema for lists."""
    youtube_views: int
    niconico_views: int

class SongDetail(SongBase):
    """Detailed schema with relations."""
    length_seconds: Optional[int] = None
    original_song_id: Optional[int] = None
    views_youtube: int
    views_niconico: int
    total_views: int
    artist_string: str
    vocaloid_string: str
    youtube_id: Optional[str] = None
    niconico_id: Optional[str] = None


# --- Ranking Schemas ---
class SongRanking(BaseModel):
    id: int

    name_english: Optional[str] = None
    name_japanese: Optional[str] = None
    name_romaji: Optional[str] = None
    
    total_views: int
    increment_total: Optional[int] = None
    increment_youtube: Optional[int] = None
    increment_niconico: Optional[int] = None
    

    youtube_id: Optional[str] = None
    niconico_id: Optional[str] = None
    song_type: Optional[str] = None
    publish_date: Optional[str] = None
    
    views_youtube: int
    views_niconico: int
    artist_string: str # Producer names
    vocaloid_string: str # Vocalist names
