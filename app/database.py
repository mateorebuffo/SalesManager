# app/database.py
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL no está definida. Revisá el archivo .env")

# Railway provides postgresql:// but psycopg3 requires postgresql+psycopg://
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

_is_local_db = any(h in DATABASE_URL for h in ["localhost", "127.0.0.1"])
_ssl_mode = "disable" if _is_local_db else "require"
engine = create_engine(DATABASE_URL, echo=False, connect_args={"sslmode": _ssl_mode})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
