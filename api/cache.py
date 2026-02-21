"""
api/cache.py — Shared in-memory TTL cache for expensive API endpoints.

Uses cachetools.TTLCache:
  - maxsize: max number of distinct cache keys stored
  - ttl: seconds to keep each entry

Cache instances are module-level singletons — they persist for the
lifetime of the FastAPI process and are shared across all requests.

To invalidate manually (e.g. after a data update), call:
    ranking_cache.clear()
    song_dates_cache.clear()
"""
from cachetools import TTLCache
import threading

# 1-hour TTL — rankings update daily, song-date counts change only
# when new songs are imported. Both are safe to cache for 1 hour.
TTL = 3600

# Rankings cache: key = (mode, sort_by, limit, song_type, vocaloid_only)
# 50 distinct combos × ~10 KB each ≈ <1 MB
ranking_cache: TTLCache = TTLCache(maxsize=50, ttl=TTL)

# Song-dates (year-count histogram) cache: key = artist_id
# ~5 000 distinct artists, each entry is tiny (20 year buckets)
song_dates_cache: TTLCache = TTLCache(maxsize=5000, ttl=TTL)

# Thread lock — FastAPI can handle concurrent requests; TTLCache is not thread-safe
cache_lock = threading.Lock()
