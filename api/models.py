from sqlalchemy import Column, Integer, String, Text, ForeignKey, Table
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
    length_seconds = Column(Integer)
    # artist_ids stored as JSON string in legacy column, but we have song_artists table now
    publish_date = Column(String)
    original_song_id = Column(Integer)
    pv_data = Column(Text) # JSON
    tag_ids = Column(Text) # JSON
    niconico_views = Column(Integer)
    youtube_views = Column(Integer)
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

    songs = relationship("Song", secondary=song_artists, back_populates="artists")
