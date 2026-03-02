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

### 10. Verify Deployment

```bash
# Check services are running
sudo systemctl status vocarank-api vocarank-web

# Test API health
curl http://127.0.0.1:8000/health

# Check logs
journalctl -u vocarank-api -f
journalctl -u vocarank-web -f
```