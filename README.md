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