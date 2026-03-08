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
    other_vocalists: List[ArtistTiny] = []
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
    other_vocalists: List[ArtistTiny] = [] # Real human vocalists

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
    is_admin: Optional[bool] = False

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

# --- Playlist Schemas ---
class PlaylistSongOut(BaseModel):
    song_id: int
    position: int
    name_english: Optional[str] = None
    name_japanese: Optional[str] = None
    name_romaji: Optional[str] = None
    youtube_id: Optional[str] = None
    niconico_id: Optional[str] = None
    niconico_thumb_url: Optional[str] = None
    artist_string: Optional[str] = None
    songwriter_string: Optional[str] = None
    vocalist_string: Optional[str] = None
    song_type: Optional[str] = None
    artists: List[ArtistTiny] = []
    vocalists: List[ArtistTiny] = []

    class Config:
        orm_mode = True

class PlaylistOwner(BaseModel):
    id: int
    name: Optional[str] = None
    picture_url: Optional[str] = None

    class Config:
        orm_mode = True

class PlaylistOut(BaseModel):
    id: int
    user_id: int
    title: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    is_public: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    song_count: int = 0
    total_duration_seconds: Optional[int] = None
    favorite_count: int = 0
    is_favorited: bool = False
    owner: Optional[PlaylistOwner] = None
    songs: List[PlaylistSongOut] = []

    class Config:
        orm_mode = True

class PlaylistCreate(BaseModel):
    title: str
    description: Optional[str] = None
    is_public: int = 1

class PlaylistUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[int] = None
    live_id: Optional[int] = None  # admin-only; set/unset live assignment

class PlaylistAddSong(BaseModel):
    song_id: int

# --- Comment Schemas ---
class SongCommentBase(BaseModel):
    content: str

class SongCommentCreate(SongCommentBase):
    pass

class SongCommentUpdate(SongCommentBase):
    pass

class CommentUser(BaseModel):
    id: int
    name: Optional[str] = None
    picture_url: Optional[str] = None

    class Config:
        orm_mode = True

class SongCommentOut(SongCommentBase):
    id: int
    song_id: int
    user_id: int
    created_at: str
    updated_at: Optional[str] = None
    user: CommentUser

    class Config:
        orm_mode = True

# --- Official Live Schemas ---
class OfficialLiveOut(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    display_order: int = 0
    created_at: Optional[str] = None
    playlist_count: int = 0

    class Config:
        orm_mode = True

class OfficialLiveCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    display_order: int = 0

class OfficialLiveUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    display_order: Optional[int] = None


# --- About / Founder Schemas ---
class FounderOut(BaseModel):
    id: int
    name: Optional[str] = None
    picture_url: Optional[str] = None
    contact_email: Optional[str] = None
    social_x: Optional[str] = None
    social_instagram: Optional[str] = None
    social_facebook: Optional[str] = None
    social_discord: Optional[str] = None
    about_title: Optional[str] = None
    paypal_url: Optional[str] = None

class FounderUpdate(BaseModel):
    contact_email: Optional[str] = None
    social_x: Optional[str] = None
    social_instagram: Optional[str] = None
    social_facebook: Optional[str] = None
    social_discord: Optional[str] = None
    about_title: Optional[str] = None
    paypal_url: Optional[str] = None


# --- Contributor Schemas ---
class ContributorOut(BaseModel):
    id: int
    user_id: int
    name: Optional[str] = None
    picture_url: Optional[str] = None
    role: Optional[str] = None
    display_order: int

class ContributorCreate(BaseModel):
    user_id: int
    role: Optional[str] = None
    display_order: int = 0

class ContributorUpdate(BaseModel):
    role: Optional[str] = None
    display_order: Optional[int] = None


# --- About / Announcement Schemas ---
class AnnouncementOut(BaseModel):
    id: int
    title: str
    content: str
    pinned: bool
    created_at: str
    updated_at: str

    class Config:
        orm_mode = True

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    pinned: bool = False

class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    pinned: Optional[bool] = None


# --- Roadmap Schemas ---
class RoadmapItemOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
    display_order: int
    event_date: Optional[str] = None
    created_at: str
    title_zh_tw: Optional[str] = None
    title_ja: Optional[str] = None
    description_zh_tw: Optional[str] = None
    description_ja: Optional[str] = None

    class Config:
        orm_mode = True

class RoadmapItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "completed"
    display_order: int = 0
    event_date: Optional[str] = None
    title_zh_tw: Optional[str] = None
    title_ja: Optional[str] = None
    description_zh_tw: Optional[str] = None
    description_ja: Optional[str] = None

class RoadmapItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    display_order: Optional[int] = None
    event_date: Optional[str] = None
    title_zh_tw: Optional[str] = None
    title_ja: Optional[str] = None
    description_zh_tw: Optional[str] = None
    description_ja: Optional[str] = None


# --- Report Schemas ---
class ReportUserOut(BaseModel):
    id: int
    name: Optional[str] = None
    picture_url: Optional[str] = None

    class Config:
        orm_mode = True

class ReportOut(BaseModel):
    id: int
    report_type: str
    title: str
    description: Optional[str] = None
    status: str
    created_at: str
    upvote_count: int
    user_upvoted: bool
    user: ReportUserOut

    class Config:
        orm_mode = True

class ReportCreate(BaseModel):
    report_type: str   # bug | feature
    title: str
    description: Optional[str] = None

class ReportStatusUpdate(BaseModel):
    status: str  # open | resolved | closed
