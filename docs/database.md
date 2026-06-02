# Database

## Schema

| Table | Description |
|---|---|
| `songs` | VocaDB metadata + `niconico_views`, `youtube_views`, `pv_data`, `tag_ids` |
| `artists` | VocaDB artist profiles; `artist_type` distinguishes vocalists from producers |
| `song_artists` | Many-to-many join |
| `daily_snapshots` | Per-song per-day view counts — primary source for all gain rankings |
| `ranking_cache` | Pre-computed ranking JSON, keyed by parameter combos |
| `statistic_cache` | Pre-computed statistics JSON (vocaloid charts, ecosystem data) |
| `song_votes` | IP-based mood votes (`happy`, `sad`, `love`, `chaos`, `chill`, `emotional`) |
| `song_comments` | User comments on songs |
| `user_favorite_songs` / `user_favorite_artists` | Per-user bookmarks |
| `playlists` / `playlist_songs` / `playlist_favorites` | User-created playlists |
| `official_lives` | Admin-curated concert/event collections |
| `users` / `oauth_accounts` | User accounts (Google OAuth) |
| `announcements` / `roadmap_items` | Site-managed content |
| `reports` / `report_upvotes` | Community bug/feature reports |
| `about_contributors` | Contributors listed on the About page |
| `site_views` | Page-level visit tracking |

## Size and Growth

The `daily_snapshots` table appends one row per tracked song per day and is the primary growth driver. Based on production backups (June 2026):

| Metric | Value |
|---|---|
| Compressed dump size | ~3.5 GB |
| Estimated uncompressed DB size | ~10–15 GB |
| Compressed backup growth | ~30 MB / day |
| Estimated actual data growth | ~100–150 MB / day |
| Projected annual growth (uncompressed) | ~40–55 GB |

Plan for at least **60 GB** of storage for the database volume if running for a full year without pruning snapshot history.

## Backups

`database_backup.sh` creates a `pg_dump` archive and handles 14-day rotation automatically:

```bash
./database_backup.sh --daily-dump /path/to/backups
```

Files are named `vocarank_backup_YYYYMMDD.dump`. See `crontab.example` for the scheduled backup job.

## PostgreSQL Tuning

Write a drop-in config so the main `postgresql.conf` stays untouched:

```bash
sudo nano /etc/postgresql/16/main/conf.d/vocarank.conf
sudo systemctl restart postgresql
```

**16 GB RAM / SSD:**

```conf
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 32MB
maintenance_work_mem = 512MB
wal_buffers = 64MB
max_worker_processes = 8
max_parallel_workers = 4
max_parallel_workers_per_gather = 2
checkpoint_completion_target = 0.9
max_wal_size = 2GB
min_wal_size = 128MB
random_page_cost = 1.1
effective_io_concurrency = 200
```

**64 GB RAM / SSD:**

```conf
shared_buffers = 16GB
effective_cache_size = 48GB
work_mem = 64MB
maintenance_work_mem = 2GB
wal_buffers = 64MB
max_worker_processes = 16
max_parallel_workers = 8
max_parallel_workers_per_gather = 4
checkpoint_completion_target = 0.9
max_wal_size = 4GB
min_wal_size = 256MB
random_page_cost = 1.1
effective_io_concurrency = 200
```

> Set `random_page_cost = 4.0` and `effective_io_concurrency = 1` if using spinning-disk storage.

Verify settings loaded after restart:

```bash
sudo -u postgres psql -c "SHOW shared_buffers; SHOW work_mem; SHOW max_parallel_workers;"
# Connect as the vocarank user (requires -h localhost to force TCP / password auth):
psql -U vocarank -d vocarank -h localhost -c "SHOW shared_buffers;"
```
