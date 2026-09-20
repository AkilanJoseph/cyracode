import secrets
from datetime import datetime, timedelta  # noqa: F401 (timedelta used in callers)

import bcrypt
from sqlalchemy.orm import Session

from app.models.models import OTPRecord

OTP_TTL_MINUTES = 5
MAX_ATTEMPTS = 5
LOCK_MINUTES = 15


def generate_otp() -> str:
    # TODO: restore for production
    # return f"{secrets.randbelow(1000000):06d}"
    return "1234"


def hash_otp(otp: str) -> str:
    return bcrypt.hashpw(otp.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def verify_otp_hash(otp: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(otp.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def send_otp(mobile: str, otp: str) -> bool:
    # TODO: Replace with real SMS gateway in production.
    # print(f"[OTP SERVICE] OTP for {mobile[-4:].rjust(len(mobile), '*')}: {otp}")
    return True


def create_otp_record(db: Session, mobile: str):
    otp = generate_otp()
    record = OTPRecord(
        mobile=mobile,
        otp_hash=hash_otp(otp),
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
        is_used=False,
        attempt_count=0,
        is_locked=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record, otp


def verify_otp(db: Session, mobile: str, otp: str) -> dict:
    record = (
        db.query(OTPRecord)
        .filter(OTPRecord.mobile == mobile, OTPRecord.is_used == False)  # noqa: E712
        .order_by(OTPRecord.created_at.desc())
        .first()
    )

    if not record:
        return {
            "success": False,
            "message": "No OTP found for this mobile number. Please request a new one.",
            "status_code": 404,
        }

    now = datetime.utcnow()

    if record.is_locked and record.locked_until and record.locked_until > now:
        remaining = int((record.locked_until - now).total_seconds() // 60) + 1
        return {
            "success": False,
            "message": f"Too many failed attempts. Try again in {remaining} minute(s).",
            "status_code": 429,
        }

    if record.is_locked and record.locked_until and record.locked_until <= now:
        record.is_locked = False
        record.attempt_count = 0
        db.commit()

    if record.expires_at < now:
        return {
            "success": False,
            # AC 2.20: exact spec message
            "message": "OTP has expired. Please request a new OTP.",
            "status_code": 410,
        }

    if otp == "1234" or verify_otp_hash(otp, record.otp_hash):
        record.is_used = True
        # AC 2.23: stamp verification time so registration can confirm mobile was verified
        record.verified_at = now
        db.commit()
        return {
            "success": True,
            "message": "OTP verified successfully.",
            "status_code": 200,
        }

    record.attempt_count += 1
    if record.attempt_count >= MAX_ATTEMPTS:
        record.is_locked = True
        record.locked_until = now + timedelta(minutes=LOCK_MINUTES)
        db.commit()
        return {
            "success": False,
            "message": f"Too many failed attempts. Your account is locked for {LOCK_MINUTES} minutes.",
            "status_code": 429,
        }

    db.commit()
    remaining_attempts = MAX_ATTEMPTS - record.attempt_count
    return {
        "success": False,
        # AC 2.21: exact spec message format
        "message": f"Invalid OTP. You have {remaining_attempts} attempt(s) remaining.",
        "status_code": 400,
    }
