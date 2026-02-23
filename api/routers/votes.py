from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from ..database import get_db
from .. import models, schemas
from datetime import datetime
from sqlalchemy import func

router = APIRouter(
    prefix="/votes",
    tags=["votes"],
)

VALID_MOODS = ["happy", "sad", "love", "chaos", "chill", "emotional"]

@router.post("/song/{song_id}")
def submit_vote(song_id: int, vote_in: schemas.SongVoteCreate, request: Request, db: Session = Depends(get_db)):
    if vote_in.vote_type not in VALID_MOODS:
        raise HTTPException(status_code=400, detail="Invalid mood vote type.")
        
    song = db.query(models.Song).filter(models.Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
        
    forwarded = request.headers.get("X-Forwarded-For")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    
    existing = db.query(models.SongVote).filter_by(song_id=song_id, ip_address=client_ip).first()
    if existing:
        existing.vote_type = vote_in.vote_type
        db.commit()
    else:
        new_vote = models.SongVote(
            song_id=song_id,
            vote_type=vote_in.vote_type,
            ip_address=client_ip,
            created_at=datetime.utcnow().isoformat()
        )
        db.add(new_vote)
        db.commit()
    
    counts = db.query(models.SongVote.vote_type, func.count(models.SongVote.id)).filter_by(song_id=song_id).group_by(models.SongVote.vote_type).all()
    mood_votes = {m: 0 for m in VALID_MOODS}
    for vt, c in counts:
        if vt in mood_votes:
            mood_votes[vt] = c
            
    return {"success": True, "mood_votes": mood_votes}

@router.delete("/song/{song_id}")
def delete_vote(song_id: int, request: Request, db: Session = Depends(get_db)):
    forwarded = request.headers.get("X-Forwarded-For")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    existing = db.query(models.SongVote).filter_by(song_id=song_id, ip_address=client_ip).first()
    
    if existing:
        db.delete(existing)
        db.commit()

    counts = db.query(models.SongVote.vote_type, func.count(models.SongVote.id)).filter_by(song_id=song_id).group_by(models.SongVote.vote_type).all()
    mood_votes = {m: 0 for m in VALID_MOODS}
    for vt, c in counts:
        if vt in mood_votes:
            mood_votes[vt] = c
            
    return {"success": True, "mood_votes": mood_votes}

@router.get("/song/{song_id}/check")
def check_vote(song_id: int, request: Request, db: Session = Depends(get_db)):
    forwarded = request.headers.get("X-Forwarded-For")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    existing = db.query(models.SongVote).filter_by(song_id=song_id, ip_address=client_ip).first()
    if existing:
        return {"has_voted": True, "vote_type": existing.vote_type}
    return {"has_voted": False}
