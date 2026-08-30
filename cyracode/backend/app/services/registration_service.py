import base64
import io
import math
import random
import string
from datetime import datetime

import httpx
import qrcode
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
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


def check_name_available(db: Session, name: str) -> bool:
    existing = (
        db.query(CyraCode)
        .filter(func.lower(CyraCode.code_name) == name.lower())
        .first()
    )
    return existing is None


def suggest_alternative_names(db: Session, name: str) -> list:
    suggestions = []
    candidates = []
    suffixes = ["1", "01", "X", "Home", "HQ", str(random.randint(10, 99))]
    for suffix in suffixes:
        candidates.append(f"{name}{suffix}")
    candidates.append(f"{name}_{random.randint(100, 999)}")
    candidates.append(f"The{name}")

    for candidate in candidates:
        if len(suggestions) >= 5:
            break
        if check_name_available(db, candidate):
            suggestions.append(candidate)

    return suggestions[:5] if suggestions else [f"{name}{random.randint(1000, 9999)}"]


def generate_cyracode(lat: float, lng: float, db: Session) -> str:
    """Generate a 12-char code in format: LL#LL##L##L# (L=letter, #=digit).
    Example: Aa2DF43T91q5
    """
    L = string.ascii_letters
    D = string.digits
    for _ in range(10):
        code = (
            "".join(random.choices(L, k=2))
            + "".join(random.choices(D, k=1))
            + "".join(random.choices(L, k=2))
            + "".join(random.choices(D, k=2))
            + "".join(random.choices(L, k=1))
            + "".join(random.choices(D, k=2))
            + "".join(random.choices(L, k=1))
            + "".join(random.choices(D, k=1))
        )
        if check_name_available(db, code):
            return code
    return code


def validate_coordinates_not_ocean(lat: float, lng: float) -> bool:
    """AC 6.18: Server-side check — return False if coordinates map to ocean/uninhabited land.

    Uses Google Maps Geocoding API when a key is configured; fails open (returns True)
    if no key is set or if the API call fails, so the client-side Google Maps check
    remains the primary gate for ocean/uninhabited detection.
    """
    if not settings.GOOGLE_MAPS_API_KEY:
        return True
    try:
        resp = httpx.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={
                "latlng": f"{float(lat)},{float(lng)}",
                "key": settings.GOOGLE_MAPS_API_KEY,
                "result_type": "street_address|route|locality|sublocality",
            },
            timeout=5.0,
        )
        if resp.status_code != 200:
            return True  # fail-open on API error
        data = resp.json()
        if data.get("status") == "ZERO_RESULTS":
            return False
        return bool(data.get("results"))
    except Exception:
        return True  # fail-open on network error


def validate_coordinates(lat: float, lng: float) -> bool:
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return False
    return -90 <= lat <= 90 and -180 <= lng <= 180


def create_cyracode_entry(db: Session, user_id: str, data: dict) -> CyraCode:
    entry = CyraCode(
        user_id=user_id,
        code_name=data["code_name"],
        code_type=data["code_type"],
        latitude=data["latitude"],
        longitude=data["longitude"],
        country=data["country"],
        country_code=data["country_code"],
        state=data.get("state"),
        district=data.get("district"),
        city=data.get("city"),
        area=data.get("area"),
        town=data.get("town"),
        road_name=data.get("road_name"),
        street_address=data["street_address"],
        building_name=data.get("building_name"),
        flat_number=data.get("flat_number"),
        plot_number=data.get("plot_number"),
        floor_unit=data.get("floor_unit"),
        postal_code=data["postal_code"],
        digi_pin=data.get("digi_pin"),
        landmark=data.get("landmark"),
        qr_code_path=data.get("qr_code_path"),
        is_flagged=data.get("is_flagged", False),
        flag_reason=data.get("flag_reason"),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def update_cyracode_entry(db: Session, entry: CyraCode, data: dict) -> CyraCode:
    """Update the editable address fields of an existing CyraCode.

    ``code_name`` is intentionally never touched — it is unique and immutable.
    """
    entry.latitude = data["latitude"]
    entry.longitude = data["longitude"]
    entry.country = data["country"]
    entry.country_code = data["country_code"]
    entry.state = data.get("state")
    entry.district = data.get("district")
    entry.city = data.get("city")
    entry.area = data.get("area")
    entry.town = data.get("town")
    entry.road_name = data.get("road_name")
    entry.street_address = data["street_address"]
    entry.building_name = data.get("building_name")
    entry.flat_number = data.get("flat_number")
    entry.plot_number = data.get("plot_number")
    entry.floor_unit = data.get("floor_unit")
    entry.postal_code = data["postal_code"]
    entry.digi_pin = data.get("digi_pin")
    entry.landmark = data.get("landmark")
    entry.updated_at = datetime.utcnow()
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def generate_qr_code(cyracode_name: str, lat: float, lng: float) -> str:
    """Generate a QR code and return it as a base64 data URI.

    AC 6.10: WebP is used where Pillow supports it (<100 KB); falls back to PNG.
    """
    payload = f"CYRACODE:{cyracode_name}|{lat},{lng}"
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#FF6B35", back_color="white")
    # Convert to RGB so WebP encoder handles it correctly
    rgb_img = img.convert("RGB")
    buffer = io.BytesIO()
    try:
        rgb_img.save(buffer, format="WEBP", quality=85, method=4)
        mime = "image/webp"
    except Exception:
        buffer = io.BytesIO()
        rgb_img.save(buffer, format="PNG")
        mime = "image/png"
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:{mime};base64,{encoded}"
