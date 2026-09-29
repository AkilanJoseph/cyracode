"""Public Contact-us enquiry endpoint backing the site widget.

Unauthenticated on purpose: the whole point is to let a visitor who has not
signed up yet reach support. That also makes it an open relay into the support
inbox, so it is rate limited per IP, length-capped, and the sender address is
only ever used as a Reply-To header.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.config import settings
from app.rate_limiter import limiter
from app.services.email_service import send_contact_message_email

router = APIRouter(prefix="/contact", tags=["contact"])

# Keep in sync with SUPPORT_EMAIL in the frontend Footer.
SUPPORT_EMAIL = "support@cyracode.com"


def _strip(value: str) -> str:
    """Trim a free-text field and reject it if nothing is left.

    ``min_length`` alone lets a run of spaces through, since " " is a valid
    non-empty string. Stripping first means the stored value is canonical and
    whitespace-only input is a 422 rather than a blank mail to support.
    """
    trimmed = (value or "").strip()
    if not trimmed:
        raise ValueError("must not be blank")
    return trimmed


class ContactRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: EmailStr
    address: str = Field(..., min_length=1, max_length=300)
    message: str = Field(..., min_length=1, max_length=4000)

    _clean_name = field_validator("name")(_strip)
    _clean_address = field_validator("address")(_strip)
    _clean_message = field_validator("message")(_strip)


class ContactResponse(BaseModel):
    message: str


@router.post("", response_model=ContactResponse, status_code=202)
@limiter.limit("5/minute")
def submit_enquiry(request: Request, payload: ContactRequest):
    """Forward a widget enquiry to the support inbox (no auth)."""
    try:
        send_contact_message_email(
            to_email=SUPPORT_EMAIL,
            name=payload.name,
            sender_email=str(payload.email),
            address=payload.address,
            message=payload.message,
        )
    except Exception as exc:  # pragma: no cover - SMTP/network failure
        print(f"[CONTACT] Delivery failed for {payload.email}: {exc}")
        raise HTTPException(
            status_code=502,
            detail="Could not send your message right now. Please try again later.",
        ) from exc

    return ContactResponse(
        message="Thanks for reaching out. Our support team will get back to you shortly."
    )
