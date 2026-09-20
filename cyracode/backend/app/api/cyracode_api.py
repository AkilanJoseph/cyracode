"""CyraCode Address Lookup API.

``GET /cyracode/{cyracode}/address`` — secure, machine-to-machine API for
authorized clients.

Security model (mirrors the "new requirement" spec):
  * NOT publicly accessible — every request requires a client credential
    (``X-API-Key`` header).
  * Authentication ≠ authorization: even a valid key only works if the client
    also holds the ``cyracode.lookup`` permission (a row in
    ClientApiPermissions), which administrators grant/revoke without code.
  * Rate limited per client key to blunt brute-force enumeration.
  * Every request is audit logged (ClientAccessLog) with a masked key.
  * A missing or inactive CyraCode returns the same generic 404 so the API
    cannot be used to enumerate valid CyraCodes.
"""
import re
import time

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import ApiClient, ClientAccessLog
from app.rate_limiter import limiter
from app.services.admin_service import (
    LOOKUP_PERMISSION,
    client_has_permission,
    get_client_by_key,
    verify_api_key,
)
from app.services.search_service import search_by_name

router = APIRouter(prefix="/cyracode", tags=["cyracode-api"])

# Sanity window for the code-name path segment (unique-name max is 50 in the
# ORM model); longer/garbage inputs are rejected before reaching the DB.
_CODE_PATTERN = re.compile(r"^[A-Za-z0-9_\- ]{1,50}$")


def _client_rate_key(request: Request) -> str:
    """Rate limit per raw API key (masked to keep the cache key short)."""
    api_key = request.headers.get("x-api-key", "")
    if api_key:
        return f"cyracode-client:{api_key[:24]}"
    return get_remote_address(request)


def _audit_access(request: Request, db: Session = Depends(get_db)):
    """Yield-dependency that logs every lookup attempt, incl. auth failures.

    Mirrors the logistics _audit_access pattern so the log is written through
    the same DI session as the route (avoids SQLite pool conflicts in tests).
    """
    start = time.time()

    api_key = request.headers.get("x-api-key", "")
    raw_cred = "anonymous" if not api_key else f"key:{api_key[:8]}***"
    tail = api_key[-4:] if api_key else None

    # Resolve the credential up-front so the audit row carries the client even
    # on the success path; stays None for anonymous/invalid keys.
    client_id: str | None = None
    client_name: str | None = None
    if api_key:
        found = get_client_by_key(db, api_key)
        if found:
            client_id = found.id
            client_name = found.name
            tail = found.key_tail

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
            log = ClientAccessLog(
                client_id=client_id,
                client_name=client_name,
                key_tail=tail,
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


def authenticate_client(
    x_api_key: str | None = Header(None), db: Session = Depends(get_db)
) -> ApiClient:
    """Authenticate via X-API-Key and verify the cyracode.lookup permission.

    Raises 401 for an unknown/inactive key and 403 when the client is
    authenticated but not authorized — the "auth ≠ access" rule.
    """
    if not x_api_key:
        raise HTTPException(
            status_code=401,
            detail=(
                "Authentication required: provide an X-API-Key header containing "
                "your CyraCode client credential."
            ),
            headers={"WWW-Authenticate": "ApiKey"},
        )

    client = get_client_by_key(db, x_api_key)
    if not client:
        raise HTTPException(status_code=401, detail="Invalid or inactive API key.")
    if not verify_api_key(x_api_key, client.api_key_hash):
        raise HTTPException(status_code=401, detail="Invalid or inactive API key.")

    return client


def require_lookup_permission(
    client: ApiClient = Depends(authenticate_client), db: Session = Depends(get_db)
) -> ApiClient:
    """Authorization gate: the key is valid but is this client permitted?"""
    if not client_has_permission(db, client, LOOKUP_PERMISSION):
        raise HTTPException(
            status_code=403,
            detail=(
                "This client is not authorized to use the CyraCode address "
                "lookup API. Contact an administrator to enable access."
            ),
        )
    return client


@router.get("/{cyracode}/address")
@limiter.limit("30/minute", key_func=_client_rate_key)
def address_lookup(
    request: Request,
    cyracode: str,
    _audit: None = Depends(_audit_access),  # must run before auth for logging
    db: Session = Depends(get_db),
    # Authentication AND authorization — a valid key is only enough when the
    # client also holds the cyracode.lookup permission.
    client: ApiClient = Depends(require_lookup_permission),
):
    """Return the address for a CyraCode — authorized clients only."""
    if not _CODE_PATTERN.match(cyracode):
        # Same generic 404 as a missing code: do not leak why it failed.
        raise HTTPException(status_code=404, detail="CyraCode not found.")

    result = search_by_name(db, cyracode)
    if not result:
        # Anti-enumeration: identical body whether the code is absent or inactive.
        raise HTTPException(status_code=404, detail="CyraCode not found.")

    return {
        "cyracode": result.code_name,
        "address": {
            "address_line1": _line1(result),
            "address_line2": _line2(result),
            "city": result.city or "",
            "state": result.state or "",
            "postal_code": result.postal_code or "",
            "country": result.country or "",
        },
    }


def _line1(entry) -> str:
    primary = entry.street_address or ""
    if entry.building_name:
        prefix = " ".join(
            p for p in (entry.flat_number, entry.suite_name, entry.plot_number) if p
        )
        building = f"{prefix} {entry.building_name}".strip() if prefix else entry.building_name
        return f"{building}, {primary}".strip(", ")
    if primary:
        prefix = " ".join(
            p for p in (entry.flat_number, entry.suite_name, entry.plot_number) if p
        )
        return f"{prefix} {primary}".strip()
    return entry.building_name or ""


def _line2(entry) -> str:
    return ", ".join(
        p
        for p in (
            entry.avenue_name,
            entry.road_name,
            entry.area,
            entry.town,
            entry.district,
            entry.landmark,
        )
        if p
    )