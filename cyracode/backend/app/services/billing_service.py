"""Public self-serve billing for the CyraCode Address Lookup API plans.

Flow: a visitor picks a plan on the pricing page, enters their billing email
and a payment method on the checkout screen, and on success the backend:

1. persists an ``Order`` keyed to the normalized customer email,
2. provisions an ``ApiClient`` credential (the raw API key is returned once),
3. attaches a ``ClientSubscription`` + paid ``Transaction`` so the customer's
   subscription shows up in the admin billing dashboard (MRR etc.),
4. sends a best-effort confirmation email.

The plan catalog here (Sandbox/Developer/Growth/Scale/Enterprise) is the
public self-serve catalog and intentionally lives apart from the Admin-managed
catalog (Basic/Pro/Enterprise) — admin edits to the latter must never silently
change advertised customer prices.
"""
import json
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.models import (
    ApiClient,
    ClientSubscription,
    IdempotencyKey,
    Order,
    Transaction,
)
from app.services.admin_service import (
    LOOKUP_PERMISSION,
    SUB_ACTIVE,
    create_api_client,
    today_start,
)


# --------------------------------------------------------------------------
# Public plan catalog (USD, integer dollars, same numbers the pricing page shows)
# --------------------------------------------------------------------------

def _annual_per_month(monthly: int) -> int:
    """Annual price per month ≈ 20% off, rounded cleanly."""
    return (monthly * 8 + 5) // 10


#: feature keys get their display copy from the frontend i18n catalog.
PUBLIC_PLANS: dict[str, dict] = {
    "sandbox": {
        "name": "Sandbox",
        "sort": 0,
        "featured": False,
        "custom_price": False,
        "monthly_price": 0,
        "monthly_allowance": "1,000",
        "overage_rate": None,
        "features": [
            "up_to_1k",
            "lookup_basic",
            "support_community",
        ],
    },
    "developer": {
        "name": "Developer",
        "sort": 1,
        "featured": False,
        "custom_price": False,
        "monthly_price": 29,
        "monthly_allowance": "100,000",
        "overage_rate": "0.020",
        "features": [
            "up_to_100k",
            "lookup_full",
            "uptime_sla",
            "support_standard",
        ],
    },
    "growth": {
        "name": "Growth",
        "sort": 2,
        "featured": True,
        "custom_price": False,
        "monthly_price": 99,
        "monthly_allowance": "1,000,000",
        "overage_rate": "0.010",
        "features": [
            "up_to_1m",
            "lookup_full",
            "uptime_sla",
            "support_priority",
            "analytics",
        ],
    },
    "scale": {
        "name": "Scale",
        "sort": 3,
        "featured": False,
        "custom_price": False,
        "monthly_price": 349,
        "monthly_allowance": "10,000,000",
        "overage_rate": "0.004",
        "features": [
            "up_to_10m",
            "lookup_full",
            "uptime_sla",
            "support_priority",
            "analytics",
            "dedicated_engineer",
        ],
    },
    "enterprise": {
        "name": "Enterprise",
        "sort": 4,
        "featured": False,
        "custom_price": True,
        "monthly_price": None,
        "monthly_allowance": "Unlimited",
        "overage_rate": None,
        "features": [
            "unlimited_lookups",
            "lookup_full",
            "uptime_sla",
            "support_dedicated",
            "analytics",
            "custom_tiers",
        ],
    },
}

PLAN_FREQUENCIES = {"monthly", "annual"}

TAX_RATE = 0.18  # flat sales tax applied to self-serve checkouts (18%)


def public_plans() -> list[dict]:
    """Serialize the public catalog for the pricing page (stable order)."""
    plans = []
    for code, plan in sorted(PUBLIC_PLANS.items(), key=lambda item: item[1]["sort"]):
        entry = {
            "code": code,
            "name": plan["name"],
            "sort": plan["sort"],
            "featured": plan["featured"],
            "custom_price": plan["custom_price"],
            "monthly_price": plan["monthly_price"],
            "monthly_allowance": plan["monthly_allowance"],
            "overage_rate": plan["overage_rate"],
            "features": plan["features"],
        }
        if plan["custom_price"]:
            entry["annual_price_per_month"] = None
            entry["annual_price_per_year"] = None
        else:
            monthly = plan["monthly_price"]
            annual = _annual_per_month(monthly)
            entry["annual_price_per_month"] = annual
            entry["annual_price_per_year"] = annual * 12
        plans.append(entry)
    return plans


def plan_price(plan_code: str, frequency: str) -> int:
    """Per-billing-period price (whole dollars)."""
    plan = PUBLIC_PLANS.get(plan_code)
    if plan is None:
        raise ValueError("Unknown plan.")
    if plan["custom_price"]:
        raise ValueError("Custom-priced plans require a sales quote.")
    if frequency not in PLAN_FREQUENCIES:
        raise ValueError("Billing frequency must be 'monthly' or 'annual'.")
    if frequency == "annual":
        return _annual_per_month(plan["monthly_price"]) * 12
    return plan["monthly_price"]


def normalize_email(email: str) -> str:
    """Normalize a billing email for identity lookups (whitespace + case)."""
    return (email or "").strip().lower()


# --------------------------------------------------------------------------
# Orders
# --------------------------------------------------------------------------

def _next_order_no(db: Session) -> str:
    """Generate a unique, human-friendly order number (CYRA-XXXXXX)."""
    for _ in range(50):
        candidate = f"CYRA-{secrets.token_hex(3).upper()}"
        existing = db.query(Order).filter(Order.order_no == candidate).first()
        if not existing:
            return candidate
    raise RuntimeError("Could not allocate a unique order number.")


def order_to_dict(order: Order) -> dict:
    return {
        "id": order.id,
        "order_no": order.order_no,
        "email": order.email,
        "plan_code": order.plan_code,
        "plan_name": order.plan_name,
        "billing_frequency": order.billing_frequency,
        "amount": order.amount,
        "tax_amount": order.tax_amount,
        "total_amount": order.total_amount,
        "currency": order.currency,
        "status": order.status,
        "payment_method": order.payment_method,
        "auto_renew": order.auto_renew,
        "promo_code": order.promo_code,
        "client_id": order.client_id,
        "created_at": order.created_at,
        "updated_at": order.updated_at,
    }


def _attach_subscription(db: Session, client: ApiClient, order: Order) -> ApiClient:
    """Snapshot the customer's plan onto a ClientSubscription + Transaction.

    Public plans have no row in the Admin ``Plans`` catalog, so the snapshot
    columns carry the name/cost (exactly like admin subscriptions); weekly MRR
    / revenue figures on the admin dashboard pick these up automatically.
    """
    months = 12 if order.billing_frequency == "annual" else 1
    today = today_start()
    end = today + timedelta(days=30 * months)

    sub = ClientSubscription(
        client_id=client.id,
        plan_id=None,
        plan_name=order.plan_name,
        monthly_cost=order.amount // months,
        start_date=today,
        end_date=end,
        status=SUB_ACTIVE,
    )
    db.add(sub)
    db.add(
        Transaction(
            client_id=client.id,
            client_name=client.name,
            plan_name=order.plan_name,
            amount=order.total_amount,
            status="paid",
        )
    )
    db.flush()

    order.client_id = client.id
    return client


def create_order(
    db: Session,
    *,
    email: str,
    plan_code: str,
    billing_frequency: str,
    payment_method: str | None = None,
    promo_code: str | None = None,
    idempotency_key: str | None = None,
) -> tuple[Order, str | None]:
    """Create a paid self-serve order; returns ``(order, raw_api_key)``.

    The raw API key is returned exactly once when the customer is provisioned
    on first creation; replays (same idempotency key) return the stored order
    with a ``None`` key.
    """
    email = normalize_email(email)
    if not email or "@" not in email:
        raise ValueError("A valid billing email is required.")
    if plan_code not in PUBLIC_PLANS:
        raise ValueError("Unknown plan.")
    if billing_frequency not in PLAN_FREQUENCIES:
        raise ValueError("Billing frequency must be 'monthly' or 'annual'.")

    plan = PUBLIC_PLANS[plan_code]

    # Idempotent replay: the same checkout with the same key returns the same order.
    if idempotency_key:
        existing = (
            db.query(IdempotencyKey)
            .filter(
                IdempotencyKey.key == idempotency_key,
                IdempotencyKey.endpoint == "billing/orders",
            )
            .first()
        )
        if existing:
            try:
                stored = json.loads(existing.response_json or "{}")
                order = db.query(Order).filter(Order.id == stored.get("order_id")).first()
            except (json.JSONDecodeError, TypeError):
                order = None
            if order:
                return order, None

    if plan["custom_price"]:
        raise ValueError("Enterprise plans are quoted on request. Contact our sales team.")

    price = plan_price(plan_code, billing_frequency)
    if price <= 0:
        raise ValueError("This plan is free and does not require checkout.")

    tax_amount = round(price * TAX_RATE)
    order = Order(
        order_no=_next_order_no(db),
        email=email,
        plan_code=plan_code,
        plan_name=plan["name"],
        billing_frequency=billing_frequency,
        amount=price,
        tax_amount=tax_amount,
        total_amount=price + tax_amount,
        status="paid",
        payment_method=payment_method,
        auto_renew=True,
        promo_code=promo_code or None,
    )
    db.add(order)
    db.flush()

    # Provision the customer's API credential + subscription + transaction.
    client, raw_key = create_api_client(
        db,
        name=f"Customer — {email}",
        contact_email=email,
        permissions=[LOOKUP_PERMISSION],
    )
    _attach_subscription(db, client, order)

    if idempotency_key:
        expires = datetime.utcnow() + timedelta(hours=24)
        db.add(
            IdempotencyKey(
                user_id=None,
                key=idempotency_key,
                endpoint="billing/orders",
                response_json=json.dumps({"order_id": order.id}),
                expires_at=expires,
            )
        )

    db.commit()
    db.refresh(order)
    send_receipt(order)
    return order, raw_key


def list_orders(db: Session, email: str) -> list[Order]:
    email = normalize_email(email)
    if not email:
        return []
    return (
        db.query(Order)
        .filter(Order.email == email)
        .order_by(Order.created_at.desc())
        .all()
    )


def get_order(db: Session, order_id: str) -> Order | None:
    return db.query(Order).filter(Order.id == order_id).first()


def cancel_order(db: Session, order: Order) -> Order:
    """Cancel a customer's subscription; order + linked sub stay for history."""
    if order.status != "paid":
        raise ValueError("This order has already been cancelled.")
    order.status = "cancelled"
    order.auto_renew = False
    order.updated_at = datetime.utcnow()
    if order.client_id:
        client = db.query(ApiClient).filter(ApiClient.id == order.client_id).first()
        sub = (
            db.query(ClientSubscription)
            .filter(ClientSubscription.client_id == client.id)
            .first()
            if client
            else None
        )
        if sub and sub.status == SUB_ACTIVE:
            sub.status = "cancelled"
            sub.updated_at = datetime.utcnow()
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def set_auto_renew(db: Session, order: Order, auto_renew: bool) -> Order:
    order.auto_renew = bool(auto_renew)
    order.updated_at = datetime.utcnow()
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def send_receipt(order: Order) -> None:
    """Best-effort confirmation email; never raises, silent under tests.

    In dev (no SMTP_HOST) the receipt is printed to the server console so the
    flow is observable without a mail server.
    """
    import os

    if os.environ.get("TESTING", "").lower() in ("1", "true", "yes"):
        return
    try:
        from app.services.email_service import send_order_confirmation_email

        send_order_confirmation_email(
            order.email,
            order.order_no,
            order.plan_name,
            order.total_amount,
            order.currency,
        )
    except Exception:  # pragma: no cover - mail is best-effort
        pass