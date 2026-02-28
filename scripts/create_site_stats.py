from api.database import engine
from api.models import Base

print("Creating new tables...")
Base.metadata.create_all(bind=engine)
print("Done!")
