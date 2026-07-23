import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import OTPRecord
from app.services.otp_service import create_otp_record, send_otp, verify_otp

router = APIRouter(prefix="/otp", tags=["otp"])

COOLDOWN_SECONDS = 30


def _normalize_e164(mobile: str) -> str:
    """Normalize to E.164: strip non-digit chars, ensure leading +."""
    digits = re.sub(r"[^\d+]", "", mobile)
    if not digits.startswith("+"):
        digits = "+" + digits
    return digits


class SendOTPRequest(BaseModel):
    mobile: str = Field(..., min_length=6, max_length=20)


class VerifyOTPRequest(BaseModel):
    mobile: str = Field(..., min_length=6, max_length=20)
    otp: str = Field(..., min_length=4, max_length=6)


@router.post("/send")
def send(payload: SendOTPRequest, db: Session = Depends(get_db)):
    payload.mobile = _normalize_e164(payload.mobile)
    last = (
        db.query(OTPRecord)
        .filter(OTPRecord.mobile == payload.mobile)
        .order_by(OTPRecord.created_at.desc())
        .first()
    )
    if last and last.created_at:
        elapsed = (datetime.utcnow() - last.created_at).total_seconds()
        if elapsed < COOLDOWN_SECONDS:
            wait = int(COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {wait}s before requesting a new OTP.",
            )

    record, otp = create_otp_record(db, payload.mobile)
    send_otp(payload.mobile, otp)
    # Timezone: expires_at stored/returned as UTC ISO-8601; frontend converts to local time
    return {
        "success": True,
        "message": "OTP sent successfully.",
        "expires_in": 300,
        "expires_at": record.expires_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


@router.post("/verify")
def verify(payload: VerifyOTPRequest, db: Session = Depends(get_db)):
    payload.mobile = _normalize_e164(payload.mobile)
    result = verify_otp(db, payload.mobile, payload.otp)
    if not result["success"]:
        raise HTTPException(
            status_code=result["status_code"], detail=result["message"]
        )
    return {"success": True, "message": result["message"], "verified": True}
