import json
import re
import unicodedata
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import CyraCode, IdempotencyKey, OTPRecord, User
from app.rate_limiter import limiter
from app.services.auth_service import get_current_user
from app.services.registration_service import (
    check_name_available,
    create_cyracode_entry,
    generate_cyracode,
    generate_qr_code,
    suggest_alternative_names,
    update_cyracode_entry,
    validate_coordinates,
    validate_coordinates_not_ocean,
)
from app.services.spam_service import check_name as spam_check_name

router = APIRouter(prefix="/registration", tags=["registration"])

IDEMPOTENCY_TTL_HOURS = 24

# Format: LL#LL##L##L#  (L=letter any case, #=digit) e.g. Aa2DF43T91q5
AUTO_CODE_PATTERN = re.compile(r"^[A-Za-z]{2}\d[A-Za-z]{2}\d{2}[A-Za-z]\d{2}[A-Za-z]\d$")


# ---------- Helpers ----------
def _normalize_e164(mobile: str) -> str:
    """Strip formatting and ensure E.164 (+[digits]) format."""
    digits = re.sub(r"[^\d+]", "", mobile)
    if not digits.startswith("+"):
        digits = "+" + digits
    return digits


def _send_confirmation_email(
    email: str,
    name: str,
    code_name: str,
    address_line: str,
    lat: float,
    lng: float,
) -> None:
    """Mock confirmation email. Replace with real SMTP/SendGrid in production."""
    print(f"[EMAIL SERVICE] Sending confirmation email to {email}")
    print(f"  Name: {name}")
    print(f"  CyraCode: {code_name}")
    print(f"  Address: {address_line}")
    print(f"  Coordinates: {lat}, {lng}")
    print(f"  Google Maps: https://maps.google.com/?q={lat},{lng}")


def _get_idempotency(db: Session, key: str) -> Optional[dict]:
    record = (
        db.query(IdempotencyKey)
        .filter(
            IdempotencyKey.key == key,
            IdempotencyKey.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if record and record.response_json:
        return json.loads(record.response_json)
    return None


def _store_idempotency(db: Session, key: str, endpoint: str, response: dict) -> None:
    existing = db.query(IdempotencyKey).filter(IdempotencyKey.key == key).first()
    if existing:
        return
    record = IdempotencyKey(
        key=key,
        endpoint=endpoint,
        response_json=json.dumps(response),
        expires_at=datetime.utcnow() + timedelta(hours=IDEMPOTENCY_TTL_HOURS),
    )
    db.add(record)
    db.commit()


# ---------- Schemas ----------
class CheckNameResponse(BaseModel):
    available: bool
    suggestions: List[str] = []


class GenerateCodeRequest(BaseModel):
    lat: float
    lng: float


class GenerateCodeResponse(BaseModel):
    code: str


class RegistrationRequest(BaseModel):
    name: str = Field(..., min_length=3, max_length=50)
    latitude: float
    longitude: float
    # AC 6.22: field length limits per country address standards
    country: str = Field(..., max_length=100)
    country_code: str = Field(..., max_length=10)
    state: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    area: Optional[str] = Field(None, max_length=100)
    town: Optional[str] = Field(None, max_length=100)
    road_name: Optional[str] = Field(None, max_length=100)
    street_address: str = Field(..., min_length=1, max_length=100)
    building_name: Optional[str] = Field(None, max_length=100)
    flat_number: Optional[str] = Field(None, max_length=50)
    plot_number: Optional[str] = Field(None, max_length=50)
    floor_unit: Optional[str] = Field(None, max_length=50)
    postal_code: str = Field(..., min_length=1, max_length=20)
    digi_pin: Optional[str] = Field(None, max_length=10)
    landmark: Optional[str] = Field(None, max_length=100)
    verified_mobile: str

    @field_validator("name")
    @classmethod
    def validate_name_unicode(cls, v: str) -> str:
        """
        International Character Support: allow Unicode letters, digits, and spaces.
        Rejects any character that is not a Unicode letter (L*), digit (N*), or space.
        """
        for char in v:
            cat = unicodedata.category(char)
            if not (cat.startswith("L") or cat.startswith("N") or char == " "):
                raise ValueError(
                    "Name must contain only letters, numbers, and spaces. "
                    "Unicode characters (Hindi, Arabic, Chinese, Cyrillic, etc.) are supported."
                )
        return v

    @field_validator("verified_mobile")
    @classmethod
    def validate_mobile_e164(cls, v: str) -> str:
        """AC 6.21: Normalize to E.164 and validate length (10–15 digits, country code included)."""
        digits = re.sub(r"[^\d+]", "", v)
        if not digits.startswith("+"):
            digits = "+" + digits
        digit_count = len(digits) - 1  # digits after the leading '+'
        if not (10 <= digit_count <= 15):
            raise ValueError(
                "Mobile number must be in E.164 format with 10–15 digits "
                "(e.g. +919876543210)."
            )
        return digits


class CyraCodeResponse(BaseModel):
    id: str
    code_name: str
    code_type: str
    latitude: float
    longitude: float
    country: str
    country_code: str
    state: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    area: Optional[str] = None
    town: Optional[str] = None
    road_name: Optional[str] = None
    street_address: str
    building_name: Optional[str] = None
    flat_number: Optional[str] = None
    plot_number: Optional[str] = None
    floor_unit: Optional[str] = None
    postal_code: str
    digi_pin: Optional[str] = None
    landmark: Optional[str] = None
    qr_code: Optional[str] = None

    class Config:
        from_attributes = True


class UpdateCyraCodeRequest(BaseModel):
    """Address fields that may be edited on an existing CyraCode.

    ``name`` (code_name) and ``verified_mobile`` are deliberately absent:
    the CyraCode name is unique and immutable, and editing an address does not
    require re-verifying the mobile number via OTP.
    """
    latitude: float
    longitude: float
    country: str = Field(..., max_length=100)
    country_code: str = Field(..., max_length=10)
    state: Optional[str] = Field(None, max_length=100)
    district: Optional[str] = Field(None, max_length=100)
    city: Optional[str] = Field(None, max_length=100)
    area: Optional[str] = Field(None, max_length=100)
    town: Optional[str] = Field(None, max_length=100)
    road_name: Optional[str] = Field(None, max_length=100)
    street_address: str = Field(..., min_length=1, max_length=100)
    building_name: Optional[str] = Field(None, max_length=100)
    flat_number: Optional[str] = Field(None, max_length=50)
    plot_number: Optional[str] = Field(None, max_length=50)
    floor_unit: Optional[str] = Field(None, max_length=50)
    postal_code: str = Field(..., min_length=1, max_length=20)
    digi_pin: Optional[str] = Field(None, max_length=10)
    landmark: Optional[str] = Field(None, max_length=100)


class AutoGenerateRegistrationRequest(RegistrationRequest):
    """AC 3.3 / AC 3.5: server-side enforcement that name matches the auto-generate format."""

    @field_validator("name")
    @classmethod
    def validate_auto_code_format(cls, v: str) -> str:
        if not AUTO_CODE_PATTERN.match(v):
            raise ValueError(
                "Auto-generated code must be exactly 12 characters in format: "
                "2 letters, 1 digit, 2 letters, 2 digits, 1 letter, 2 digits, 1 letter, 1 digit "
                "(e.g. Aa2DF43T91q5)."
            )
        return v


@router.get("/check-name/{name}", response_model=CheckNameResponse)
def check_name(name: str, db: Session = Depends(get_db)):
    available = check_name_available(db, name)
    suggestions = [] if available else suggest_alternative_names(db, name)
    return CheckNameResponse(available=available, suggestions=suggestions)


@router.post("/generate-code", response_model=GenerateCodeResponse)
@limiter.limit("15/10minutes")  # Edge case: max 10 regens per session + buffer
def generate_code(request: Request, payload: GenerateCodeRequest, db: Session = Depends(get_db)):
    if not validate_coordinates(payload.lat, payload.lng):
        raise HTTPException(status_code=400, detail="Invalid coordinates.")
    # AC 6.18: reject ocean/uninhabited locations server-side
    if not validate_coordinates_not_ocean(payload.lat, payload.lng):
        raise HTTPException(
            status_code=400,
            detail="Selected location appears to be in an uninhabited or ocean area.",
        )
    code = generate_cyracode(payload.lat, payload.lng, db)
    return GenerateCodeResponse(code=code)


def _register(
    payload: RegistrationRequest,
    code_type: str,
    user: User,
    db: Session,
    idempotency_key: Optional[str] = None,
    skip_spam_check: bool = False,
) -> CyraCodeResponse:
    # Idempotency check
    if idempotency_key:
        cached = _get_idempotency(db, idempotency_key)
        if cached:
            return CyraCodeResponse(**cached)

    if not validate_coordinates(payload.latitude, payload.longitude):
        raise HTTPException(status_code=400, detail="Invalid coordinates.")

    # AC 6.18: server-side ocean/uninhabited land check (fails open if no API key)
    if not validate_coordinates_not_ocean(payload.latitude, payload.longitude):
        raise HTTPException(
            status_code=400,
            detail="Selected location appears to be in an uninhabited or ocean area. Please select a valid address.",
        )

    # Normalize mobile early so it can be used in all subsequent checks
    normalized_mobile = _normalize_e164(payload.verified_mobile)

    # AC 2.23: Confirm mobile was OTP-verified within the last hour
    verified_otp = (
        db.query(OTPRecord)
        .filter(
            OTPRecord.mobile == normalized_mobile,
            OTPRecord.is_used == True,  # noqa: E712
            OTPRecord.verified_at >= datetime.utcnow() - timedelta(hours=1),
        )
        .first()
    )
    if not verified_otp:
        raise HTTPException(
            status_code=400,
            detail="Mobile number must be verified via OTP before registration.",
        )

    if not check_name_available(db, payload.name):
        raise HTTPException(
            status_code=409, detail="This CyraCode name is already taken."
        )

    # Spam Name Detection: skip for auto-generated codes (machine-generated, not user-chosen)
    is_blocked, block_reason, should_flag, flag_reason = False, "", False, ""
    if not skip_spam_check:
        is_blocked, block_reason, should_flag, flag_reason = spam_check_name(payload.name)
        if is_blocked:
            raise HTTPException(
                status_code=422,
                detail=f"Name rejected by content filter: {block_reason}",
            )

    qr = generate_qr_code(payload.name, payload.latitude, payload.longitude)

    data = payload.model_dump()
    data["code_name"] = payload.name
    data["code_type"] = code_type
    data["qr_code_path"] = None
    data["verified_mobile"] = normalized_mobile
    data["is_flagged"] = should_flag
    data["flag_reason"] = flag_reason if should_flag else None

    entry = create_cyracode_entry(db, user.id, data)

    response = CyraCodeResponse.model_validate(entry)
    response.qr_code = qr

    # Send confirmation email (mocked)
    address_parts = [
        payload.flat_number,
        payload.plot_number,
        payload.building_name,
        payload.street_address,
        payload.road_name,
        payload.area,
        payload.town,
        payload.city,
        payload.state,
        payload.postal_code,
        payload.digi_pin,
        payload.country,
    ]
    address_line = ", ".join(p for p in address_parts if p)
    _send_confirmation_email(
        email=user.email,
        name=f"{user.first_name} {user.last_name}",
        code_name=payload.name,
        address_line=address_line,
        lat=payload.latitude,
        lng=payload.longitude,
    )

    # Cache idempotency response
    if idempotency_key:
        _store_idempotency(
            db,
            idempotency_key,
            code_type,
            response.model_dump(),
        )

    return response


@router.post("/traditional", response_model=CyraCodeResponse, status_code=201)
def register_traditional(
    payload: RegistrationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
):
    return _register(payload, "traditional", user, db, x_idempotency_key)


@router.post("/auto-generate", response_model=CyraCodeResponse, status_code=201)
def register_auto_generate(
    payload: AutoGenerateRegistrationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
):
    # AC 3.3: skip_spam_check=True — code is machine-generated, not user-chosen
    return _register(payload, "auto_generate", user, db, x_idempotency_key, skip_spam_check=True)


@router.get("/my-codes", response_model=List[CyraCodeResponse])
def my_codes(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    codes = (
        db.query(CyraCode)
        .filter(CyraCode.user_id == user.id, CyraCode.is_active == True)  # noqa: E712
        .order_by(CyraCode.created_at.desc())
        .all()
    )
    return [CyraCodeResponse.model_validate(c) for c in codes]


@router.put("/my-codes/{code_id}", response_model=CyraCodeResponse)
def update_my_code(
    code_id: str,
    payload: UpdateCyraCodeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Edit the address of one of the authenticated user's CyraCodes.

    The CyraCode ``code_name`` is unique and immutable, so it is never updated
    here — only the address/coordinate fields may change.
    """
    entry = (
        db.query(CyraCode)
        .filter(
            CyraCode.id == code_id,
            CyraCode.user_id == user.id,
            CyraCode.is_active == True,  # noqa: E712
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="CyraCode not found.")

    if not validate_coordinates(payload.latitude, payload.longitude):
        raise HTTPException(status_code=400, detail="Invalid coordinates.")

    if not validate_coordinates_not_ocean(payload.latitude, payload.longitude):
        raise HTTPException(
            status_code=400,
            detail="Selected location appears to be in an uninhabited or ocean area. Please select a valid address.",
        )

    data = payload.model_dump()
    entry = update_cyracode_entry(db, entry, data)
    return CyraCodeResponse.model_validate(entry)
