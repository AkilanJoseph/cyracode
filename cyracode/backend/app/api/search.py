from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_read_db
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
    city: str


class ReverseRequest(BaseModel):
    lat: float
    lng: float


def _full_address(c) -> str:
    parts = [
        c.flat_plot_number,
        c.building_name,
        c.street_address,
        c.landmark,
        c.city,
        c.district,
        c.state,
        c.postal_code,
        c.country,
    ]
    return ", ".join(p for p in parts if p)


@router.get("/autocomplete", response_model=List[AutocompleteItem])
def autocomplete(
    response: Response,
    q: str = Query("", min_length=0),
    db: Session = Depends(get_read_db),
):
    # AC 6.9: short TTL lets a CDN absorb autocomplete bursts without stale data
    response.headers["Cache-Control"] = "public, max-age=30, s-maxage=60"
    return autocomplete_names(db, q, limit=5)


@router.post("/reverse")
def reverse_post(payload: ReverseRequest, db: Session = Depends(get_read_db)):
    result = reverse_geocode_search(db, payload.lat, payload.lng, radius_m=50)
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
    )


@router.get("/{name}")
def search(name: str, response: Response, db: Session = Depends(get_read_db)):
    result = search_by_name(db, name)
    if not result:
        suggestions = fuzzy_search(db, name, limit=5)
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"CyraCode '{name}' not found.",
                "suggestions": suggestions,
            },
        )
    # AC 6.9: CyraCode names are immutable after registration; 5-min client
    # cache and 10-min CDN cache keep p95 latency well under 500 ms.
    response.headers["Cache-Control"] = "public, max-age=300, s-maxage=600"
    return SearchResult(
        name=result.code_name,
        code_type=result.code_type,
        latitude=float(result.latitude),
        longitude=float(result.longitude),
        full_address=_full_address(result),
        postal_code=result.postal_code,
        country=result.country,
        city=result.city,
    )
