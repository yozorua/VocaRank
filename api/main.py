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


@app.get("/health")
def health_check():
    return {"status": "ok", "message": "VocaRank API is running"}
