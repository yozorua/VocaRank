import os
import sys

sys.path.append(os.path.abspath("."))
from api.database import engine
from api.models import SongComment

SongComment.__table__.create(engine, checkfirst=True)
print("song_comments table created successfully!")
