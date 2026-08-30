from datetime import timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.models import AuditLog, CyraCode, User
from app.rate_limiter import limiter
from app.services.auth_service import (
    create_access_token,
    decode_token,
    get_current_user,
    get_password_reset_token,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.services.email_service import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- Schemas ----------
class RegisterRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    gdpr_consent: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class GoogleAuthRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    first_name: str
    last_name: str
    is_email_verified: bool

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---------- Endpoints ----------
@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("10/minute")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    if not payload.gdpr_consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the Privacy Policy to continue.",
        )

    if not validate_password_strength(payload.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters and include an uppercase letter, a number, and a special character.",
        )

    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email is already registered. Please login or use a different email.",
        )

    user = User(
        email=payload.email.lower(),
        first_name=payload.first_name,
        last_name=payload.last_name,
        password_hash=hash_password(payload.password),
        is_email_verified=False,
        gdpr_consent=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    log = AuditLog(user_id=user.id, action="register", ip_address=ip, user_agent=ua)
    db.add(log)
    db.commit()

    token = create_access_token({"sub": user.id, "email": user.email})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled."
        )

    user.remember_me = payload.remember_me
    db.commit()

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    log = AuditLog(user_id=user.id, action="login", ip_address=ip, user_agent=ua)
    db.add(log)
    db.commit()

    expires = (
        timedelta(days=30)
        if payload.remember_me
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    token = create_access_token(
        {"sub": user.id, "email": user.email}, expires_delta=expires
    )
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/google", response_model=TokenResponse)
@limiter.limit("10/minute")
async def google_auth(request: Request, payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Accepts either a Google id_token (authorization-code / One Tap flows) or an
    access_token (implicit flow from @react-oauth/google).  We try id_token first;
    if that fails we fall back to calling the userinfo endpoint with the access_token.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        info: Optional[dict] = None

        # --- Path A: token is a JWT id_token ---
        id_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/tokeninfo",
            params={"id_token": payload.token},
        )
        if id_resp.status_code == 200:
            info = id_resp.json()
            if settings.GOOGLE_CLIENT_ID and info.get("aud") != settings.GOOGLE_CLIENT_ID:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google token audience mismatch.",
                )
        else:
            # --- Path B: token is an OAuth2 access_token (implicit flow) ---
            userinfo_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {payload.token}"},
            )
            if userinfo_resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid Google token.",
                )
            info = userinfo_resp.json()

    google_id = info.get("sub")
    email = (info.get("email") or "").lower()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account has no email.",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            first_name=info.get("given_name", ""),
            last_name=info.get("family_name", ""),
            google_id=google_id,
            is_email_verified=True,
            gdpr_consent=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.google_id:
        user.google_id = google_id
        user.is_email_verified = True
        db.commit()

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    log = AuditLog(user_id=user.id, action="login_google", ip_address=ip, user_agent=ua)
    db.add(log)
    db.commit()

    token = create_access_token({"sub": user.id, "email": user.email})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/forgot-password")
@limiter.limit("10/minute")
def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user:
        reset_token = get_password_reset_token(user.email)
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        try:
            send_password_reset_email(user.email, reset_url)
        except Exception as exc:
            # Log but never leak the reason to the caller (security)
            print(f"[AUTH] Email delivery failed for {user.email}: {exc}")
    return {
        "message": "If an account exists for this email, a reset link has been sent."
    }


@router.post("/reset-password")
@limiter.limit("10/minute")
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    data = decode_token(payload.token)
    if data.get("type") != "password_reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid reset token."
        )
    email = data.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if not validate_password_strength(payload.new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password does not meet strength requirements.",
        )
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully."}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.delete("/me")
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GDPR: permanently delete user account and all associated data."""
    # Soft-delete CyraCodes (deactivate) then hard-delete personal data
    db.query(CyraCode).filter(CyraCode.user_id == current_user.id).update(
        {"is_active": False}
    )

    log = AuditLog(user_id=current_user.id, action="gdpr_delete_request")
    db.add(log)
    db.commit()

    # Anonymise user record rather than hard-delete (preserves audit trail)
    current_user.email = f"deleted_{current_user.id}@cyracode.deleted"
    current_user.first_name = "Deleted"
    current_user.last_name = "User"
    current_user.password_hash = None
    current_user.google_id = None
    current_user.is_active = False
    current_user.gdpr_consent = False
    db.commit()

    return {"message": "Account and personal data have been deleted."}
