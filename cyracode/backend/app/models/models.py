import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "Users"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    email = Column("Email", String(255), unique=True, nullable=False, index=True)
    first_name = Column("FirstName", String(100), nullable=False)
    last_name = Column("LastName", String(100), nullable=False)
    password_hash = Column("PasswordHash", String(255), nullable=True)
    google_id = Column("GoogleId", String(255), nullable=True, unique=True)
    is_email_verified = Column("IsEmailVerified", Boolean, default=False)
    is_active = Column("IsActive", Boolean, default=True)
    remember_me = Column("RememberMe", Boolean, default=False)
    gdpr_consent = Column("GdprConsent", Boolean, default=False)
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)
    updated_at = Column(
        "UpdatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    cyracodes = relationship("CyraCode", back_populates="user")


class CyraCode(Base):
    __tablename__ = "CyraCodes"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    user_id = Column("UserId", String(36), ForeignKey("Users.Id"), nullable=False)
    code_name = Column("CodeName", String(50), unique=True, nullable=False, index=True)
    code_type = Column("CodeType", String(20), nullable=False)
    latitude = Column("Latitude", Numeric(10, 7), nullable=False)
    longitude = Column("Longitude", Numeric(10, 7), nullable=False)
    country = Column("Country", String(100), nullable=False)
    country_code = Column("CountryCode", String(10), nullable=False)
    state = Column("State", String(100), nullable=True)
    district = Column("District", String(100), nullable=True)
    city = Column("City", String(100), nullable=False)
    street_address = Column("StreetAddress", String(255), nullable=False)
    building_name = Column("BuildingName", String(100), nullable=True)
    flat_plot_number = Column("FlatPlotNumber", String(50), nullable=True)
    floor_unit = Column("FloorUnit", String(50), nullable=True)
    postal_code = Column("PostalCode", String(20), nullable=False)
    landmark = Column("Landmark", String(100), nullable=True)
    is_active = Column("IsActive", Boolean, default=True)
    qr_code_path = Column("QrCodePath", String(500), nullable=True)
    # Spam / content moderation flags
    is_flagged = Column("IsFlagged", Boolean, default=False)
    flag_reason = Column("FlagReason", String(255), nullable=True)
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)
    updated_at = Column(
        "UpdatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = relationship("User", back_populates="cyracodes")


class OTPRecord(Base):
    __tablename__ = "OTPRecords"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    mobile = Column("Mobile", String(20), nullable=False, index=True)
    otp_hash = Column("OtpHash", String(255), nullable=False)
    expires_at = Column("ExpiresAt", DateTime, nullable=False)
    is_used = Column("IsUsed", Boolean, default=False)
    attempt_count = Column("AttemptCount", Integer, default=0)
    is_locked = Column("IsLocked", Boolean, default=False)
    locked_until = Column("LockedUntil", DateTime, nullable=True)
    # AC 2.23: timestamp set when OTP is successfully verified
    verified_at = Column("VerifiedAt", DateTime, nullable=True)
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)


class IdempotencyKey(Base):
    __tablename__ = "IdempotencyKeys"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    key = Column("Key", String(128), unique=True, nullable=False, index=True)
    endpoint = Column("Endpoint", String(100), nullable=False)
    response_json = Column("ResponseJson", Text, nullable=True)
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)
    expires_at = Column("ExpiresAt", DateTime, nullable=False)


class AuditLog(Base):
    __tablename__ = "AuditLogs"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    user_id = Column("UserId", String(36), ForeignKey("Users.Id"), nullable=True)
    action = Column("Action", String(100), nullable=False)
    ip_address = Column("IpAddress", String(50), nullable=True)
    user_agent = Column("UserAgent", String(500), nullable=True)
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)


class DeliveryRecord(Base):
    """AC 6.27: Persistent delivery history per tracking ID."""

    __tablename__ = "DeliveryRecords"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    cyracode_id = Column("CyraCodeId", String(36), ForeignKey("CyraCodes.Id"), nullable=False)
    tracking_id = Column("TrackingId", String(100), nullable=False, index=True)
    partner_key = Column("PartnerKey", String(50), nullable=True)
    status = Column("Status", String(50), nullable=False)
    delivered_at = Column("DeliveredAt", DateTime, nullable=True)
    proof_photo = Column("ProofPhoto", Text, nullable=True)
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)
    updated_at = Column("UpdatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cyracode = relationship("CyraCode")


class LogisticsAccessLog(Base):
    """AC 6.26: Audit log for all logistics API access."""

    __tablename__ = "LogisticsAccessLogs"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    partner_key = Column("PartnerKey", String(50), nullable=True)
    endpoint = Column("Endpoint", String(200), nullable=False)
    method = Column("Method", String(10), nullable=False)
    ip_address = Column("IpAddress", String(50), nullable=True)
    status_code = Column("StatusCode", Integer, nullable=True)
    response_time_ms = Column("ResponseTimeMs", Integer, nullable=True)
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)
