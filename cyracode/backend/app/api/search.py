from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_read_db
from app.models.models import User
from app.rate_limiter import limiter
from app.services.auth_service import get_current_user
from app.services.search_service import (
    autocomplete_names,
    fuzzy_search,
    reverse_geocode_search,
    search_by_name,
)

router = APIRouter(prefix="/search", tags=["search"])


class AutocompleteItem(BaseModel):
    name: str
    address: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class SearchResult(BaseModel):
    name: str
    code_type: str
    latitude: float
    longitude: float
    full_address: str
    postal_code: str
    country: str
    city: Optional[str] = None
    area: Optional[str] = None
    town: Optional[str] = None
    road_name: Optional[str] = None


class ReverseRequest(BaseModel):
    lat: float
    lng: float


def _full_address(c) -> str:
    parts = [
        c.flat_number,
        c.plot_number,
        c.building_name,
        c.street_address,
        c.road_name,
        c.area,
        c.town,
        c.landmark,
        c.city,
        c.district,
        c.state,
        c.postal_code,
        c.country,
    ]
    return ", ".join(p for p in parts if p)


@router.get("/autocomplete", response_model=List[AutocompleteItem])
@limiter.limit("60/minute")
def autocomplete(
    request: Request,
    response: Response,
    q: str = Query("", min_length=0),
    db: Session = Depends(get_read_db),
    user: User = Depends(get_current_user),
):
    # Results are scoped to the authenticated user, so responses are private
    # and must not be cached by shared/CDN caches.
    response.headers["Cache-Control"] = "private, max-age=30"
    return autocomplete_names(db, q, limit=5, user_id=user.id)


@router.post("/reverse")
@limiter.limit("20/minute")
def reverse_post(
    request: Request,
    payload: ReverseRequest,
    db: Session = Depends(get_read_db),
    user: User = Depends(get_current_user),
):
    result = reverse_geocode_search(db, payload.lat, payload.lng, radius_m=50, user_id=user.id)
    if not result:
        raise HTTPException(
            status_code=404, detail="No CyraCode found within 50 meters."
        )
    return SearchResult(
        name=result.code_name,
        code_type=result.code_type,
        latitude=float(result.latitude),
        longitude=float(result.longitude),
        full_address=_full_address(result),
        postal_code=result.postal_code,
        country=result.country,
        city=result.city,
        area=result.area,
        town=result.town,
        road_name=result.road_name,
    )


@router.get("/{name}")
@limiter.limit("30/minute")
def search(
    request: Request,
    name: str,
    response: Response,
    db: Session = Depends(get_read_db),
    user: User = Depends(get_current_user),
):
    result = search_by_name(db, name, user_id=user.id)
    if not result:
        suggestions = fuzzy_search(db, name, limit=5, user_id=user.id)
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"CyraCode '{name}' not found.",
                "suggestions": suggestions,
            },
        )
    # AC 6.9: results are private to the logged-in user, so no shared caching;
    # a short private max-age keeps repeated lookups snappy.
    response.headers["Cache-Control"] = "private, max-age=300"
    return SearchResult(
        name=result.code_name,
        code_type=result.code_type,
        latitude=float(result.latitude),
        longitude=float(result.longitude),
        full_address=_full_address(result),
        postal_code=result.postal_code,
        country=result.country,
        city=result.city,
        area=result.area,
        town=result.town,
        road_name=result.road_name,
    )
