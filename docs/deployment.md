# Deployment Guide

Production deployment on Ubuntu 24.04.

## 1. System Packages

```bash
sudo apt update && sudo apt upgrade -y

sudo apt install -y python3 python3-pip python3-venv python3-dev build-essential libpq-dev
sudo apt install -y postgresql postgresql-contrib nginx

# Node.js 20+ via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. Clone and Configure

```bash
git clone <repo-url> /opt/vocarank
cd /opt/vocarank
cp .env.example .env
# Fill in all values — see Environment Configuration in README
```

## 3. Database Setup

```bash
sudo -u postgres psql <<'EOF'
CREATE USER vocarank WITH PASSWORD '<your_password>';
CREATE DATABASE vocarank OWNER vocarank;
EOF

# Initialize schema
python3 - <<'EOF'
from api.database import engine, Base
import api.models
Base.metadata.create_all(bind=engine)
print("Schema created.")
EOF
```

> To restore from a production dump instead:
> ```bash
> pg_restore -d vocarank -U vocarank -h localhost /path/to/vocarank_backup.dump
> ```

## 4. Python Backend

```bash
pip3 install -r requirements.txt
pip3 install Pillow    # used by api/routers/auth.py; not in requirements.txt
```

## 5. Frontend Build

```bash
cd website
npm install
ln -sf ../.env .env.local
npm run build
cd ..
```

## 6. Systemd Services

**`/etc/systemd/system/vocarank-api.service`**

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

**`/etc/systemd/system/vocarank-web.service`**

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

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vocarank-api vocarank-web
```

## 7. NGINX + SSL

**`/etc/nginx/sites-available/vocarank`**

```nginx
server {
    listen 80;
    server_name vocarank.live www.vocarank.live;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name vocarank.live www.vocarank.live;

    ssl_certificate     /etc/letsencrypt/live/vocarank.live/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vocarank.live/privkey.pem;

    client_max_body_size 10M;

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

```bash
sudo ln -s /etc/nginx/sites-available/vocarank /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL via Certbot
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d vocarank.live -d www.vocarank.live
```

## 8. Cron Jobs

Install with `crontab -e`. See `crontab.example` for the full reference.

```cron
# Fetch new songs (midnight)
0 0 * * * /opt/vocarank/run_vocarank.sh fetch-new

# Refresh old song metadata (1 AM)
0 1 * * * /opt/vocarank/run_vocarank.sh update-existing --songs 20000

# Refresh newest songs (2 AM)
0 2 * * * /opt/vocarank/run_vocarank.sh update-existing --newest-songs 20000

# Refresh artist profiles (3 AM)
0 3 * * * /opt/vocarank/run_vocarank.sh update-existing --artists 10000

# Fetch all views + create daily snapshot (8:01 AM)
1 8 * * * /opt/vocarank/run_vocarank.sh views all

# Fetch popular-song views (every hour except during full fetch window)
0 0-7,9-23 * * * /opt/vocarank/run_vocarank.sh views popular

# Pre-warm ranking cache (every hour)
0 * * * * /opt/vocarank/run_vocarank.sh rankings

# Pre-calculate vocaloid stats (midnight)
0 0 * * * /opt/vocarank/run_vocarank.sh vocaloid-stats

# Daily PostgreSQL backup (4:30 AM), 14-day rotation
30 4 * * * /opt/vocarank/database_backup.sh --daily-dump /opt/vocarank/database/backups
```

## 9. Verify

```bash
sudo systemctl status vocarank-api vocarank-web
curl http://127.0.0.1:8000/health
journalctl -u vocarank-api -f
journalctl -u vocarank-web -f
```
