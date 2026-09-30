"""Self-serve billing API.

Lives outside the Admin portal: the plan catalog and ``POST /billing/orders``
stay public so a visitor can check out without an account. Checkout is
rate-limited per IP and idempotent via ``X-Idempotency-Key`` (the same checkout
with the same key can never create a duplicate order).

Everything that *reads or mutates* an existing order requires authentication
and is scoped to the caller's own account. Orders are keyed on the normalized
customer email rather than a user id, so ownership is resolved by comparing
the order's email to the authenticated user's email.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from app.database import get_db
from app.models.models import AuditLog, Order, User
from app.rate_limiter import limiter
from app.services.auth_service import get_current_user
from app.services.billing_service import (
    cancel_order,
    create_order,
    get_order,
    list_orders,
    normalize_email,
    public_plans,
    set_auto_renew,
)

router = APIRouter(prefix="/billing", tags=["billing"])


def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _log_action(
    db, action: str, ip_address: Optional[str] = None, user_id: Optional[str] = None
) -> None:
    db.add(AuditLog(user_id=user_id, action=action, ip_address=ip_address))
    db.commit()


# ---------- Schemas ----------

class PlanResponse(BaseModel):
    code: str
    name: str
    sort: int
    featured: bool
    custom_price: bool
    monthly_price: Optional[int] = None
    monthly_allowance: str
    overage_rate: Optional[str] = None
    features: list[str]
    annual_price_per_month: Optional[int] = None
    annual_price_per_year: Optional[int] = None


class OrderCreateRequest(BaseModel):
    email: EmailStr = Field(..., description="Billing email; used to look up orders later.")
    plan_code: str = Field(..., min_length=1, max_length=20)
    billing_frequency: str = Field("monthly", min_length=1, max_length=10)
    payment_method: Optional[str] = Field(None, max_length=20)
    promo_code: Optional[str] = Field(None, max_length=50)


class OrderResponse(BaseModel):
    id: str
    order_no: str
    email: str
    plan_code: str
    plan_name: str
    billing_frequency: str
    amount: int
    tax_amount: int
    total_amount: int
    currency: str
    status: str
    payment_method: Optional[str] = None
    auto_renew: bool
    promo_code: Optional[str] = None
    client_id: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class OrderCreateResponse(OrderResponse):
    api_key: Optional[str] = None


class OrderCancelResponse(OrderResponse):
    pass


class AutoRenewRequest(BaseModel):
    auto_renew: bool


def _serialize(order: Order) -> dict:
    data = {
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
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
    }
    return data


def _find_owned_order(db, order_id: str, current_user: User) -> Order:
    """Load an order only if it belongs to the caller.

    A mismatched order reports 404 rather than 403 so the API never confirms
    that somebody else's order id exists.
    """
    order = get_order(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    if normalize_email(order.email) != normalize_email(current_user.email):
        raise HTTPException(status_code=404, detail="Order not found.")
    return order


# ---------- Endpoints ----------

@router.get("/plans", response_model=list[PlanResponse])
def get_plans():
    """Public self-serve plan catalog (no auth)."""
    return public_plans()


@router.post("/orders", response_model=OrderCreateResponse, status_code=201)
@limiter.limit("10/minute")
def place_order(
    request: Request,
    payload: OrderCreateRequest,
    db=Depends(get_db),
    x_idempotency_key: Optional[str] = Header(None, alias="X-Idempotency-Key"),
):
    """Check out a paid plan; provisions the API credential + subscription."""
    try:
        order, raw_key = create_order(
            db,
            email=payload.email,
            plan_code=payload.plan_code,
            billing_frequency=payload.billing_frequency,
            payment_method=payload.payment_method,
            promo_code=payload.promo_code,
            idempotency_key=x_idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    _log_action(db, f"order_create:{order.order_no}", _ip(request))
    return OrderCreateResponse(**_serialize(order), api_key=raw_key)


@router.get("/orders", response_model=list[OrderResponse])
def list_orders_endpoint(
    request: Request,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Order history for the authenticated account.

    The scope comes from the verified token, never from a query parameter, so
    there is no way to read another customer's orders by supplying their email.
    """
    orders = list_orders(db, current_user.email)
    return [_serialize(o) for o in orders]


@router.get("/orders/{order_id}", response_model=OrderResponse)
def get_order_endpoint(
    request: Request,
    order_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Single order detail; 404 unless the order belongs to the caller."""
    order = _find_owned_order(db, order_id, current_user)
    return _serialize(order)


@router.post("/orders/{order_id}/cancel", response_model=OrderResponse)
def cancel_order_endpoint(
    request: Request,
    order_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel the caller's subscription (kept in history)."""
    order = _find_owned_order(db, order_id, current_user)
    try:
        order = cancel_order(db, order)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    _log_action(
        db,
        f"order_cancel:{order.order_no}",
        _ip(request),
        user_id=current_user.id,
    )
    return _serialize(order)


@router.patch("/orders/{order_id}/auto-renew", response_model=OrderResponse)
def update_auto_renew(
    request: Request,
    order_id: str,
    payload: AutoRenewRequest,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Toggle the caller's auto-renew preference."""
    order = _find_owned_order(db, order_id, current_user)
    order = set_auto_renew(db, order, payload.auto_renew)
    _log_action(
        db,
        f"order_auto_renew:{order.order_no}:{'on' if payload.auto_renew else 'off'}",
        _ip(request),
        user_id=current_user.id,
    )
    return _serialize(order)