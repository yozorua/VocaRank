from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..database import get_db
from ..cache import cache_lock # Will implement discrete manual caching here

router = APIRouter(
    prefix="/statistics",
    tags=["statistics"],
)

# In-memory application cache specifically for these heavy analytical queries
STATS_CACHE = {}

@router.get("/vocaloids/over-time")
def get_vocaloids_over_time(db: Session = Depends(get_db)):
    """
    Returns the count of valid vocaloid songs grouped by their publish month (YYYY-MM).
    """
    with cache_lock:
        if "over-time-monthly" in STATS_CACHE:
            return STATS_CACHE["over-time-monthly"]

    sql = """
        SELECT CASE WHEN LENGTH(s.publish_date) >= 7 THEN SUBSTR(s.publish_date, 1, 7) ELSE SUBSTR(s.publish_date, 1, 4) || '-01' END AS month,
               COUNT(DISTINCT s.id) AS count
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        JOIN artists a ON sa.artist_id = a.id
        WHERE s.publish_date IS NOT NULL
          AND LENGTH(s.publish_date) >= 4
          AND s.song_type IN ('Original', 'Remaster', 'Remix', 'Cover')
          AND a.artist_type IN ('Vocaloid', 'UTAU', 'CeVIO', 'SynthesizerV', 'Neutrino', 'VoiSona', 'OtherVoiceSynthesizer')
        GROUP BY month
        ORDER BY month ASC
    """
    
    rows = db.execute(text(sql)).fetchall()
    result = [{"date": r[0], "count": r[1]} for r in rows if r[0] >= "2000-01"]

    with cache_lock:
        STATS_CACHE["over-time-monthly"] = result

    return result

@router.get("/vocaloids/engine-over-time")
def get_vocaloids_engine_over_time(db: Session = Depends(get_db)):
    """
    Returns the distribution of engine usage grouped by publish month (YYYY-MM).
    """
    with cache_lock:
        if "engine-over-time-monthly" in STATS_CACHE:
            return STATS_CACHE["engine-over-time-monthly"]

    sql = """
        SELECT CASE WHEN LENGTH(s.publish_date) >= 7 THEN SUBSTR(s.publish_date, 1, 7) ELSE SUBSTR(s.publish_date, 1, 4) || '-01' END AS month,
               a.artist_type AS engine,
               COUNT(DISTINCT s.id) AS count
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        JOIN artists a ON sa.artist_id = a.id
        WHERE s.publish_date IS NOT NULL
          AND LENGTH(s.publish_date) >= 4
          AND s.song_type IN ('Original', 'Remaster', 'Remix', 'Cover')
          AND a.artist_type IN ('Vocaloid', 'UTAU', 'CeVIO', 'SynthesizerV', 'Neutrino', 'VoiSona', 'OtherVoiceSynthesizer')
        GROUP BY month, engine
        ORDER BY month ASC
    """
    
    rows = db.execute(text(sql)).fetchall()
    
    data_map = {}
    for row in rows:
        dl, engine, cnt = row[0], row[1], row[2]
        if dl not in data_map:
            data_map[dl] = {"date": dl, "Vocaloid": 0, "UTAU": 0, "SynthesizerV": 0, "CeVIO": 0, "VoiSona": 0, "OtherVoiceSynthesizer": 0, "Neutrino": 0}
        data_map[dl][engine] = cnt
        
    result = list(data_map.values())
    result.sort(key=lambda x: x["date"])
    result = [r for r in result if r["date"] >= "2000-01"]

    with cache_lock:
        STATS_CACHE["engine-over-time-monthly"] = result

    return result

@router.get("/vocaloids/distribution")
def get_vocaloids_distribution(db: Session = Depends(get_db)):
    """
    Returns the sum distributions of specific voicebank engines.
    Categorizes the 'artist_type' metrics across valid songs.
    """
    with cache_lock:
        if "distribution" in STATS_CACHE:
            return STATS_CACHE["distribution"]

    sql = """
        SELECT a.artist_type AS type,
               COUNT(DISTINCT s.id) AS count
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        JOIN artists a ON sa.artist_id = a.id
        WHERE s.song_type IN ('Original', 'Remaster', 'Remix', 'Cover')
          AND a.artist_type IN ('Vocaloid', 'UTAU', 'CeVIO', 'SynthesizerV', 'Neutrino', 'VoiSona', 'OtherVoiceSynthesizer')
        GROUP BY type
        ORDER BY count DESC
    """
    
    rows = db.execute(text(sql)).fetchall()
    metrics = [{"name": r[0], "value": r[1]} for r in rows]

    with cache_lock:
        STATS_CACHE["distribution"] = metrics

    return metrics
