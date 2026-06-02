"""
One-off script to backfill missing daily_snapshots for 2026-05-20 and 2026-05-21.

May 20: uses the history entry closest to 00:01 UTC (= 08:01 UTC+8, the normal cron time).
        Searches the window 2026-05-19 20:00 UTC – 2026-05-20 06:00 UTC.
May 21: uses the latest history entry available on that day.
Fallback for songs with no history in range: copies the nearest prior snapshot.

Everything runs in SQL to avoid shipping 900K rows of JSON to Python.
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()


MAY20_TARGET   = "2026-05-20T00:01:00+00:00"
MAY20_WIN_LO   = "2026-05-19T20:00:00+00:00"
MAY20_WIN_HI   = "2026-05-20T06:00:00+00:00"
MAY21_WIN_LO   = "2026-05-21T00:00:00+00:00"
MAY21_WIN_HI   = "2026-05-21T23:59:59+00:00"


def run(cur, label: str, insert_date: str, sql: str, params: tuple):
    print(f"{label}: computing best history entries in PostgreSQL…", flush=True)
    cur.execute(sql, params)
    rows = cur.fetchall()
    print(f"{label}: inserting {len(rows)} rows…", flush=True)
    inserted = 0
    for row in rows:
        cur.execute(
            """
            INSERT INTO daily_snapshots (date, song_id, niconico_views, youtube_views)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (date, song_id) DO NOTHING
            """,
            (insert_date, row[0], row[1], row[2]),
        )
        inserted += cur.rowcount
    print(f"{label}: inserted {inserted} new rows.", flush=True)


# For a given date window, pick the entry closest to `target` (May 20)
# or the latest entry in window (May 21) — controlled by the ORDER BY passed in.
def build_query(win_lo: str, win_hi: str, order_expr: str, fallback_date: str) -> str:
    return f"""
        WITH nico_cands AS (
            SELECT s.id AS song_id,
                   (entry->>'views')::bigint AS views,
                   (entry->>'date')::timestamptz AS ts
            FROM songs s,
                 jsonb_array_elements(s.niconico_history::jsonb) AS entry
            WHERE (entry->>'date')::timestamptz BETWEEN %s AND %s
        ),
        yt_cands AS (
            SELECT s.id AS song_id,
                   (entry->>'views')::bigint AS views,
                   (entry->>'date')::timestamptz AS ts
            FROM songs s,
                 jsonb_array_elements(s.youtube_history::jsonb) AS entry
            WHERE (entry->>'date')::timestamptz BETWEEN %s AND %s
        ),
        best_nico AS (
            SELECT DISTINCT ON (song_id) song_id, views
            FROM nico_cands
            ORDER BY song_id, {order_expr}
        ),
        best_yt AS (
            SELECT DISTINCT ON (song_id) song_id, views
            FROM yt_cands
            ORDER BY song_id, {order_expr}
        ),
        fallback AS (
            SELECT song_id, niconico_views, youtube_views
            FROM daily_snapshots
            WHERE date = '{fallback_date}'
        )
        SELECT
            s.id,
            COALESCE(bn.views, fb.niconico_views) AS niconico_views,
            COALESCE(by.views, fb.youtube_views)  AS youtube_views
        FROM songs s
        LEFT JOIN best_nico bn ON bn.song_id = s.id
        LEFT JOIN best_yt   by ON by.song_id = s.id
        LEFT JOIN fallback  fb ON fb.song_id = s.id
        WHERE COALESCE(bn.views, fb.niconico_views) IS NOT NULL
          AND COALESCE(by.views, fb.youtube_views)  IS NOT NULL
    """


def main():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()

    # May 20: closest entry to 00:01 UTC in the ±6h window around midnight
    may20_order = "ABS(EXTRACT(EPOCH FROM (ts - '2026-05-20T00:01:00+00:00'::timestamptz)))"
    may20_sql = build_query(MAY20_WIN_LO, MAY20_WIN_HI, may20_order, "2026-05-19")
    run(cur, "May 20", "2026-05-20", may20_sql,
        (MAY20_WIN_LO, MAY20_WIN_HI, MAY20_WIN_LO, MAY20_WIN_HI))
    conn.commit()

    # May 21: latest available entry on that day; fall back to May 20 snapshot
    may21_order = "ts DESC"
    may21_sql = build_query(MAY21_WIN_LO, MAY21_WIN_HI, may21_order, "2026-05-20")
    run(cur, "May 21", "2026-05-21", may21_sql,
        (MAY21_WIN_LO, MAY21_WIN_HI, MAY21_WIN_LO, MAY21_WIN_HI))
    conn.commit()

    print("Analyzing daily_snapshots…", flush=True)
    cur.execute("ANALYZE daily_snapshots")
    conn.commit()
    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
