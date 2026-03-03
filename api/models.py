from sqlalchemy import Column, Integer, BigInteger, String, Text, ForeignKey, Table, Boolean
from sqlalchemy.orm import relationship
from .database import Base

# Association Tables
song_artists = Table('song_artists', Base.metadata,
    Column('song_id', Integer, ForeignKey('songs.id'), primary_key=True),
    Column('artist_id', Integer, ForeignKey('artists.id'), primary_key=True)
)

class Song(Base):
    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)
    name_english = Column(String)
    name_japanese = Column(String)
    name_romaji = Column(String)
    song_type = Column(String)
    length_seconds = Column(BigInteger)
    # artist_ids stored as JSON string in legacy column, but we have song_artists table now
    publish_date = Column(String)
    original_song_id = Column(BigInteger)
    pv_data = Column(Text) # JSON
    tag_ids = Column(Text) # JSON
    niconico_views = Column(BigInteger)
    youtube_views = Column(BigInteger)
    niconico_history = Column(Text) # JSON
    youtube_history = Column(Text) # JSON
    last_update_time = Column(String)

    # Relationships
    artists = relationship("Artist", secondary=song_artists, back_populates="songs")

class Artist(Base):
    __tablename__ = "artists"

    id = Column(Integer, primary_key=True, index=True)
    artist_type = Column(String)
    name_default = Column(String)
    name_english = Column(String)
    name_japanese = Column(String)
    name_romaji = Column(String)
    
    picture_mime = Column(String)
    picture_url_original = Column(String)
    picture_url_thumb = Column(String)
    external_links = Column(Text) # JSON string

    songs = relationship("Song", secondary=song_artists, back_populates="artists")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String)
    picture_url = Column(String)
    created_at = Column(String)
    country = Column(String)
    age_range = Column(String)
    last_login = Column(String)
    is_admin = Column(Boolean, default=False)

    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")

class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    provider = Column(String, primary_key=True)
    provider_account_id = Column(String, primary_key=True)
    
    user = relationship("User", back_populates="oauth_accounts")

class UserFavoriteSong(Base):
    __tablename__ = "user_favorite_songs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    song_id = Column(Integer, ForeignKey("songs.id"), index=True, nullable=False)
    created_at = Column(String, nullable=False)

    user = relationship("User")
    song = relationship("Song")

class UserFavoriteArtist(Base):
    __tablename__ = "user_favorite_artists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    artist_id = Column(Integer, ForeignKey("artists.id"), index=True, nullable=False)
    created_at = Column(String, nullable=False)

    user = relationship("User")
    artist = relationship("Artist")

class SongVote(Base):
    __tablename__ = "song_votes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    song_id = Column(Integer, ForeignKey("songs.id"), index=True, nullable=False)
    vote_type = Column(String, nullable=False) # e.g. happy, sad, love
    ip_address = Column(String, nullable=False)
    created_at = Column(String, nullable=False)

    song = relationship("Song")

class OfficialLive(Base):
    __tablename__ = "official_lives"

    id            = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name          = Column(String(200), nullable=False)
    slug          = Column(String(200), unique=True, nullable=False)
    description   = Column(Text)
    cover_url     = Column(String(500))
    display_order = Column(Integer, default=0)
    created_at    = Column(String)

    playlists = relationship("Playlist", back_populates="live")


class Playlist(Base):
    __tablename__ = "playlists"

    id          = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title       = Column(String, nullable=False)
    description = Column(Text)
    cover_url   = Column(String)
    is_public   = Column(Integer, default=1)  # 1=public, 0=private
    created_at  = Column(String)
    updated_at  = Column(String)
    live_id             = Column(Integer, ForeignKey("official_lives.id"), nullable=True)
    live_display_order  = Column(Integer, default=0)

    user      = relationship("User")
    songs     = relationship("PlaylistSong", back_populates="playlist",
                             order_by="PlaylistSong.position", cascade="all, delete-orphan")
    favorites = relationship("PlaylistFavorite", back_populates="playlist",
                             cascade="all, delete-orphan")
    live      = relationship("OfficialLive", back_populates="playlists")

class PlaylistSong(Base):
    __tablename__ = "playlist_songs"

    playlist_id = Column(Integer, ForeignKey("playlists.id"), primary_key=True)
    song_id     = Column(Integer, ForeignKey("songs.id"), primary_key=True)
    position    = Column(Integer, default=0, nullable=False)
    added_at    = Column(String)

    playlist = relationship("Playlist", back_populates="songs")
    song     = relationship("Song")

class PlaylistFavorite(Base):
    __tablename__ = "playlist_favorites"

    playlist_id = Column(Integer, ForeignKey("playlists.id"), primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), primary_key=True)

    playlist = relationship("Playlist", back_populates="favorites")
    user     = relationship("User")

class SongComment(Base):
    __tablename__ = "song_comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    song_id = Column(Integer, ForeignKey("songs.id"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(String, nullable=False)
    updated_at = Column(String)

    user = relationship("User")
    song = relationship("Song")

class SiteView(Base):
    __tablename__ = "site_views"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    page_name = Column(String, index=True, nullable=False)
    ip_address = Column(String, nullable=False)
    created_at = Column(String, nullable=False)

class RankingCache(Base):
    __tablename__ = "ranking_cache"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    cache_key = Column(String, unique=True, index=True, nullable=False)
    data = Column(Text, nullable=False)
    updated_at = Column(String, nullable=False)

class StatisticCache(Base):
    __tablename__ = "statistic_cache"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cache_key = Column(String, unique=True, index=True, nullable=False)
    data = Column(Text, nullable=False)
    updated_at = Column(String, nullable=False)
