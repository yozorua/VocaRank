from pydantic import BaseModel, validator
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
    
    picture_mime: Optional[str] = None
    picture_url_original: Optional[str] = None
    picture_url_thumb: Optional[str] = None
    external_links: Optional[List[dict]] = None
    
    first_song_date: Optional[str] = None
    last_song_date: Optional[str] = None
    
    is_favorite: Optional[bool] = False

    @validator('external_links', pre=True)
    def parse_external_links(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except ValueError:
                return []
        return v

# --- Song Schemas ---
class ArtistTiny(BaseModel):
    id: int
    name: str
    artist_type: Optional[str] = None
    picture_url_thumb: Optional[str] = None
    
    class Config:
        orm_mode = True

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
    original_song: Optional[SongList] = None
    views_youtube: int
    views_niconico: int
    total_views: int
    artist_string: str
    vocaloid_string: str
    artists: List[ArtistTiny] = []
    vocalists: List[ArtistTiny] = []
    youtube_id: Optional[str] = None
    niconico_id: Optional[str] = None
    niconico_thumb_url: Optional[str] = None
    youtube_history: Optional[List[dict]] = None
    niconico_history: Optional[List[dict]] = None
    
    is_favorite: Optional[bool] = False
    mood_votes: Optional[dict] = {"happy": 0, "sad": 0, "love": 0, "hype": 0, "chill": 0, "emotional": 0}

    @validator('youtube_history', 'niconico_history', pre=True)
    def parse_history(cls, v):
        if isinstance(v, str):
            try:
                import json
                return json.loads(v)
            except ValueError:
                return []
        return v


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
    niconico_thumb_url: Optional[str] = None
    song_type: Optional[str] = None
    publish_date: Optional[str] = None
    
    views_youtube: int
    views_niconico: int
    artist_string: str # Legacy string
    vocaloid_string: str # Legacy string
    artists: List[ArtistTiny] = [] # Structured data
    vocalists: List[ArtistTiny] = [] # Structured data

# --- Auth Schemas ---
class UserBase(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    picture_url: Optional[str] = None
    created_at: Optional[str] = None
    country: Optional[str] = None
    age_range: Optional[str] = None
    last_login: Optional[str] = None

    class Config:
        orm_mode = True

class UserUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    age_range: Optional[str] = None
    email: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

class GoogleLogin(BaseModel):
    id_token: str

# --- Input Schemas ---
class SongVoteCreate(BaseModel):
    vote_type: str
