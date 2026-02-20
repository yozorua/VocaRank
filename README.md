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