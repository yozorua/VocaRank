# VocaRank

**VocaRank** is the most comprehensive and modern ranking platform for Vocaloid music — tracking real-time view counts across NicoNico and YouTube, aggregating daily snapshots, and delivering up-to-date rankings for songs featuring Vocaloid, SynthesizerV, UTAU, CeVIO, and every major vocal synthesizer. Built with a full data pipeline, multi-locale support, and a rich community layer, VocaRank is the most advanced Vocaloid ranking website available today.

Live site: **[vocarank.live](https://vocarank.live)**

<table>
  <tr>
    <td><img src="docs/screenshots/s1.png"/></td>
    <td><img src="docs/screenshots/s2.png"/></td>
    <td><img src="docs/screenshots/s3.png"/></td>
    <td><img src="docs/screenshots/s4.png"/></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/s5.png"/></td>
    <td><img src="docs/screenshots/s6.png"/></td>
    <td><img src="docs/screenshots/s7.png"/></td>
    <td><img src="docs/screenshots/s8.png"/></td>
  </tr>
</table>

---

## Features

- **Rankings** — Daily, weekly, and monthly gain rankings; all-time rankings; filterable by vocalist type
- **Trending** — Rising songs with accelerating view growth
- **Song & Artist pages** — Metadata, view history charts, mood voting, comments, and PV embeds
- **Statistics** — Vocaloid ecosystem analytics, producer collaboration network, vocalist network graph
- **Playlists** — User-created playlists; curated Official Lives collections (admin)
- **Favorites** — Bookmark songs and artists to your profile
- **Search** — Full-text search across songs and artists
- **Player** — Queue-based YouTube player in a dedicated tab
- **Reports & Roadmap** — Community bug reports and feature requests with upvoting
- **User profiles** — Google OAuth sign-in, avatar upload, social links, editor roles
- **Internationalization** — English, 繁體中文, 日本語, العربية, Español

---

## Tech Stack

[![Tech Stack](https://skillicons.dev/icons?i=nextjs,react,ts,tailwind,fastapi,py,postgres)](https://skillicons.dev)

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, next-intl |
| Backend | FastAPI (Python), Uvicorn |
| Database | PostgreSQL 16 |
| Auth | Google OAuth (NextAuth) + FastAPI JWT (7-day tokens) |
| Charts | Recharts, D3-force, react-player |
| Data pipeline | Python + psycopg2, VocaDB API, YouTube Data API v3 |

---

## Repository Structure

```
VocaRank/
├── api/                  # FastAPI backend
│   ├── main.py           # App entry point, router registration
│   ├── models.py         # SQLAlchemy ORM models
│   ├── routers/          # songs, artists, rankings, auth, favorites,
│   │                     #   votes, statistics, playlists, official_lives, about
│   ├── cache.py          # In-memory TTLCache singletons (1-hour TTL)
│   └── utils.py          # SYNTH_TYPES, shared helpers
├── scripts/              # Data pipeline (run as Python modules from root)
│   ├── core.py           # Shared DB connection, VocaDB API helpers
│   ├── fetch_new.py      # Pull new songs/artists from VocaDB
│   ├── update_existing.py# Rolling metadata refresh
│   ├── fetch_views.py    # YouTube + NicoNico view counts + daily snapshots
│   ├── calculate_rankings_cache.py        # Pre-warm ranking_cache table
│   ├── calculate_vocaloid_stats_cache.py  # Pre-warm statistic_cache table
│   └── calculate_network_graph.py         # Producer/vocalist collaboration graphs
├── website/              # Next.js frontend
│   ├── src/app/[locale]/ # Pages: ranking, search, song, artist, player,
│   │                     #        favorites, playlist, profile, statistic,
│   │                     #        trending, about, login
│   ├── src/lib/api.ts    # All FastAPI call wrappers
│   ├── src/i18n/         # next-intl routing + request helpers
│   └── messages/         # Translation files (en, zh-TW, ja, ar, es)
├── docs/                 # Detailed guides
│   ├── deployment.md     # Production setup (Ubuntu, systemd, NGINX, cron)
│   ├── database.md       # Schema, size estimates, tuning, backups
│   └── admin.md          # Admin/editor roles, Official Lives
├── run_vocarank.sh       # Wrapper for all data pipeline commands
├── database_backup.sh    # PostgreSQL dump + rotation script
├── crontab.example       # Reference crontab for production
└── .env.example          # Environment variable template
```

---

## Local Development

### Prerequisites

- Python 3.11+, Node.js 20+, PostgreSQL 16
- A `.env` file at the repo root (copy from `.env.example`)

### Setup

```bash
git clone <repo-url> VocaRank
cd VocaRank
cp .env.example .env
# Fill in all values (see Environment Configuration below)

# Python dependencies
pip3 install -r requirements.txt
pip3 install Pillow

# Frontend dependencies
cd website && npm install && ln -sf ../.env .env.local && cd ..
```

### Start services

```bash
# Terminal 1 — FastAPI (http://localhost:8000/docs)
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Next.js (http://localhost:3000)
cd website && npm run dev
```

Kill and restart both: `fuser -k 3000/tcp; fuser -k 8000/tcp`

---

## Environment Configuration

| Variable | Description |
|---|---|
| `DATABASE_URL` | `postgresql://vocarank:<password>@localhost/vocarank` |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret |
| `AUTH_SECRET` | 32-char random string — `openssl rand -base64 32` (NextAuth) |
| `JWT_SECRET` | 32-char random string — `openssl rand -base64 32` (FastAPI JWT) |
| `NEXTAUTH_URL` | Base URL of the site (e.g. `https://vocarank.live`) |
| `YOUTUBE_KEYS_GENERAL` | Comma-separated YouTube Data API v3 keys (all-song updates) |
| `YOUTUBE_KEYS_POPULAR` | Comma-separated YouTube API keys (frequent popular-song updates) |

Google OAuth: set the Authorized JavaScript origin to your domain and the redirect URI to `<domain>/api/auth/callback/google`.

---

## Data Pipeline

All commands log to `logs/cron.log`. Run from the repo root.

```bash
./run_vocarank.sh fetch-new                             # Pull new songs/artists from VocaDB
./run_vocarank.sh update-existing --songs 20000         # Refresh old song metadata (rolling)
./run_vocarank.sh update-existing --newest-songs 20000  # Refresh recently-added songs
./run_vocarank.sh update-existing --artists 10000       # Refresh artist profiles (rolling)
./run_vocarank.sh update-existing --song <id>           # Force-update a single song
./run_vocarank.sh views all                             # Fetch all-song views + daily snapshot
./run_vocarank.sh views popular                         # Fetch popular-song views only
./run_vocarank.sh views-song <id>                       # Fetch views for one song
./run_vocarank.sh rankings                              # Pre-warm ranking_cache table
./run_vocarank.sh vocaloid-stats                        # Pre-warm statistic_cache table
```

---

## Further Reading

- [Deployment Guide](docs/deployment.md) — Ubuntu setup, systemd services, NGINX, SSL, cron jobs
- [Database](docs/database.md) — Schema, size & growth estimates, PostgreSQL tuning, backups
- [Admin & Editor Guide](docs/admin.md) — Granting roles, Official Lives, announcements
- [VocaDB](https://vocadb.net) — Song and artist metadata is sourced from VocaDB, a community-maintained Vocaloid music database

---

## Contact

For contributions, research inquiries, or data collaboration, reach out at:

**vocaloid.rankings@gmail.com**
