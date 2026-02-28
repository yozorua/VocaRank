from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from .routers import songs, artists, rankings, auth, favorites, votes, statistics, playlists

app = FastAPI(
    title="VocaRank API",
    description="API for VocaRank - Vocaloid Ranking System",
    version="1.0.0"
)

# CORS (Allow all for now, specific domains in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(songs.router)
app.include_router(artists.router)
app.include_router(rankings.router)
app.include_router(favorites.router)
app.include_router(votes.router)
app.include_router(statistics.router)
app.include_router(playlists.router)

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

import threading

def prewarm_rankings():
    try:
        from .database import SessionLocal
        from .routers.rankings import get_daily_ranking, get_weekly_ranking, get_monthly_ranking, get_total_ranking
        
        db = SessionLocal()
        params = {"limit": 100, "song_type": "Original,Remaster,Remix", "vocaloid_only": True, "sort_by": "increment_total"}
        get_daily_ranking(params, db)
        get_weekly_ranking(params, db)
        get_monthly_ranking(params, db)
        
        t_params = {"limit": 100, "song_type": "Original,Remaster,Remix", "vocaloid_only": True, "sort_by": "total"}
        get_total_ranking(**t_params, db=db)
        
        db.close()
        print("Rankings TTLCache pre-warmed successfully upon startup!")
    except Exception as e:
        print(f"Failed to pre-warm rankings: {e}")

@app.on_event("startup")
def startup_event():
    thread = threading.Thread(target=prewarm_rankings, daemon=True)
    thread.start()

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "VocaRank API is running"}
