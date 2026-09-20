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
    # Three user types — User (default), Client, Admin. A single mutually
    # exclusive role drives what each account can do; `is_admin` stays as a
    # derived convenience property so existing callers/APIs keep working.
    role = Column("Role", String(20), default="user", nullable=False)
    remember_me = Column("RememberMe", Boolean, default=False)
    gdpr_consent = Column("GdprConsent", Boolean, default=False)
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)
    updated_at = Column(
        "UpdatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @is_admin.setter
    def is_admin(self, value: bool) -> None:
        self.role = "admin" if value else "user"

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
    city = Column("City", String(100), nullable=True)
    area = Column("Area", String(100), nullable=True)
    town = Column("Town", String(100), nullable=True)
    road_name = Column("RoadName", String(100), nullable=True)
    avenue_name = Column("AvenueName", String(100), nullable=True)
    street_address = Column("StreetAddress", String(255), nullable=False)
    building_name = Column("BuildingName", String(100), nullable=True)
    flat_number = Column("FlatNumber", String(50), nullable=True)
    suite_name = Column("SuiteName", String(50), nullable=True)
    plot_number = Column("PlotNumber", String(50), nullable=True)
    floor_unit = Column("FloorUnit", String(50), nullable=True)
    postal_code = Column("PostalCode", String(20), nullable=False)
    # Renamed to "P.O. Box" in the UI/API; DB column stays "DigiPin" to
    # preserve existing stored data without a schema migration.
    po_box = Column("DigiPin", String(10), nullable=True)
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
    # AC 6.17: cached responses are scoped to the user who created them so one
    # user can never receive another user's cached registration data.
    user_id = Column("UserId", String(36), ForeignKey("Users.Id"), nullable=True, index=True)
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


class ApiClient(Base):
    """CyraCode Address Lookup API client credential.

    Each row is a credential an organization issues to a consumer of the
    ``GET /cyracode/{cyracode}/address`` endpoint. ``is_active`` gates a
    credential globally, while the client-to-permission join lets admins grant
    or revoke the ``cyracode.lookup`` permission per client without code
    changes (acceptance criterion: "granted or revoked without code changes").
    """

    __tablename__ = "ApiClients"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    # Display name chosen by the administrator (e.g. a partner organization).
    name = Column("Name", String(100), nullable=False)
    # Indexable lookup digest (HMAC-SHA256 hex of the peppered key). Used to
    # find the client row in O(1); the raw key is never stored.
    key_id = Column("KeyId", String(64), nullable=False, index=True)
    api_key_hash = Column("ApiKeyHash", String(255), nullable=False)
    # Last 4 chars of the raw key, kept for operator recognition / masking.
    key_tail = Column("KeyTail", String(4), nullable=False)
    contact_email = Column("ContactEmail", String(255), nullable=True)
    is_active = Column("IsActive", Boolean, default=True)
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)
    updated_at = Column(
        "UpdatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    permissions = relationship(
        "ClientApiPermission", back_populates="client", cascade="all, delete-orphan"
    )
    # Zero-or-one current subscription row (the admin billing plan).
    subscription = relationship(
        "ClientSubscription", back_populates="client", uselist=False,
        cascade="all, delete-orphan",
    )


class ClientApiPermission(Base):
    """Grant table: which ApiClient may call which cyracode API capability.

    This is the "configurable authorization" layer — an administrator creates
    a permission row to authorize a client and deletes it to revoke access,
    with no application code change required.
    """

    __tablename__ = "ClientApiPermissions"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    client_id = Column("ClientId", String(36), ForeignKey("ApiClients.Id"), nullable=False)
    # Permission key, e.g. "cyracode.lookup" (address lookup).
    permission = Column("Permission", String(100), nullable=False)
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)

    client = relationship("ApiClient", back_populates="permissions")


class ClientAccessLog(Base):
    """Audit log for every CyraCode Address Lookup API request.

    Records who (masked key), what endpoint was hit, the outcome, and how long
    it took — enough for security monitoring and compliance without storing the
    raw secret.
    """

    __tablename__ = "ClientAccessLogs"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    client_id = Column("ClientId", String(36), ForeignKey("ApiClients.Id"), nullable=True)
    client_name = Column("ClientName", String(100), nullable=True)
    key_tail = Column("KeyTail", String(4), nullable=True)
    endpoint = Column("Endpoint", String(200), nullable=False)
    method = Column("Method", String(10), nullable=False)
    ip_address = Column("IpAddress", String(50), nullable=True)
    status_code = Column("StatusCode", Integer, nullable=True)
    response_time_ms = Column("ResponseTimeMs", Integer, nullable=True)
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)


class Plan(Base):
    """Billable subscription tier (Basic / Pro / Enterprise).

    Admin assigns a Plan to an ApiClient via ClientSubscription. Costs are USD
    per month and are snapshotted onto the subscription so later price edits
    don't rewrite historical billing figures.
    """

    __tablename__ = "Plans"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    code = Column("Code", String(20), unique=True, nullable=False, index=True)
    name = Column("Name", String(50), nullable=False)
    monthly_cost = Column("MonthlyCost", Integer, nullable=False)
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)

    subscriptions = relationship("ClientSubscription", back_populates="plan")


class ClientSubscription(Base):
    """A client's current plan enrollment, with start/end billing window.

    ``status`` is the durable lifecycle state ('active' | 'cancelled'). The
    derived *display* status (active / expiring / expired / cancelled) is
    computed from ``end_date`` + ``status`` by ``subscription_status()`` so rows
    never need a background job to roll over.
    """

    __tablename__ = "ClientSubscriptions"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    client_id = Column("ClientId", String(36), ForeignKey("ApiClients.Id"), nullable=False)
    plan_id = Column("PlanId", String(36), ForeignKey("Plans.Id"), nullable=True)
    # Snapshots so billing history survives plan edits/deletes.
    plan_name = Column("PlanName", String(50), nullable=False)
    monthly_cost = Column("MonthlyCost", Integer, nullable=False)
    start_date = Column("StartDate", DateTime, nullable=False)
    end_date = Column("EndDate", DateTime, nullable=False)
    status = Column("Status", String(20), nullable=False, default="active")
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)
    updated_at = Column(
        "UpdatedAt", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    client = relationship("ApiClient", back_populates="subscription")
    plan = relationship("Plan", back_populates="subscriptions")


class Transaction(Base):
    """Billing transaction generated when a subscription is set or renewed.

    Snapshots client/plan/amount so the revenue trend and recent-transactions
    feed stay stable even when clients or plans change afterwards.
    """

    __tablename__ = "Transactions"

    id = Column("Id", String(36), primary_key=True, default=_uuid)
    client_id = Column("ClientId", String(36), ForeignKey("ApiClients.Id"), nullable=True)
    client_name = Column("ClientName", String(100), nullable=False)
    plan_name = Column("PlanName", String(50), nullable=False)
    amount = Column("Amount", Integer, nullable=False)
    status = Column("Status", String(20), nullable=False, default="paid")
    created_at = Column("CreatedAt", DateTime, default=datetime.utcnow)

    client = relationship("ApiClient")
