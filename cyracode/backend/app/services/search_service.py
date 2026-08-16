import math

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import CyraCode


def haversine_distance(lat1, lng1, lat2, lng2) -> float:
    """Return distance in meters between two coordinate pairs."""
    r = 6371000.0
    phi1 = math.radians(float(lat1))
    phi2 = math.radians(float(lat2))
    dphi = math.radians(float(lat2) - float(lat1))
    dlambda = math.radians(float(lng2) - float(lng1))
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def _brief_address(code: CyraCode) -> str:
    parts = [
        code.street_address,
        code.road_name,
        code.area,
        code.town,
        code.city,
        code.country,
    ]
    return ", ".join(p for p in parts if p)


def _uses_mssql_ci(db: Session) -> bool:
    """MSSQL's default CI collation makes =/LIKE case-insensitive; other dialects
    (PostgreSQL, SQLite) require func.lower() for case-insensitive matching."""
    return db.get_bind().dialect.name == "mssql"


def search_by_name(db: Session, name: str):
    # AC 6.8: Direct equality lets MSSQL's CI (case-insensitive) collation use
    # IX_CyraCodes_CodeName. On case-sensitive dialects, lower() both sides so
    # search is case-insensitive there too (func.lower() on MSSQL would force a
    # full scan, which is why it is only applied on non-MSSQL backends).
    if _uses_mssql_ci(db):
        name_clause = CyraCode.code_name == name
    else:
        name_clause = func.lower(CyraCode.code_name) == name.lower()
    return (
        db.query(CyraCode)
        .filter(
            name_clause,
            CyraCode.is_active == True,  # noqa: E712
        )
        .first()
    )


def autocomplete_names(db: Session, query: str, limit: int = 5) -> list:
    if not query:
        return []
    # AC 6.8: Prefix LIKE (no leading wildcard) performs an index range scan on
    # IX_CyraCodes_CodeName with MSSQL's CI collation.
    if _uses_mssql_ci(db):
        name_clause = CyraCode.code_name.like(f"{query}%")
    else:
        name_clause = func.lower(CyraCode.code_name).like(f"{query.lower()}%")
    results = (
        db.query(CyraCode)
        .filter(
            name_clause,
            CyraCode.is_active == True,  # noqa: E712
        )
        .limit(limit)
        .all()
    )
    return [
        {
            "name": c.code_name,
            "address": _brief_address(c),
            "latitude": float(c.latitude) if c.latitude is not None else None,
            "longitude": float(c.longitude) if c.longitude is not None else None,
        }
        for c in results
    ]


def fuzzy_search(db: Session, name: str, limit: int = 5) -> list:
    if not name:
        return []
    if _uses_mssql_ci(db):
        name_clause = CyraCode.code_name.like(f"%{name}%")
    else:
        name_clause = func.lower(CyraCode.code_name).like(f"%{name.lower()}%")
    results = (
        db.query(CyraCode)
        .filter(
            name_clause,
            CyraCode.is_active == True,  # noqa: E712
        )
        .limit(limit)
        .all()
    )
    return [
        {"name": c.code_name, "address": _brief_address(c)} for c in results
    ]


def reverse_geocode_search(db: Session, lat: float, lng: float, radius_m: float = 50):
    delta = 0.01  # ~1.1km bounding box pre-filter
    candidates = (
        db.query(CyraCode)
        .filter(
            CyraCode.is_active == True,  # noqa: E712
            CyraCode.latitude >= lat - delta,
            CyraCode.latitude <= lat + delta,
            CyraCode.longitude >= lng - delta,
            CyraCode.longitude <= lng + delta,
        )
        .all()
    )
    nearest = None
    nearest_dist = None
    for c in candidates:
        d = haversine_distance(lat, lng, c.latitude, c.longitude)
        if d <= radius_m and (nearest_dist is None or d < nearest_dist):
            nearest = c
            nearest_dist = d
    return nearest
