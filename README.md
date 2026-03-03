# VocaRank
雑魚

## Database Updater
The `src/update_db.py` script is the core updater for the VocaRank database. It handles fetching new songs from VocaDB and refreshing existing ones while preserving local view counts.

### Usage

**1. Standard Update (Cron Mode)**
Fetches new songs and refreshes a batch of old songs (default 10,000).
```bash
python3 src/update_db.py
# or explicitly
python3 src/update_db.py --cron
```
*   **Fetches New:** Gets the latest songs added to VocaDB.
*   **Refreshes Old:** Automatically picks the 10,000 songs that haven't been updated for the longest time and refreshes their metadata from VocaDB.

**2. Update Specific Song**
Force update a single song by its VocaDB ID.
```bash
python3 src/update_db.py --song <ID>
# Example: python3 src/update_db.py --song 12345
```

**3. Custom Refresh Limit**
Control how many old songs are refreshed in a single run.
```bash
python3 src/update_db.py --limit 5000
```

## API
To launch the API, run the following command:
```bash
uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```
And access the API at http://localhost:8000/docs

## Environment Configuration
VocaRank requires some environment variables to connect to third-party services like Google OAuth.

**1. Copy the example file:**
```bash
cp .env.example .env
```

**2. Fill in the Auth Credentials:**
Open `.env` and configure the following keys for the Account System:

*   `AUTH_GOOGLE_ID`: Your Google OAuth Client ID (from [Google Cloud Console](https://console.cloud.google.com/)).
    *   *Note: Ensure your Authorized JavaScript origin is `https://vocarank.live` and your Authorized redirect URI is `https://vocarank.live/api/auth/callback/google`.*
*   `AUTH_GOOGLE_SECRET`: Your Google OAuth Client Secret.
*   `AUTH_SECRET`: Used by NextAuth to sign session tokens. Generate a random 32-character string using `openssl rand -base64 32`.
*   `JWT_SECRET`: Used by FastAPI to sign VocaRank API tokens. Generate another random 32-character string using `openssl rand -base64 32`.

## Re-open process
```bash
fuser -k 3000/tcp; fuser -k 8000/tcp
npm run dev
uvicorn api.main:app --reload --port 8000
```

---

## Deployment (Ubuntu VM)

This section covers a fresh production deployment on Ubuntu 24.04.

### 1. System Packages

```bash
sudo apt update && sudo apt upgrade -y

# Python, pip, venv
sudo apt install -y python3 python3-pip python3-venv python3-dev

# Node.js 20+ (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib

# NGINX
sudo apt install -y nginx

# Build tools (needed for some Python packages)
sudo apt install -y build-essential libpq-dev
```

### 2. Clone the Repository

```bash
git clone <repo-url> /opt/vocarank
cd /opt/vocarank
```

### 3. Environment Configuration

```bash
cp .env.example .env
```

Open `.env` and fill in all values:

| Key | Description |
|-----|-------------|
| `DATABASE_URL` | `postgresql://vocarank:<password>@localhost/vocarank` |
| `AUTH_GOOGLE_ID` | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret |
| `AUTH_SECRET` | Random 32-char string — `openssl rand -base64 32` |
| `JWT_SECRET` | Random 32-char string — `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://vocarank.live` |
| `YOUTUBE_KEYS_GENERAL` | Comma-separated YouTube API keys (general updates) |
| `YOUTUBE_KEYS_POPULAR` | Comma-separated YouTube API keys (popular songs) |

### 4. Database Setup

**Create the PostgreSQL user and database:**

```bash
sudo -u postgres psql <<'EOF'
CREATE USER vocarank WITH PASSWORD '<your_password>';
CREATE DATABASE vocarank OWNER vocarank;
\q
EOF
```

**Initialize the schema** (creates all tables via SQLAlchemy):

```bash
python3 - <<'EOF'
from api.database import engine, Base
import api.models
Base.metadata.create_all(bind=engine)
print("Schema created.")
EOF
```

> If restoring from a dump instead, use:
> ```bash
> pg_restore -d vocarank -U vocarank -h localhost /path/to/vocarank_backup.dump
> ```

### 5. Python Backend Setup

```bash
pip3 install -r requirements.txt
pip3 install Pillow   # used by api/routers/auth.py (not in requirements.txt)
```

### 6. Frontend Setup

```bash
cd website
npm install
npm run build

# Symlink .env.local → root .env (if not already present)
ln -sf ../.env .env.local

cd ..
```

### 7. Systemd Services

Create service files so both processes start on boot and restart automatically.

**FastAPI backend — `/etc/systemd/system/vocarank-api.service`:**

```ini
[Unit]
Description=VocaRank FastAPI Backend
After=network.target postgresql.service

[Service]
Type=simple
User=<your-user>
WorkingDirectory=/opt/vocarank
ExecStart=/usr/bin/python3 -m uvicorn api.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Next.js frontend — `/etc/systemd/system/vocarank-web.service`:**

```ini
[Unit]
Description=VocaRank Next.js Frontend
After=network.target vocarank-api.service

[Service]
Type=simple
User=<your-user>
WorkingDirectory=/opt/vocarank/website
ExecStart=/usr/bin/node node_modules/.bin/next start --port 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start both:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vocarank-api vocarank-web
```

### 8. NGINX Configuration

Create `/etc/nginx/sites-available/vocarank`:

```nginx
server {
    listen 80;
    server_name vocarank.live www.vocarank.live;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name vocarank.live www.vocarank.live;

    # SSL certificates (e.g. from Certbot)
    ssl_certificate     /etc/letsencrypt/live/vocarank.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vocarank.live/privkey.pem;

    client_max_body_size 10M;

    # Proxy everything to Next.js (which internally proxies /api/* to FastAPI)
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/vocarank /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**SSL certificate** (via Certbot):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d vocarank.live -d www.vocarank.live
```

### 9. Cron Jobs (Data Pipeline)

Add to crontab (`crontab -e`) for automated data updates:

```cron
# Fetch new songs from VocaDB — once daily at 3:00 AM
0 3 * * * cd /opt/vocarank && ./run_vocarank.sh fetch-new

# Refresh existing song metadata — once daily at 4:00 AM
0 4 * * * cd /opt/vocarank && ./run_vocarank.sh update-existing --songs 10000

# Fetch view counts for all songs — once daily at 5:00 AM
0 5 * * * cd /opt/vocarank && ./run_vocarank.sh views all

# Pre-warm ranking cache — once daily at 7:00 AM (after views fetch completes)
0 7 * * * cd /opt/vocarank && ./run_vocarank.sh rankings

# Pre-warm vocaloid stats cache — once daily at 7:30 AM
30 7 * * * cd /opt/vocarank && ./run_vocarank.sh vocaloid-stats

# Daily database backup — midnight, keep 14 days
0 0 * * * cd /opt/vocarank && ./database_backup.sh --daily-dump /opt/vocarank-backups
```

### 10. PostgreSQL Tuning

PostgreSQL ships with conservative defaults tuned for minimal hardware. For production use, write a drop-in config so the main `postgresql.conf` stays untouched:

```bash
sudo nano /etc/postgresql/16/main/conf.d/vocarank.conf
```

Paste the settings below for your RAM tier, then restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

**Settings by RAM tier (SSD assumed; 16-core+ CPU):**

| Setting | 16 GB RAM | 64 GB RAM | Notes |
|---|---|---|---|
| `shared_buffers` | `4GB` | `16GB` | 25% of RAM. PostgreSQL's own buffer pool — the #1 setting. Without this, every parallel worker re-reads the same data through the OS page cache. **Requires restart.** |
| `effective_cache_size` | `12GB` | `48GB` | 75% of RAM. Planner hint only — no memory is allocated. Influences index vs. seq scan decisions. |
| `work_mem` | `32MB` | `64MB` | Memory per sort/hash op per worker. Peak usage = `max_parallel_workers × 2 ops × work_mem`. |
| `maintenance_work_mem` | `512MB` | `2GB` | Used by VACUUM, CREATE INDEX, `pg_dump`. |
| `wal_buffers` | `64MB` | `64MB` | Diminishing returns above 64 MB. |
| `max_worker_processes` | `8` | `16` | Total background + parallel workers. **Requires restart.** |
| `max_parallel_workers` | `4` | `8` | Hard system-wide cap on parallel query workers. Prevents cron jobs from spawning unbounded workers during heavy ranking queries. |
| `max_parallel_workers_per_gather` | `2` | `4` | Workers per single query plan node. |
| `checkpoint_completion_target` | `0.9` | `0.9` | Spreads checkpoint I/O over 90% of the interval, reducing spikes. |
| `max_wal_size` | `2GB` | `4GB` | Reduces checkpoint frequency under write load. |
| `min_wal_size` | `128MB` | `256MB` | |
| `random_page_cost` | `1.1` | `1.1` | Default 4.0 is for spinning disk. SSD random reads ≈ sequential — lower value encourages index use. Set to `4.0` if using HDD. |
| `effective_io_concurrency` | `200` | `200` | Parallel prefetch for bitmap scans. Use `1` for HDD. |

**16 GB config:**

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

**64 GB config:**

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

**Verify settings loaded after restart:**

```bash
sudo -u postgres psql -c "SHOW shared_buffers; SHOW work_mem; SHOW max_parallel_workers;"
```

> **Connecting as the vocarank user** requires `-h localhost` to force TCP (password auth) since peer auth checks the Linux username:
> ```bash
> psql -U vocarank -d vocarank -h localhost -c "SHOW shared_buffers;"
> ```

### 11. Verify Deployment

```bash
# Check services are running
sudo systemctl status vocarank-api vocarank-web

# Test API health
curl http://127.0.0.1:8000/health

# Check logs
journalctl -u vocarank-api -f
journalctl -u vocarank-web -f
```

---

## Admin Setup

### Granting Admin Access

The `is_admin` flag on the `users` table controls access to Official Lives management and playlist assignment on the site.

**1. Find your user record:**

```bash
psql -U vocarank -d vocarank -h localhost -c \
  "SELECT id, email, name FROM users ORDER BY created_at LIMIT 10;"
```

**2. Grant admin rights to an account:**

```bash
psql -U vocarank -d vocarank -h localhost -c \
  "UPDATE users SET is_admin = true WHERE email = 'your@email.com';"
```

**3. Sign out and sign back in** — the `isAdmin` flag is baked into the NextAuth JWT at login time, so an active session won't pick up the change until re-authentication.

> **Note:** The `-h localhost` flag forces TCP connection (password auth). Without it, `psql` uses peer auth and will reject the `vocarank` user. You will be prompted for the DB password from `.env`.

### What admins can do

- **Official Lives** — Create, edit, delete curated concert/event collections on the Playlist page
- **Assign playlists** — Link any public playlist to an Official Live from the live's detail page
- **Unassign playlists** — Remove a playlist from a live (playlist remains public in Browse)

### Running the Official Lives migration (already applied)

If setting up from scratch on a new DB, run this after `Base.metadata.create_all`:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS official_lives (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    cover_url VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE playlists ADD COLUMN IF NOT EXISTS live_id INTEGER
    REFERENCES official_lives(id) ON DELETE SET NULL;
```