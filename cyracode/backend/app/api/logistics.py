"""
Logistics partner API — AC 6.23-6.27.

AC 6.23 – /lookup/{name}       : return name, coordinates, full_address, postal_code
AC 6.24 – /reverse             : null-safe 200 response when no CyraCode within 50 m
AC 6.25 – address formatting   : country-specific standardised format
AC 6.26 – authentication       : X-API-Key OR OAuth2 Bearer JWT; per-partner rate limit;
                                  all access logged via LogisticsAuditMiddleware in main.py
AC 6.27 – /delivery-confirm    : proof photo, email notification, stored history
           /delivery-status    : real-time status + history retrieval
"""

import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from jose import JWTError, jwt
from pydantic import BaseModel
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.models import AuditLog, CyraCode, DeliveryRecord, LogisticsAccessLog
from app.rate_limiter import limiter
from app.services.email_service import send_delivery_notification_email
from app.services.search_service import reverse_geocode_search, search_by_name

router = APIRouter(prefix="/logistics", tags=["logistics"])


# ── per-partner rate-limit key (AC 6.26) ─────────────────────────────────────

def _partner_rate_key(request: Request) -> str:
    api_key = request.headers.get("x-api-key", "")
    if api_key:
        return f"partner:{api_key[:24]}"
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        return f"bearer:{auth[7:31]}"
    return get_remote_address(request)


# ── AC 6.26: DB audit logging via yield dependency ───────────────────────────
# Using a yield dependency (instead of middleware) ensures the LogisticsAccessLog
# is written through the same DB session that FastAPI injected for the route,
# avoiding SQLite StaticPool conflicts in tests and connection leaks in production.

def _audit_access(request: Request, db: Session = Depends(get_db)):
    """Log every logistics API call — including auth failures — to LogisticsAccessLog."""
    start = time.time()
    api_key = request.headers.get("x-api-key", "")
    auth_hdr = request.headers.get("authorization", "")
    if api_key:
        masked = f"key:{api_key[:8]}***"
    elif auth_hdr.startswith("Bearer "):
        masked = f"jwt:{auth_hdr[7:15]}***"
    else:
        masked = "anonymous"

    status_code = 200
    try:
        yield
    except HTTPException as exc:
        status_code = exc.status_code
        raise
    except Exception:
        status_code = 500
        raise
    finally:
        try:
            log = LogisticsAccessLog(
                partner_key=masked,
                endpoint=request.url.path,
                method=request.method,
                ip_address=request.client.host if request.client else None,
                status_code=status_code,
                response_time_ms=int((time.time() - start) * 1000),
            )
            db.add(log)
            db.commit()
        except Exception:
            pass


# ── authentication (AC 6.26) ─────────────────────────────────────────────────

def verify_partner_auth(
    x_api_key: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
) -> str:
    """Accept X-API-Key header OR OAuth2 Bearer JWT (AC 6.26)."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            if payload.get("type") != "logistics_partner":
                raise HTTPException(status_code=401, detail="Invalid bearer token type.")
            return payload.get("sub", "partner")
        except JWTError:
            raise HTTPException(
                status_code=401, detail="Invalid or expired bearer token."
            )

    if x_api_key and x_api_key == settings.LOGISTICS_DEMO_API_KEY:
        return f"apikey:{x_api_key[:8]}"

    raise HTTPException(
        status_code=401,
        detail=(
            "Authentication required: provide X-API-Key header "
            "or Authorization: Bearer <token>."
        ),
    )


# ── country-specific address formatting (AC 6.25) ────────────────────────────

def _format_address(c: CyraCode) -> str:
    """Return address in the standardised format for the CyraCode's country."""
    cc = c.country_code or ""

    def _j(*parts) -> str:
        return ", ".join(p for p in parts if p)

    if cc == "US":
        street = f"{c.flat_plot_number or ''} {c.street_address or ''}".strip()
        state_zip = f"{c.state or ''} {c.postal_code or ''}".strip()
        return _j(street, c.city, state_zip, c.country)

    if cc == "GB":
        return _j(
            c.flat_plot_number, c.building_name,
            c.street_address, c.city, c.postal_code, c.country,
        )

    if cc == "DE":
        street = f"{c.street_address or ''} {c.flat_plot_number or ''}".strip()
        city_zip = f"{c.postal_code or ''} {c.city or ''}".strip()
        return _j(street, city_zip, c.country)

    if cc == "AU":
        state_zip = f"{c.state or ''} {c.postal_code or ''}".strip()
        return _j(c.flat_plot_number, c.street_address, c.city, state_zip, c.country)

    if cc == "JP":
        return " ".join(
            p for p in [
                c.country, c.postal_code, c.state, c.city,
                c.street_address, c.building_name, c.flat_plot_number,
            ]
            if p
        )

    if cc == "IN":
        postal = f"- {c.postal_code}" if c.postal_code else ""
        state_postal = f"{c.state or ''} {postal}".strip() if c.state or postal else None
        return _j(
            c.flat_plot_number, c.building_name, c.street_address,
            c.landmark, c.city, c.district, state_postal, c.country,
        )

    # Default: generic comma-joined format
    return _j(
        c.flat_plot_number, c.building_name, c.street_address,
        c.landmark, c.city, c.district, c.state, c.postal_code, c.country,
    )


def _address_payload(c: CyraCode) -> dict:
    return {
        "name": c.code_name,
        "coordinates": {
            "latitude": float(c.latitude),
            "longitude": float(c.longitude),
        },
        "full_address": _format_address(c),
        "postal_code": c.postal_code,
        "country_code": c.country_code,
    }


# ── request models ────────────────────────────────────────────────────────────

class ReverseRequest(BaseModel):
    lat: float
    lng: float


class DeliveryConfirmRequest(BaseModel):
    name: str
    tracking_id: str
    status: str = "delivered"
    proof_photo: Optional[str] = None  # AC 6.27: base64-encoded image (optional)


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/lookup/{name}")
@limiter.limit("100/minute", key_func=_partner_rate_key)
def lookup(
    request: Request,
    name: str,
    _audit: None = Depends(_audit_access),  # must be first — yields before auth runs
    db: Session = Depends(get_db),
    _auth: str = Depends(verify_partner_auth),
):
    """AC 6.23: Return name, coordinates, full_address, postal_code for a CyraCode."""
    result = search_by_name(db, name)
    if not result:
        raise HTTPException(status_code=404, detail="CyraCode not found.")
    return _address_payload(result)


@router.post("/reverse")
@limiter.limit("100/minute", key_func=_partner_rate_key)
def reverse(
    request: Request,
    payload: ReverseRequest,
    _audit: None = Depends(_audit_access),
    db: Session = Depends(get_db),
    _auth: str = Depends(verify_partner_auth),
):
    """AC 6.24: Nearest CyraCode within 50 m; null 200 response when none found."""
    result = reverse_geocode_search(db, payload.lat, payload.lng, radius_m=50)
    if not result:
        # AC 6.24: null response — partner proceeds with manual delivery
        return {
            "found": False,
            "name": None,
            "coordinates": None,
            "full_address": None,
            "postal_code": None,
            "country_code": None,
            "message": "No CyraCode registered within 50 m. Proceed with manual delivery.",
        }
    return {**_address_payload(result), "found": True}


@router.post("/delivery-confirm")
@limiter.limit("100/minute", key_func=_partner_rate_key)
def delivery_confirm(
    request: Request,
    payload: DeliveryConfirmRequest,
    _audit: None = Depends(_audit_access),
    db: Session = Depends(get_db),
    partner: str = Depends(verify_partner_auth),
):
    """AC 6.27: Record delivery confirmation, store history, notify user."""
    result = search_by_name(db, payload.name)
    if not result:
        raise HTTPException(status_code=404, detail="CyraCode not found.")

    # Capture user email before commit (lazy-load while session is open)
    user_email: Optional[str] = result.user.email if result.user else None

    now = datetime.now(timezone.utc)
    delivered_at = now if payload.status == "delivered" else None

    # Persist delivery record (AC 6.27 — stored for history)
    record = DeliveryRecord(
        cyracode_id=result.id,
        tracking_id=payload.tracking_id,
        partner_key=partner[:50],
        status=payload.status,
        delivered_at=delivered_at,
        proof_photo=payload.proof_photo,
    )
    db.add(record)

    # Audit log (AC 6.26)
    log = AuditLog(
        user_id=result.user_id,
        action=f"delivery_{payload.status}:{payload.tracking_id}:{payload.name}",
    )
    db.add(log)
    db.commit()

    # Email notification (AC 6.27)
    if user_email:
        send_delivery_notification_email(
            to_email=user_email,
            cyracode_name=result.code_name,
            tracking_id=payload.tracking_id,
            status=payload.status,
            delivered_at=now.isoformat(),
            has_proof=bool(payload.proof_photo),
        )

    return {
        "success": True,
        "message": f"Delivery {payload.status} recorded for {payload.name}.",
        "tracking_id": payload.tracking_id,
        "cyracode_name": result.code_name,
        "delivery_time": now.isoformat(),
        "proof_received": bool(payload.proof_photo),
    }


@router.get("/delivery-status/{tracking_id}")
@limiter.limit("100/minute", key_func=_partner_rate_key)
def delivery_status(
    request: Request,
    tracking_id: str,
    _audit: None = Depends(_audit_access),
    db: Session = Depends(get_db),
    _auth: str = Depends(verify_partner_auth),
):
    """AC 6.27: Real-time delivery status and full history for a tracking ID."""
    records = (
        db.query(DeliveryRecord)
        .filter(DeliveryRecord.tracking_id == tracking_id)
        .order_by(DeliveryRecord.created_at.desc())
        .all()
    )
    if not records:
        raise HTTPException(status_code=404, detail="Tracking ID not found.")

    latest = records[0]
    cyracode_name = latest.cyracode.code_name if latest.cyracode else None

    return {
        "tracking_id": tracking_id,
        "status": latest.status,
        "cyracode_name": cyracode_name,
        "delivered_at": latest.delivered_at.isoformat() if latest.delivered_at else None,
        "proof_available": bool(latest.proof_photo),
        "history": [
            {
                "status": r.status,
                "timestamp": r.created_at.isoformat(),
                "delivered_at": r.delivered_at.isoformat() if r.delivered_at else None,
            }
            for r in records
        ],
    }
