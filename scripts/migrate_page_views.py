from api.database import engine
from api.models import Base
from sqlalchemy import text

print("Cleaning old site_statistics table and creating new site_views...")
with engine.connect() as conn:
    conn.execute(text("DROP TABLE IF EXISTS site_statistics CASCADE;"))
    conn.commit()
Base.metadata.create_all(bind=engine)
print("Done!")
