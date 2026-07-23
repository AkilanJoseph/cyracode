from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# AC 6.8: pool settings — sized for production read-replica topology
_engine_kwargs: dict = {"pool_pre_ping": True}
if _is_sqlite:
    # SQLite does not support connection-pool sizing
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _engine_kwargs.update(
        {
            "fast_executemany": True,
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT,
            "pool_recycle": settings.DB_POOL_RECYCLE,
        }
    )

engine = create_engine(settings.DATABASE_URL, **_engine_kwargs)

# AC 6.8: read replica — routes search/autocomplete queries to a replica when
# DB_READ_REPLICA_URL is set; falls back to the primary if it is empty.
_read_url = settings.DB_READ_REPLICA_URL or settings.DATABASE_URL
_read_is_sqlite = _read_url.startswith("sqlite")
_read_kwargs: dict = {"pool_pre_ping": True}
if _read_is_sqlite:
    _read_kwargs["connect_args"] = {"check_same_thread": False}
else:
    _read_kwargs.update(
        {
            "fast_executemany": True,
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT,
            "pool_recycle": settings.DB_POOL_RECYCLE,
        }
    )

read_engine = (
    create_engine(_read_url, **_read_kwargs)
    if settings.DB_READ_REPLICA_URL
    else engine
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
ReadSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=read_engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_read_db():
    """AC 6.8: Yield a read-only session routed to the read replica."""
    db = ReadSessionLocal()
    try:
        yield db
    finally:
        db.close()
