from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
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
import io
from PIL import Image

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
        
    # Check if a user with this Google ID already exists using oauth_accounts mapping
    oauth_record = db.query(models.OAuthAccount).filter(
        models.OAuthAccount.provider == "google",
        models.OAuthAccount.provider_account_id == user_id_google
    ).first()
    
    if not oauth_record:
        # Before creating a new user, check if this email intrinsically belongs to an older unbound account
        user = db.query(models.User).filter(models.User.email == email).first()
        
        if not user:
            # Create completely new user
            user = models.User(
                email=email,
                name=name,
                picture_url=picture,
                created_at=datetime.utcnow().isoformat()
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
        # Create oauth account link to bind the Google ID to this user
        oauth = models.OAuthAccount(
            user_id=user.id,
            provider="google",
            provider_account_id=user_id_google
        )
        db.add(oauth)
        db.commit()
    else:
        # User exists and is properly linked. Retrieve them.
        user = db.query(models.User).filter(models.User.id == oauth_record.user_id).first()
        
        # We do NOT overwrite user.name or user.picture_url here anymore, 
        # so users can keep their custom VocaRank profile edits!

    user.last_login = datetime.utcnow().isoformat()
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
    if update_data.name is not None:
        current_user.name = update_data.name
    if update_data.age_range is not None:
        current_user.age_range = update_data.age_range
    if update_data.email is not None:
        existing = db.query(models.User).filter(models.User.email == update_data.email).first()
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = update_data.email
        
    db.commit()
    db.refresh(current_user)
    
    return current_user

@router.post("/avatar", response_model=schemas.UserBase)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user_from_token),
    db: Session = Depends(get_db)
):
    """Uploads, validates, crops, and sets the user's custom avatar"""
    # 1. Security Validation
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Only JPEG or PNG images are allowed.")
    
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024: # 5MB limit
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")
    
    try:
        # 2. Process with Pillow
        image = Image.open(io.BytesIO(contents))
        # Ensure RGB mode for standardized processing
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
            
        # 3. Create thumbnail (force 256x256)
        output_size = (256, 256)
        image.thumbnail(output_size, Image.Resampling.LANCZOS)
        
        # We can also pad it to force exact 256x256 if not square,
        # but since we're using a frontend cropper, it should already be 1:1.
        
        # 4. Save file
        avatars_dir = os.path.join(os.path.dirname(__file__), "..", "static", "avatars")
        os.makedirs(avatars_dir, exist_ok=True)
        filename = f"user_{current_user.id}.webp"
        filepath = os.path.join(avatars_dir, filename)
        
        image.save(filepath, format="WEBP", quality=85)
        
        # 5. Update Database
        import time
        timestamp = int(time.time())
        # Save as a relative path so Next.js Image component handles it natively via frontend proxy rewrites
        # Add ?v=timestamp to bust the aggressive Next.js Image cache
        current_user.picture_url = f"/api/static/avatars/{filename}?v={timestamp}"
        db.commit()
        db.refresh(current_user)
        
        return current_user
        
    except Exception as e:
        print(f"Error processing image: {e}")
        raise HTTPException(status_code=500, detail="Failed to process image.")

