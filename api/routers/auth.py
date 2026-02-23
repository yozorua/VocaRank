from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

from ..database import get_db
from .. import models, schemas

# Load the global project .env (up two directories from api/routers/auth.py)
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/google")

GOOGLE_CLIENT_ID = os.getenv("AUTH_GOOGLE_ID")
JWT_SECRET = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days validity

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user_from_token(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT Secret not configured")
        
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user

@router.post("/google", response_model=schemas.Token)
def google_auth(login_data: schemas.GoogleLogin, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID or not JWT_SECRET:
        raise HTTPException(status_code=500, detail="Server auth configuration missing. Check .env")

    try:
        # Verify the Google JWT token using the py-google-auth helper
        idinfo = id_token.verify_oauth2_token(login_data.id_token, google_requests.Request(), GOOGLE_CLIENT_ID)
        
        email = idinfo.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")
            
        name = idinfo.get("name")
        picture = idinfo.get("picture")
        user_id_google = idinfo.get("sub")
        
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {str(e)}")
        
    # Check if user already exists
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if not user:
        # Create new user
        user = models.User(
            email=email,
            name=name,
            picture_url=picture,
            created_at=datetime.utcnow().isoformat()
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create oauth account link
        oauth = models.OAuthAccount(
            user_id=user.id,
            provider="google",
            provider_account_id=user_id_google
        )
        db.add(oauth)
        db.commit()
    else:
        # Update name/picture if changed (maybe they updated it on Google)
        if user.name != name or user.picture_url != picture:
            user.name = name
            user.picture_url = picture
            db.commit()
            
    # Generate our internal VocaRank JWT
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=schemas.UserBase)
def get_current_user(current_user: models.User = Depends(get_current_user_from_token)):
    """Returns the currently logged in user based on the Authorization Bearer Token"""
    return current_user

@router.patch("/me", response_model=schemas.UserBase)
def update_current_user(
    update_data: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Updates the currently logged in user's profile information"""
    if update_data.country is not None:
        current_user.country = update_data.country
        
    db.commit()
    db.refresh(current_user)
    
    return current_user
