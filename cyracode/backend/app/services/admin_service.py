"""Service helpers for the Admin portal and CyraCode Address Lookup API.

Concentrates the security-critical pieces here so the routers stay thin:

* API key generation / hashing (``secrets`` + SHA-256, peppered by SECRET_KEY).
* Client permission checks shared by the lookup API and admin management UI.
* Billing: plan seeding, subscription assignment / renewal / cancellation, and
  generated transactions that feed the dashboard revenue numbers.
* Admin bootstrap (first-run admin account creation from env config).
"""
import hashlib
import secrets
from datetime import datetime, timedelta

import bcrypt
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models.models import (
    ApiClient,
    ClientApiPermission,
    ClientSubscription,
    Plan,
    Transaction,
    User,
)
from app.services.auth_service import hash_password, validate_password_strength

# Permission key governing the CyraCode Address Lookup endpoint.
LOOKUP_PERMISSION = "cyracode.lookup"

# Prefix keeps generated keys identifiable in logs/databases without storing
# the secret itself.
API_KEY_PREFIX = "cyra_"

# Catalog of billable plans (code, display name, USD per month).
DEFAULT_PLANS: list[dict] = [
    {"code": "basic", "name": "Basic", "monthly_cost": 500},
    {"code": "pro", "name": "Pro", "monthly_cost": 2000},
    {"code": "enterprise", "name": "Enterprise", "monthly_cost": 5000},
]

# Derived subscription lifecycle states.
SUB_ACTIVE = "active"
SUB_EXPIRING = "expiring"
SUB_EXPIRED = "expired"
SUB_CANCELLED = "cancelled"
# Days from the end date that a subscription is considered "expiring soon".
EXPIRING_SOON_DAYS = 7


def _pepper(raw: str) -> str:
    return f"{settings.SECRET_KEY}:{raw}"


def key_id_for(raw_key: str) -> str:
    """Deterministic lookup digest for a raw key.

    Indexed on ApiClient.KeyId so authentication is a single indexed query
    rather than a scan of every client's bcrypt hash. It is one-way (SHA-256),
    so the raw key can never be recovered from it.
    """
    return hashlib.sha256(_pepper(raw_key).encode("utf-8")).hexdigest()


def _bcrypt_input(raw_key: str) -> bytes:
    """Normalize the presentation before bcrypt.

    bcrypt silently truncates input at 72 bytes, and our peppered raw key alone
    is ~68 bytes. SHA-256 first (one-way) so the full entropy is folded into a
    64-char hex string well within the limit.
    """
    return hashlib.sha256(_pepper(raw_key).encode("utf-8")).hexdigest().encode("utf-8")


def get_client_by_key(db: Session, raw_key: str) -> ApiClient | None:
    """Resolve a raw API key to a client in one indexed lookup."""
    if not raw_key:
        return None
    return (
        db.query(ApiClient)
        .filter(ApiClient.key_id == key_id_for(raw_key), ApiClient.is_active == True)  # noqa: E712
        .first()
    )


def generate_api_key() -> str:
    """Generate a URL-safe, high-entropy API key (48 random bytes)."""
    return f"{API_KEY_PREFIX}{secrets.token_urlsafe(48)}"


def hash_api_key(raw_key: str) -> str:
    return bcrypt.hashpw(_bcrypt_input(raw_key), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_api_key(raw_key: str, stored_hash: str) -> bool:
    if not raw_key or not stored_hash:
        return False
    try:
        return bcrypt.checkpw(_bcrypt_input(raw_key), stored_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_api_client(
    db: Session,
    name: str,
    contact_email: str | None = None,
    permissions: list[str] | None = None,
) -> tuple[ApiClient, str]:
    """Create a client credential and return ``(client, raw_api_key)``.

    The raw key is returned exactly once — it is hashed at rest and can never
    be recovered again. Store it in the caller's response (admin UI "copy once").
    """
    raw_key = generate_api_key()
    client = ApiClient(
        name=name,
        key_id=key_id_for(raw_key),
        api_key_hash=hash_api_key(raw_key),
        key_tail=raw_key[-4:],
        contact_email=contact_email,
        is_active=True,
    )
    db.add(client)
    db.flush()  # assign client.id before adding permissions

    perms = [LOOKUP_PERMISSION] if permissions is None else permissions
    for perm in perms:
        if not is_valid_permission(perm):
            continue
        db.add(ClientApiPermission(client_id=client.id, permission=perm))

    db.commit()
    db.refresh(client)
    return client, raw_key


def is_valid_permission(permission: str) -> bool:
    return permission in {"cyracode.lookup"}


def client_has_permission(db: Session, client: ApiClient, permission: str) -> bool:
    exists = (
        db.query(ClientApiPermission)
        .filter(
            ClientApiPermission.client_id == client.id,
            ClientApiPermission.permission == permission,
        )
        .first()
    )
    return exists is not None


def grant_permission(db: Session, client_id: str, permission: str) -> ClientApiPermission:
    if not is_valid_permission(permission):
        raise ValueError(f"Invalid permission: {permission}")
    existing = (
        db.query(ClientApiPermission)
        .filter(
            ClientApiPermission.client_id == client_id,
            ClientApiPermission.permission == permission,
        )
        .first()
    )
    if existing:
        return existing
    perm = ClientApiPermission(client_id=client_id, permission=permission)
    db.add(perm)
    db.commit()
    db.refresh(perm)
    return perm


def revoke_permission(db: Session, client_id: str, permission: str) -> bool:
    perm = (
        db.query(ClientApiPermission)
        .filter(
            ClientApiPermission.client_id == client_id,
            ClientApiPermission.permission == permission,
        )
        .first()
    )
    if not perm:
        return False
    db.delete(perm)
    db.commit()
    return True


# ---------- Plans & subscriptions (billing) ----------

def ensure_plans(db: Session) -> None:
    """Seed the default plan catalog on first boot only.

    Seeding only when the table is empty preserves admin edits and deletions:
    a price change or removed plan is never silently reset by a restart.
    """
    if db.query(Plan).count() > 0:
        return
    for plan_def in DEFAULT_PLANS:
        db.add(
            Plan(
                code=plan_def["code"],
                name=plan_def["name"],
                monthly_cost=plan_def["monthly_cost"],
            )
        )
    db.commit()


def today_start() -> datetime:
    return datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)


def subscription_status(sub) -> str | None:
    """Derived display status from end-date + durable lifecycle state."""
    if sub is None:
        return None
    if sub.status == SUB_CANCELLED:
        return SUB_CANCELLED
    now = datetime.utcnow()
    if sub.end_date < now:
        return SUB_EXPIRED
    if sub.end_date <= now + timedelta(days=EXPIRING_SOON_DAYS):
        return SUB_EXPIRING
    return SUB_ACTIVE


def set_client_subscription(
    db: Session, client: ApiClient, plan_code: str, months: int
) -> ClientSubscription:
    """Assign (or change) a client's plan for ``months`` starting today.

    Existing subscription history is replaced in place; a paid transaction is
    recorded when the client moves to a new plan or gets their first plan.
    """
    ensure_plans(db)  # idempotent — keeps fresh deployments self-sufficient.
    plan = db.query(Plan).filter(Plan.code == plan_code).first()
    if not plan:
        raise ValueError(f"Unknown plan: {plan_code}")
    if months < 1 or months > 36:
        raise ValueError("Subscription months must be between 1 and 36.")

    today = today_start()
    end = today + timedelta(days=30 * months)
    sub = client.subscription

    is_new = sub is None
    if sub is None:
        sub = ClientSubscription(
            client_id=client.id,
            plan_id=plan.id,
            plan_name=plan.name,
            monthly_cost=plan.monthly_cost,
            start_date=today,
            end_date=end,
            status=SUB_ACTIVE,
        )
        db.add(sub)
    else:
        changed = sub.plan_id != plan.id
        sub.plan_id = plan.id
        sub.plan_name = plan.name
        sub.monthly_cost = plan.monthly_cost
        sub.start_date = today
        sub.end_date = end
        sub.status = SUB_ACTIVE
        sub.updated_at = datetime.utcnow()
    db.flush()

    if is_new or changed:
        db.add(
            Transaction(
                client_id=client.id,
                client_name=client.name,
                plan_name=plan.name,
                amount=plan.monthly_cost,
                status="paid",
            )
        )

    db.commit()
    db.refresh(sub)
    return sub


def renew_client_subscription(
    db: Session, client: ApiClient, months: int
) -> ClientSubscription:
    """Extend an active subscription by ``months`` from its current end date."""
    sub = client.subscription
    if sub is None or sub.status == SUB_CANCELLED:
        raise ValueError("This client has no active subscription to renew.")
    if months < 1 or months > 36:
        raise ValueError("Renewal months must be between 1 and 36.")

    base = max(today_start(), sub.end_date)
    sub.end_date = base + timedelta(days=30 * months)
    sub.status = SUB_ACTIVE
    sub.updated_at = datetime.utcnow()
    db.add(sub)
    db.flush()

    db.add(
        Transaction(
            client_id=client.id,
            client_name=client.name,
            plan_name=sub.plan_name,
            amount=sub.monthly_cost,
            status="paid",
        )
    )

    db.commit()
    db.refresh(sub)
    return sub


def cancel_client_subscription(db: Session, client: ApiClient) -> ClientSubscription:
    """Mark a client's subscription cancelled (kept for history)."""
    sub = client.subscription
    if sub is None or sub.status == SUB_CANCELLED:
        raise ValueError("This client has no active subscription to cancel.")
    sub.status = SUB_CANCELLED
    sub.updated_at = datetime.utcnow()
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def parse_months(raw: int) -> int:
    if not isinstance(raw, int) or raw < 1 or raw > 36:
        raise ValueError("Subscription months must be between 1 and 36.")
    return raw


def bootstrap_admin(db: Session) -> User | None:
    """Create the initial admin account on first startup (configured via env).

    Idempotent: if a user with ADMIN_EMAIL already exists it is simply promoted
    to admin; otherwise a new account is created. Returns the admin User or None
    when no ADMIN_EMAIL is configured.
    """
    email = (settings.ADMIN_EMAIL or "").strip().lower()
    if not email:
        return None
    if not settings.ADMIN_PASSWORD:
        return None

    user = db.query(User).filter(func.lower(User.email) == email).first()
    if user:
        if user.role != "admin":
            user.role = "admin"
            db.commit()
            db.refresh(user)
        return user

    password = settings.ADMIN_PASSWORD
    if not validate_password_strength(password):
        # Weak env passwords are still accepted for bootstrap, but we enforce
        # strength on any password change/reset going forward.
        pass

    user = User(
        email=email,
        first_name=settings.ADMIN_FIRST_NAME,
        last_name=settings.ADMIN_LAST_NAME,
        password_hash=hash_password(password),
        is_email_verified=True,
        gdpr_consent=True,
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user