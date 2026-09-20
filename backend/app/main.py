import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import admin, auth, cyracode_api, logistics, otp, registration, search
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.rate_limiter import limiter

# Create tables if they do not exist (safe for dev; use migrations in prod).
try:
    Base.metadata.create_all(bind=engine)
except Exception as exc:  # pragma: no cover
    print(f"[STARTUP] Could not create tables automatically: {exc}")


def _ensure_schema_upgrades():
    """Lightweight startup migration for pre-existing dev databases.

    IdempotencyKey is now scoped to the owning user (UserId column) so one user
    can never receive another user's cached registration data. ``create_all``
    only creates missing tables, so the column must be added in place here.
    Handles both SQLite (''ADD COLUMN'') and MSSQL (''ADD'') dialects.
    """
    from sqlalchemy import inspect, text

    try:
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("IdempotencyKeys")}
        if "UserId" in columns:
            return
        add_clause = " ADD COLUMN " if engine.dialect.name == "sqlite" else " ADD "
        with engine.begin() as conn:
            conn.execute(
                text(f'ALTER TABLE "IdempotencyKeys"{add_clause}"UserId" VARCHAR(36) NULL')
            )
    except Exception as exc:  # pragma: no cover
        print(f"[STARTUP] Schema upgrade skipped for IdempotencyKeys: {exc}")


def _ensure_cyracode_columns():
    """Add CyraCodes columns that were introduced after older dev DBs were created.

    ``create_all`` never alters existing tables, so columns added to the ORM
    model later (AvenueName, SuiteName) are missing from pre-existing dev
    databases and cause "no such column" errors on any full-row query. Both are
    nullable and added in place, mirroring the IdempotencyKeys upgrade above.
    """
    from sqlalchemy import inspect, text

    expected = {
        "AvenueName": "VARCHAR(100) NULL",
        "SuiteName": "VARCHAR(50) NULL",
    }
    try:
        inspector = inspect(engine)
        existing = {c["name"] for c in inspector.get_columns("CyraCodes")}
        missing = {name: ddl for name, ddl in expected.items() if name not in existing}
        if not missing:
            return
        add_clause = " ADD COLUMN " if engine.dialect.name == "sqlite" else " ADD "
        with engine.begin() as conn:
            for name, ddl in missing.items():
                conn.execute(text(f'ALTER TABLE "CyraCodes"{add_clause}"{name}" {ddl}'))
        print(f"[STARTUP] Added missing CyraCodes columns: {list(missing)}")
    except Exception as exc:  # pragma: no cover
        print(f"[STARTUP] Schema upgrade skipped for CyraCodes: {exc}")


def _ensure_user_role_column():
    """Add Users.Role (user/client/admin) to pre-existing dev databases.

    ``create_all`` only creates missing tables, so the role column must be
    back-ported onto the existing Users table. The legacy IsAdmin flag (when
    present) is honored to backfill current admins; new DBs simply default
    everyone to 'user'. Handles SQLite and MSSQL.
    """
    from sqlalchemy import inspect, text

    try:
        inspector = inspect(engine)
        existing = {c["name"] for c in inspector.get_columns("Users")}
        if "Role" in existing:
            return
        add_clause = " ADD COLUMN " if engine.dialect.name == "sqlite" else " ADD "
        with engine.begin() as conn:
            conn.execute(
                text(f'ALTER TABLE "Users"{add_clause}"Role" VARCHAR(20) NOT NULL DEFAULT \'user\'')
            )
            if "IsAdmin" in existing:
                conn.execute(
                    text('UPDATE "Users" SET "Role" = \'admin\' WHERE "IsAdmin" = 1')
                )
        print("[STARTUP] Added Users.Role column (Role values backfilled)")
    except Exception as exc:  # pragma: no cover
        print(f"[STARTUP] Schema upgrade skipped for Users.Role: {exc}")


def _ensure_api_client_columns():
    """Add ApiClients.KeyId (lookup digest) to pre-existing dev databases.

    New tables are created by ``create_all``, but a dev DB created between model
    iterations may already have ApiClients without the KeyId index column.
    """
    from sqlalchemy import inspect, text

    try:
        inspector = inspect(engine)
        columns = {c["name"] for c in inspector.get_columns("ApiClients")}
        if "KeyId" in columns:
            return
        add_clause = " ADD COLUMN " if engine.dialect.name == "sqlite" else " ADD "
        with engine.begin() as conn:
            conn.execute(text(f'ALTER TABLE "ApiClients"{add_clause}"KeyId" VARCHAR(64) NULL'))
        print("[STARTUP] Added ApiClients.KeyId column")
    except Exception as exc:  # pragma: no cover
        print(f"[STARTUP] Schema upgrade skipped for ApiClients.KeyId: {exc}")


_ensure_schema_upgrades()
_ensure_cyracode_columns()
_ensure_user_role_column()
_ensure_api_client_columns()


def _seed_plans():
    """Idempotently seed the plan catalog (Basic/Pro/Enterprise) on startup."""
    from app.services.admin_service import ensure_plans

    try:
        db = SessionLocal()
        try:
            ensure_plans(db)
            print("[STARTUP] Plan catalog ready.")
        finally:
            db.close()
    except Exception as exc:  # pragma: no cover
        print(f"[STARTUP] Plan seed skipped: {exc}")


_seed_plans()


def _bootstrap_admin():
    """Create/upgrade the initial Admin account from env config (idempotent)."""
    from app.services.admin_service import bootstrap_admin

    try:
        db = SessionLocal()
        try:
            admin_user = bootstrap_admin(db)
            if admin_user:
                print(f"[STARTUP] Admin account ready: {admin_user.email}")
        finally:
            db.close()
    except Exception as exc:  # pragma: no cover
        print(f"[STARTUP] Admin bootstrap skipped: {exc}")


_bootstrap_admin()

app = FastAPI(title="CyraCode API", version="1.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

_extra_origins = [
    o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()
]
origins = [settings.FRONTEND_URL, *_extra_origins]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    # X-API-Key added for AC 6.26 logistics partner authentication;
    # X-Idempotency-Key added for AC 6.17 (frontend sends it on registration submits)
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
        "X-Requested-With",
        "X-API-Key",
        "X-Idempotency-Key",
    ],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """AC 6.1: Inject HSTS and other security headers on every response."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        # AC 6.1 – TLS enforcement via HSTS
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )
        # AC 6.6 – XSS mitigation via CSP
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'"
        )
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), camera=(), microphone=()"
        )
        return response


app.add_middleware(SecurityHeadersMiddleware)


class LogisticsAuditMiddleware(BaseHTTPMiddleware):
    """AC 6.23: Attach X-Response-Time header to every /logistics response.
    DB audit logging is handled by the _audit_access yield dependency inside logistics.py
    so it shares the request's DI session and avoids connection conflicts.
    """

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/logistics"):
            return await call_next(request)
        start = time.time()
        response: Response = await call_next(request)
        response.headers["X-Response-Time"] = f"{int((time.time() - start) * 1000)}ms"
        return response


app.add_middleware(LogisticsAuditMiddleware)

app.include_router(auth.router)
app.include_router(otp.router)
app.include_router(registration.router)
app.include_router(search.router)
app.include_router(logistics.router)
app.include_router(admin.router)
app.include_router(cyracode_api.router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"service": "CyraCode API", "version": "1.0"}
