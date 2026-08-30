import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import auth, logistics, otp, registration, search
from app.config import settings
from app.database import Base, engine
from app.rate_limiter import limiter

# Create tables if they do not exist (safe for dev; use migrations in prod).
try:
    Base.metadata.create_all(bind=engine)
except Exception as exc:  # pragma: no cover
    print(f"[STARTUP] Could not create tables automatically: {exc}")

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
    # X-API-Key added for AC 6.26 logistics partner authentication
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-API-Key"],
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


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def root():
    return {"service": "CyraCode API", "version": "1.0"}
