import os
import sys
import json
import datetime
import pytz
from sqlalchemy import text
from sqlalchemy.orm import Session

# Allow running from root dir
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api.database import SessionLocal, engine
from api.models import Base, StatisticCache
from .core import log_message


# ──────────────────────────────────────────────
#  SQL Queries (mirrors api/routers/statistics.py)
# ──────────────────────────────────────────────

_SQL_OVER_TIME = """
    SELECT
        CASE
            WHEN LENGTH(s.publish_date) >= 7
            THEN SUBSTR(s.publish_date, 1, 7)
            ELSE SUBSTR(s.publish_date, 1, 4) || '-01'
        END AS month,
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

_SQL_ENGINE_OVER_TIME = """
    SELECT
        CASE
            WHEN LENGTH(s.publish_date) >= 7
            THEN SUBSTR(s.publish_date, 1, 7)
            ELSE SUBSTR(s.publish_date, 1, 4) || '-01'
        END AS month,
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

_SQL_DISTRIBUTION = """
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

_SQL_RATIO_BY_RANGE = """
    WITH vocaloid_songs AS (
        SELECT DISTINCT s.id,
               s.youtube_views::float / s.niconico_views AS ratio,
               (s.youtube_views + s.niconico_views) AS total_views
        FROM songs s
        JOIN song_artists sa ON s.id = sa.song_id
        JOIN artists a ON sa.artist_id = a.id
        WHERE s.song_type IN ('Original', 'Remaster', 'Remix', 'Cover')
          AND a.artist_type IN ('Vocaloid', 'UTAU', 'CeVIO', 'SynthesizerV', 'Neutrino', 'VoiSona', 'OtherVoiceSynthesizer')
          AND s.youtube_views IS NOT NULL AND s.youtube_views > 0
          AND s.niconico_views IS NOT NULL AND s.niconico_views > 0
    ),
    bucketed AS (
        SELECT
            CASE
                WHEN total_views < 10000      THEN '<10K'
                WHEN total_views < 100000     THEN '10K–100K'
                WHEN total_views < 1000000    THEN '100K–1M'
                WHEN total_views < 10000000   THEN '1M–10M'
                ELSE '>10M'
            END AS range,
            CASE
                WHEN total_views < 10000      THEN 0
                WHEN total_views < 100000     THEN 1
                WHEN total_views < 1000000    THEN 2
                WHEN total_views < 10000000   THEN 3
                ELSE 4
            END AS ord,
            ratio
        FROM vocaloid_songs
    )
    SELECT
        range,
        ord,
        ROUND(AVG(ratio)::numeric, 2)                                          AS mean_ratio,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ratio)::numeric, 2)  AS median_ratio,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ratio)::numeric, 2)  AS p25_ratio,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ratio)::numeric, 2) AS p75_ratio,
        COUNT(*)                                                                AS count
    FROM bucketed
    GROUP BY range, ord
    ORDER BY ord
"""


# ──────────────────────────────────────────────
#  Data builders
# ──────────────────────────────────────────────

def build_over_time(db: Session) -> list:
    rows = db.execute(text(_SQL_OVER_TIME)).fetchall()
    return [{"date": r[0], "count": r[1]} for r in rows if r[0] >= "2000-01"]


def build_engine_over_time(db: Session) -> list:
    ENGINES = ("Vocaloid", "UTAU", "SynthesizerV", "CeVIO", "VoiSona", "OtherVoiceSynthesizer", "Neutrino")
    rows = db.execute(text(_SQL_ENGINE_OVER_TIME)).fetchall()

    data_map: dict = {}
    for row in rows:
        dl, engine, cnt = row[0], row[1], row[2]
        if dl not in data_map:
            data_map[dl] = {"date": dl, **{e: 0 for e in ENGINES}}
        if engine in data_map[dl]:
            data_map[dl][engine] = cnt

    result = list(data_map.values())
    result.sort(key=lambda x: x["date"])
    return [r for r in result if r["date"] >= "2000-01"]


def build_distribution(db: Session) -> list:
    rows = db.execute(text(_SQL_DISTRIBUTION)).fetchall()
    return [{"name": r[0], "value": r[1]} for r in rows]


def build_ratio_by_range(db: Session) -> list:
    rows = db.execute(text(_SQL_RATIO_BY_RANGE)).fetchall()
    return [
        {"range": r[0], "order": r[1], "mean": float(r[2]), "median": float(r[3]), "p25": float(r[4]), "p75": float(r[5]), "count": r[6]}
        for r in rows
    ]


# ──────────────────────────────────────────────
#  Cache persistence
# ──────────────────────────────────────────────

def save_statistic_cache(db: Session, cache_key: str, data: list):
    data_str = json.dumps(data)
    now_str = datetime.datetime.now(pytz.utc).isoformat()

    existing = db.query(StatisticCache).filter(StatisticCache.cache_key == cache_key).first()
    if existing:
        existing.data = data_str
        existing.updated_at = now_str
    else:
        db.add(StatisticCache(cache_key=cache_key, data=data_str, updated_at=now_str))
    db.commit()


# ──────────────────────────────────────────────
#  Main entry point
# ──────────────────────────────────────────────

def calculate_all():
    log_message("INFO", "Ensuring DB tables exist...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    log_message("INFO", "Starting vocaloid statistics aggregation...")

    try:
        log_message("INFO", "Computing: songs over time (monthly)")
        over_time = build_over_time(db)
        save_statistic_cache(db, "vocaloid_stats:over-time", over_time)
        log_message("INFO", f"  → {len(over_time)} monthly buckets stored.")

        log_message("INFO", "Computing: engine usage over time (monthly)")
        engine_over_time = build_engine_over_time(db)
        save_statistic_cache(db, "vocaloid_stats:engine-over-time", engine_over_time)
        log_message("INFO", f"  → {len(engine_over_time)} monthly engine rows stored.")

        log_message("INFO", "Computing: voicebank distribution")
        distribution = build_distribution(db)
        save_statistic_cache(db, "vocaloid_stats:distribution", distribution)
        log_message("INFO", f"  → {len(distribution)} distribution entries stored.")

        log_message("INFO", "Computing: YouTube vs NicoNico ratio by total views range")
        ratio_by_range = build_ratio_by_range(db)
        save_statistic_cache(db, "vocaloid_stats:view-ratio-by-range", ratio_by_range)
        log_message("INFO", f"  → {len(ratio_by_range)} view range buckets stored.")

        log_message("SUCCESS", "Vocaloid statistics cache committed to statistic_cache table.")
    except Exception as e:
        log_message("ERROR", f"Critical error during aggregation: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    calculate_all()
