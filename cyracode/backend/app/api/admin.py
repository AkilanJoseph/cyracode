"""Admin Portal API — role-gated management of CyraCodes & client access.

Role model:
  * ``get_current_admin`` gates every route — authentication alone is never
    sufficient; the caller must also hold the Admin role (Users.IsAdmin).
  * Admin can Add / View / Edit / Delete CyraCode records, and manage the API
    clients that are permitted to use the address lookup API.
  * Every action is recorded in AuditLog (admin_login, cyracode_create, ...).
  * There is no dedicated Admin login: an admin signs in through the normal
    /auth/login and admin access is decided by the Users.IsAdmin role flag.
"""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.registration import (
    CyraCodeResponse,
    RegistrationRequest,
    UpdateCyraCodeRequest,
)
from app.database import get_db
from app.models.models import (
    ApiClient,
    AuditLog,
    ClientAccessLog,
    ClientSubscription,
    CyraCode,
    Plan,
    Transaction,
    User,
)
from app.services.admin_service import (
    LOOKUP_PERMISSION,
    SUB_ACTIVE,
    SUB_CANCELLED,
    SUB_EXPIRED,
    SUB_EXPIRING,
    cancel_client_subscription,
    create_api_client,
    ensure_plans,
    generate_api_key,
    grant_permission,
    hash_api_key,
    key_id_for,
    renew_client_subscription,
    revoke_permission,
    set_client_subscription,
    subscription_status,
)
from app.services.auth_service import get_current_admin
from app.services.registration_service import (
    check_name_available,
    create_cyracode_entry,
    generate_qr_code,
    validate_coordinates,
)
from app.services.spam_service import check_name as spam_check_name

router = APIRouter(prefix="/admin", tags=["admin"])


def _log_action(db: Session, user_id: str, action: str) -> None:
    db.add(AuditLog(user_id=user_id, action=action))
    db.commit()


# ---------- Schemas ----------

class AdminUser(BaseModel):
    id: str
    email: EmailStr
    first_name: str
    last_name: str
    is_email_verified: bool
    role: str
    # Derived from role for backward compatibility (role == "admin").
    is_admin: bool
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    total_cyracodes: int
    active_cyracodes: int
    flagged_cyracodes: int
    total_clients: int
    active_clients: int
    total_users: int


class CyraCodeListItem(BaseModel):
    id: str
    code_name: str
    code_type: str
    country: str
    state: Optional[str] = None
    city: Optional[str] = None
    street_address: Optional[str] = None
    postal_code: str
    latitude: float
    longitude: float
    is_active: bool
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CyraCodeListResponse(BaseModel):
    items: List[CyraCodeListItem]
    total: int
    page: int
    page_size: int


class ClientCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    contact_email: Optional[EmailStr] = None
    permissions: List[str] = [LOOKUP_PERMISSION]


class ClientUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    contact_email: Optional[EmailStr] = None
    is_active: Optional[bool] = None


class ClientPermissionRequest(BaseModel):
    permissions: List[str] = Field(..., min_length=1)


class SubscriptionRequest(BaseModel):
    """Assign or change a client's plan for ``months`` (1–36)."""

    plan: str = Field(..., min_length=1, max_length=20)
    months: int = Field(1, ge=1, le=36)


class RenewalRequest(BaseModel):
    months: int = Field(1, ge=1, le=36)


class ClientResponse(BaseModel):
    id: str
    name: str
    key_tail: str
    contact_email: Optional[str] = None
    is_active: bool
    permissions: List[str] = []
    created_at: Optional[datetime] = None
    # Billing/plan info (None when the client has no subscription).
    subscription_id: Optional[str] = None
    plan_code: Optional[str] = None
    plan_name: Optional[str] = None
    monthly_cost: Optional[int] = None
    expiry_date: Optional[datetime] = None
    subscription_status: Optional[str] = None

    class Config:
        from_attributes = True


class ClientCreateResponse(BaseModel):
    client: ClientResponse
    api_key: str


class PlanResponse(BaseModel):
    id: str
    code: str
    name: str
    monthly_cost: int

    class Config:
        from_attributes = True


class PlanCreateRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=50)
    monthly_cost: int = Field(..., ge=1, le=1000000)


class PlanUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    monthly_cost: Optional[int] = Field(None, ge=1, le=1000000)


class SubscriptionListItem(BaseModel):
    id: str
    client_id: str
    client_name: str
    plan_code: Optional[str] = None
    plan_name: Optional[str] = None
    monthly_cost: int
    start_date: datetime
    end_date: datetime
    status: str
    is_active: bool


class SubscriptionListResponse(BaseModel):
    items: List[SubscriptionListItem]
    total: int
    page: int
    page_size: int


class RevenuePoint(BaseModel):
    month: str
    amount: int


class PlanCluster(BaseModel):
    code: Optional[str] = None
    name: str
    clients: int


class DashboardTransaction(BaseModel):
    id: str
    client_name: str
    plan_name: str
    amount: int
    status: str
    created_at: Optional[datetime] = None


class DashboardResponse(BaseModel):
    total_clients: int
    active_clients: int
    total_subscriptions: int
    active_subscriptions: int
    expiring_soon: int
    monthly_recurring_revenue: int
    renewal_rate: float
    api_calls_24h: int
    api_issues_24h: int
    revenue_trend: List[RevenuePoint]
    subscriptions_by_plan: List[PlanCluster]
    recent_transactions: List[DashboardTransaction]


class UserUpdateRequest(BaseModel):
    role: Optional[str] = None
    # Legacy alias — still accepted, maps to role ("admin"/"user").
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None


class UserListResponse(BaseModel):
    items: List[AdminUser]
    total: int


class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    action: str
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int


# ---------- Helpers ----------

def _ip(request: Request) -> Optional[str]:
    return request.client.host if request.client else None


def _user_from_code(c: CyraCode) -> Optional[User]:
    return c.user if c else None


def _to_item(c: CyraCode) -> CyraCodeListItem:
    owner = _user_from_code(c)
    return CyraCodeListItem(
        id=c.id,
        code_name=c.code_name,
        code_type=c.code_type,
        country=c.country,
        state=c.state,
        city=c.city,
        street_address=c.street_address,
        postal_code=c.postal_code,
        latitude=float(c.latitude),
        longitude=float(c.longitude),
        is_active=c.is_active,
        owner_name=f"{owner.first_name} {owner.last_name}".strip() if owner else None,
        owner_email=owner.email if owner else None,
        created_at=c.created_at,
    )


def _client_to_response(c: ApiClient) -> ClientResponse:
    sub = c.subscription
    return ClientResponse(
        id=c.id,
        name=c.name,
        key_tail=c.key_tail,
        contact_email=c.contact_email,
        is_active=c.is_active,
        permissions=[p.permission for p in c.permissions],
        created_at=c.created_at,
        subscription_id=sub.id if sub else None,
        plan_code=sub.plan.code if (sub and sub.plan) else None,
        plan_name=sub.plan_name if sub else None,
        monthly_cost=sub.monthly_cost if sub else None,
        expiry_date=sub.end_date if sub else None,
        subscription_status=subscription_status(sub),
    )


def _eager_client_query(db: Session):
    """Fetch clients with their subscription + plan loaded (avoids N+1)."""
    return db.query(ApiClient).options(
        joinedload(ApiClient.subscription).joinedload(ClientSubscription.plan)
    )


# ---------- Admin identity (role decided by Users.IsAdmin) ----------

@router.get("/auth/me", response_model=AdminUser)
def admin_me(current_user: User = Depends(get_current_admin)):
    return AdminUser.model_validate(current_user)


# ---------- Dashboard stats ----------

@router.get("/stats", response_model=StatsResponse)
def admin_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    total_cyracodes = db.query(func.count(CyraCode.id)).scalar() or 0
    active_cyracodes = (
        db.query(func.count(CyraCode.id))
        .filter(CyraCode.is_active == True)  # noqa: E712
        .scalar()
        or 0
    )
    flagged_cyracodes = (
        db.query(func.count(CyraCode.id))
        .filter(CyraCode.is_flagged == True)  # noqa: E712
        .scalar()
        or 0
    )
    clients = _eager_client_query(db).all()
    total_clients = len(clients)
    # Match the Clients module Status = Active filter (subscription status).
    active_clients = sum(
        1 for c in clients if subscription_status(c.subscription) == SUB_ACTIVE
    )
    total_users = db.query(func.count(User.id)).scalar() or 0
    return StatsResponse(
        total_cyracodes=total_cyracodes,
        active_cyracodes=active_cyracodes,
        flagged_cyracodes=flagged_cyracodes,
        total_clients=total_clients,
        active_clients=active_clients,
        total_users=total_users,
    )


# ---------- Billing plans & dashboard (Admin) ----------

@router.get("/plans", response_model=List[PlanResponse])
def list_plans(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    ensure_plans(db)
    return (
        db.query(Plan)
        .order_by(Plan.monthly_cost.asc(), Plan.created_at.asc())
        .all()
    )


@router.post("/plans", response_model=PlanResponse, status_code=201)
def create_plan(
    payload: PlanCreateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    code = payload.code.strip().lower()
    if not code or not all(c.isalnum() or c in "_-" for c in code):
        raise HTTPException(
            status_code=422,
            detail="Plan code may only contain letters, digits, '_' and '-'.",
        )
    ensure_plans(db)
    if db.query(Plan).filter(Plan.code == code).first():
        raise HTTPException(status_code=409, detail="A plan with this code already exists.")
    plan = Plan(code=code, name=payload.name.strip(), monthly_cost=payload.monthly_cost)
    db.add(plan)
    _log_action(db, _admin.id, f"plan_create:{code}")
    db.refresh(plan)
    return plan


@router.put("/plans/{code}", response_model=PlanResponse)
def update_plan(
    code: str,
    payload: PlanUpdateRequest,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    plan = db.query(Plan).filter(Plan.code == code).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")
    if payload.name is not None:
        plan.name = payload.name.strip()
    if payload.monthly_cost is not None:
        plan.monthly_cost = payload.monthly_cost
    _log_action(db, _admin.id, f"plan_update:{code}")
    db.refresh(plan)
    return plan


@router.delete("/plans/{code}", status_code=204)
def delete_plan(
    code: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    plan = db.query(Plan).filter(Plan.code == code).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found.")
    in_use = (
        db.query(ClientSubscription)
        .filter(ClientSubscription.plan_id == plan.id)
        .first()
    )
    if in_use:
        raise HTTPException(
            status_code=409,
            detail="Plan is still in use by a client subscription and cannot be deleted.",
        )
    _log_action(db, _admin.id, f"plan_delete:{code}")
    db.delete(plan)
    db.commit()
    return None


def _last_months(months: int = 12) -> tuple[list[str], set]:
    """Return (ordered 'YYYY-MM' labels for the last N months, set form)."""
    now = datetime.utcnow()
    labels: list[str] = []
    for i in range(months - 1, -1, -1):
        month_index = (now.year * 12 + now.month - 1) - i
        year, month = divmod(month_index, 12)
        labels.append(f"{year:04d}-{month + 1:02d}")
    return labels, set(labels)


@router.get("/dashboard", response_model=DashboardResponse)
def admin_dashboard(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    """Admin home-screen metrics: MRR, expirations, trend, plans, invoices."""
    clients = _eager_client_query(db).all()
    total_clients = len(clients)

    subs = [c.subscription for c in clients if c.subscription]
    statuses = [subscription_status(s) for s in subs]
    # "Active clients" must mirror the Clients module Status = Active filter,
    # which is driven by the backend-derived subscription status. This keeps a
    # single source of truth instead of the account's IsActive flag.
    active_clients = statuses.count(SUB_ACTIVE)
    active_count = active_clients
    expiring_count = statuses.count(SUB_EXPIRING)
    active_or_expiring = sum(
        1 for s, st in zip(subs, statuses) if st in (SUB_ACTIVE, SUB_EXPIRING)
    )
    mrr = sum(s.monthly_cost for s, st in zip(subs, statuses) if st in (SUB_ACTIVE, SUB_EXPIRING))
    renewal_rate = round(active_count / len(subs) * 100, 1) if subs else 0.0

    # Plan breakdown across current (non-cancelled) subscriptions.
    by_plan: dict[str, int] = {}
    by_plan_code: dict[str, str | None] = {}
    for s, st in zip(subs, statuses):
        if st == SUB_CANCELLED:
            continue
        name = s.plan_name or "None"
        by_plan[name] = by_plan.get(name, 0) + 1
        by_plan_code[name] = s.plan.code if s.plan else None
    subscriptions_by_plan = [
        PlanCluster(code=by_plan_code[name], name=name, clients=count)
        for name, count in sorted(by_plan.items(), key=lambda kv: -kv[1])
    ]

    # Revenue trend over the trailing 12 months from paid transactions.
    labels, label_set = _last_months(12)
    month_amounts = dict.fromkeys(labels, 0)
    cutoff = datetime.utcnow() - timedelta(days=365)
    txns = (
        db.query(Transaction)
        .filter(Transaction.status == "paid", Transaction.created_at >= cutoff)
        .all()
    )
    for txn in txns:
        key = txn.created_at.strftime("%Y-%m")
        if key in label_set:
            month_amounts[key] += txn.amount
    revenue_trend = [
        RevenuePoint(month=label, amount=month_amounts[label]) for label in labels
    ]

    # API health + traffic over the trailing 24 hours.
    since = datetime.utcnow() - timedelta(hours=24)
    api_calls_24h = (
        db.query(func.count(ClientAccessLog.id))
        .filter(ClientAccessLog.created_at >= since)
        .scalar()
        or 0
    )
    api_issues_24h = (
        db.query(func.count(ClientAccessLog.id))
        .filter(
            ClientAccessLog.created_at >= since,
            ClientAccessLog.status_code.isnot(None),
            ClientAccessLog.status_code >= 400,
        )
        .scalar()
        or 0
    )

    recent = (
        db.query(Transaction)
        .order_by(Transaction.created_at.desc())
        .limit(8)
        .all()
    )
    recent_transactions = [
        DashboardTransaction(
            id=t.id,
            client_name=t.client_name,
            plan_name=t.plan_name,
            amount=t.amount,
            status=t.status,
            created_at=t.created_at,
        )
        for t in recent
    ]

    return DashboardResponse(
        total_clients=total_clients,
        active_clients=active_clients,
        total_subscriptions=len(subs),
        active_subscriptions=active_count,
        expiring_soon=expiring_count,
        monthly_recurring_revenue=mrr,
        renewal_rate=renewal_rate,
        api_calls_24h=api_calls_24h,
        api_issues_24h=api_issues_24h,
        revenue_trend=revenue_trend,
        subscriptions_by_plan=subscriptions_by_plan,
        recent_transactions=recent_transactions,
    )


# ---------- Subscriptions (Admin) ----------

@router.get("/subscriptions", response_model=SubscriptionListResponse)
def list_subscriptions(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
    q: Optional[str] = Query(None, max_length=100),
    plan: Optional[str] = Query(None, max_length=20),
    status: Optional[str] = Query(None, max_length=20),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    query = db.query(ClientSubscription).options(
        joinedload(ClientSubscription.client),
        joinedload(ClientSubscription.plan),
    )
    if q:
        like = f"%{q.lower()}%"
        query = query.join(ApiClient).filter(func.lower(ApiClient.name).like(like))
    if plan:
        query = query.join(Plan, ClientSubscription.plan_id == Plan.id).filter(
            Plan.code == plan
        )
    rows = query.order_by(ClientSubscription.updated_at.desc()).all()

    items = []
    for s in rows:
        st = subscription_status(s)
        if status and st != status:
            continue
        items.append(
            SubscriptionListItem(
                id=s.id,
                client_id=s.client_id,
                client_name=s.client.name,
                plan_code=s.plan.code if s.plan else None,
                plan_name=s.plan_name,
                monthly_cost=s.monthly_cost,
                start_date=s.start_date,
                end_date=s.end_date,
                status=st,
                is_active=s.client.is_active,
            )
        )
    total = len(items)
    start = (page - 1) * page_size
    return SubscriptionListResponse(
        items=items[start : start + page_size],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------- CyraCode management (Admin) ----------

@router.get("/cyracodes", response_model=CyraCodeListResponse)
def list_cyracodes(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
    q: Optional[str] = Query(None, max_length=100),
    country_code: Optional[str] = Query(None, max_length=10),
    code_type: Optional[str] = Query(None, max_length=20),
    is_active: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    query = db.query(CyraCode)

    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            or_(
                func.lower(CyraCode.code_name).like(like),
                func.lower(CyraCode.street_address).like(like),
                func.lower(CyraCode.city).like(like),
                func.lower(CyraCode.country).like(like),
            )
        )
    if country_code:
        query = query.filter(CyraCode.country_code == country_code)
    if code_type:
        query = query.filter(CyraCode.code_type == code_type)
    if is_active is not None:
        query = query.filter(CyraCode.is_active == is_active)  # noqa: E712

    total = query.count()
    items = (
        query.order_by(CyraCode.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return CyraCodeListResponse(
        items=[_to_item(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/cyracodes/{code_id}", response_model=CyraCodeResponse)
def get_cyracode(
    code_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    entry = db.query(CyraCode).filter(CyraCode.id == code_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="CyraCode not found.")
    return CyraCodeResponse.model_validate(entry)


@router.post("/cyracodes", response_model=CyraCodeResponse, status_code=201)
def create_cyracode(
    request: Request,
    payload: RegistrationRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin Add CyraCode — protected, admin-only operation."""
    if not validate_coordinates(payload.latitude, payload.longitude):
        raise HTTPException(status_code=400, detail="Invalid coordinates.")
    if not check_name_available(db, payload.name):
        raise HTTPException(status_code=409, detail="This CyraCode name is already taken.")

    is_blocked, block_reason, should_flag, flag_reason = spam_check_name(payload.name)
    if is_blocked:
        raise HTTPException(
            status_code=422, detail=f"Name rejected by content filter: {block_reason}"
        )

    qr = generate_qr_code(payload.name, payload.latitude, payload.longitude)

    data = payload.model_dump()
    data["code_name"] = payload.name
    data["code_type"] = "traditional"
    data["qr_code_path"] = None
    data["is_flagged"] = should_flag
    data["flag_reason"] = flag_reason if should_flag else None

    entry = create_cyracode_entry(db, admin.id, data)
    _log_action(db, admin.id, f"cyracode_create:{entry.code_name}")

    resp = CyraCodeResponse.model_validate(entry)
    resp.qr_code = qr
    return resp


@router.put("/cyracodes/{code_id}", response_model=CyraCodeResponse)
def update_cyracode(
    request: Request,
    code_id: str,
    payload: UpdateCyraCodeRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin Edit CyraCode — protected, admin-only operation."""
    entry = db.query(CyraCode).filter(CyraCode.id == code_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="CyraCode not found.")
    if not validate_coordinates(payload.latitude, payload.longitude):
        raise HTTPException(status_code=400, detail="Invalid coordinates.")

    data = payload.model_dump()
    entry.latitude = data["latitude"]
    entry.longitude = data["longitude"]
    entry.country = data["country"]
    entry.country_code = data["country_code"]
    entry.state = data.get("state")
    entry.district = data.get("district")
    entry.city = data.get("city")
    entry.area = data.get("area")
    entry.town = data.get("town")
    entry.road_name = data.get("road_name")
    entry.avenue_name = data.get("avenue_name")
    entry.street_address = data["street_address"]
    entry.building_name = data.get("building_name")
    entry.flat_number = data.get("flat_number")
    entry.suite_name = data.get("suite_name")
    entry.plot_number = data.get("plot_number")
    entry.floor_unit = data.get("floor_unit")
    entry.postal_code = data["postal_code"]
    entry.po_box = data.get("po_box")
    entry.landmark = data.get("landmark")
    entry.updated_at = datetime.utcnow()
    db.add(entry)
    db.commit()
    db.refresh(entry)

    _log_action(db, admin.id, f"cyracode_update:{entry.code_name}")
    return CyraCodeResponse.model_validate(entry)


@router.delete("/cyracodes/{code_id}", status_code=204)
def delete_cyracode(
    request: Request,
    code_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Admin Delete CyraCode — soft delete (preserves unique name + audit trail)."""
    entry = db.query(CyraCode).filter(CyraCode.id == code_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="CyraCode not found.")
    entry.is_active = False
    entry.updated_at = datetime.utcnow()
    db.add(entry)
    db.commit()
    _log_action(db, admin.id, f"cyracode_delete:{entry.code_name}")
    return None


@router.post("/cyracodes/{code_id}/restore", response_model=CyraCodeResponse)
def restore_cyracode(
    request: Request,
    code_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    entry = db.query(CyraCode).filter(CyraCode.id == code_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="CyraCode not found.")
    entry.is_active = True
    entry.updated_at = datetime.utcnow()
    db.add(entry)
    db.commit()
    db.refresh(entry)
    _log_action(db, admin.id, f"cyracode_restore:{entry.code_name}")
    return CyraCodeResponse.model_validate(entry)


# ---------- Client access management (Admin) ----------

@router.get("/clients", response_model=List[ClientResponse])
def list_clients(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
    q: Optional[str] = Query(None, max_length=100),
    plan: Optional[str] = Query(None, max_length=20),
    status: Optional[str] = Query(None, max_length=20),
):
    query = _eager_client_query(db)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            or_(
                func.lower(ApiClient.name).like(like),
                func.lower(ApiClient.contact_email).like(like),
            )
        )
    clients = query.order_by(ApiClient.created_at.desc()).all()

    items = []
    for c in clients:
        if plan:
            sub_plan = c.subscription.plan if c.subscription else None
            if not sub_plan or sub_plan.code != plan:
                continue
        st = subscription_status(c.subscription)
        if status:
            if status == "none":
                if st is not None:
                    continue
            elif st != status:
                continue
        items.append(_client_to_response(c))
    return items


@router.post("/clients", response_model=ClientCreateResponse, status_code=201)
def create_client(
    request: Request,
    payload: ClientCreateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Create a client credential; the raw API key is returned exactly once."""
    client, raw_key = create_api_client(
        db, payload.name, payload.contact_email, permissions=payload.permissions
    )
    _log_action(db, admin.id, f"client_create:{client.name}")
    return ClientCreateResponse(client=_client_to_response(client), api_key=raw_key)


@router.put("/clients/{client_id}", response_model=ClientResponse)
def update_client(
    request: Request,
    client_id: str,
    payload: ClientUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    client = db.query(ApiClient).filter(ApiClient.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="API client not found.")
    if payload.name is not None:
        client.name = payload.name
    if payload.contact_email is not None:
        client.contact_email = str(payload.contact_email) or None
    if payload.is_active is not None:
        client.is_active = payload.is_active
    client.updated_at = datetime.utcnow()
    db.add(client)
    db.commit()
    db.refresh(client)
    _log_action(db, admin.id, f"client_update:{client.name}")
    return _client_to_response(client)


@router.delete("/clients/{client_id}", status_code=204)
def delete_client(
    request: Request,
    client_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    client = db.query(ApiClient).filter(ApiClient.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="API client not found.")
    db.delete(client)
    db.commit()
    _log_action(db, admin.id, f"client_delete:{client.name}")
    return None


@router.post("/clients/{client_id}/permissions", response_model=ClientResponse)
def grant_client_permissions(
    request: Request,
    client_id: str,
    payload: ClientPermissionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Grant API permissions to a client (e.g. cyracode.lookup) — no code change."""
    client = db.query(ApiClient).filter(ApiClient.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="API client not found.")
    for perm in payload.permissions:
        try:
            grant_permission(db, client.id, perm)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    db.refresh(client)
    _log_action(db, admin.id, f"client_grant:{client.name}:{','.join(payload.permissions)}")
    return _client_to_response(client)


@router.delete(
    "/clients/{client_id}/permissions/{permission}", response_model=ClientResponse
)
def revoke_client_permission(
    request: Request,
    client_id: str,
    permission: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Revoke API access from a client — no code change required."""
    client = db.query(ApiClient).filter(ApiClient.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="API client not found.")
    if not revoke_permission(db, client.id, permission):
        raise HTTPException(status_code=404, detail="Permission not granted.")
    db.refresh(client)
    _log_action(db, admin.id, f"client_revoke:{client.name}:{permission}")
    return _client_to_response(client)


@router.post("/clients/{client_id}/rotate-key", response_model=ClientCreateResponse)
def rotate_client_key(
    request: Request,
    client_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Issue a new API key for a client (old key is invalidated immediately)."""
    client = db.query(ApiClient).filter(ApiClient.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="API client not found.")
    raw_key = generate_api_key()
    client.key_id = key_id_for(raw_key)
    client.api_key_hash = hash_api_key(raw_key)
    client.key_tail = raw_key[-4:]
    client.updated_at = datetime.utcnow()
    db.add(client)
    db.commit()
    db.refresh(client)
    _log_action(db, admin.id, f"client_rotate:{client.name}")
    return ClientCreateResponse(client=_client_to_response(client), api_key=raw_key)


# ---------- Subscription management (Admin) ----------

def _fresh_client(db: Session, client_id: str) -> ApiClient:
    client = (
        _eager_client_query(db).filter(ApiClient.id == client_id).first()
    )
    if not client:
        raise HTTPException(status_code=404, detail="API client not found.")
    return client


@router.post("/clients/{client_id}/subscription", response_model=ClientResponse)
def assign_subscription(
    request: Request,
    client_id: str,
    payload: SubscriptionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Assign or change a client's plan (records a paid transaction)."""
    client = _fresh_client(db, client_id)
    try:
        set_client_subscription(db, client, payload.plan, payload.months)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    client = _fresh_client(db, client_id)
    _log_action(db, admin.id, f"client_plan:{client.name}:{payload.plan}:{payload.months}m")
    return _client_to_response(client)


@router.post("/clients/{client_id}/subscription/renew", response_model=ClientResponse)
def renew_subscription(
    request: Request,
    client_id: str,
    payload: RenewalRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Renew a client's subscription by ``months`` (records a paid transaction)."""
    client = _fresh_client(db, client_id)
    try:
        renew_client_subscription(db, client, payload.months)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    client = _fresh_client(db, client_id)
    _log_action(db, admin.id, f"client_renew:{client.name}:{payload.months}m")
    return _client_to_response(client)


@router.post("/clients/{client_id}/subscription/cancel", response_model=ClientResponse)
def cancel_subscription(
    request: Request,
    client_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Cancel a client's subscription (kept for history, key can stay active)."""
    client = _fresh_client(db, client_id)
    try:
        cancel_client_subscription(db, client)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    client = _fresh_client(db, client_id)
    _log_action(db, admin.id, f"client_cancel:{client.name}")
    return _client_to_response(client)


# ---------- User / role management (Admin) ----------

@router.get("/users", response_model=UserListResponse)
def list_users(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
    q: Optional[str] = Query(None, max_length=100),
):
    query = db.query(User)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(
            or_(func.lower(User.email).like(like), func.lower(User.first_name).like(like))
        )
    total = query.count()
    users = query.order_by(User.created_at.desc()).limit(200).all()
    return UserListResponse(
        items=[AdminUser.model_validate(u) for u in users], total=total
    )


@router.put("/users/{user_id}", response_model=AdminUser)
def update_user(
    request: Request,
    user_id: str,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Adjust a user's role (user/client/admin) or active status. Audited."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if payload.role is not None:
        role = payload.role.lower()
        if role not in {"user", "client", "admin"}:
            raise HTTPException(status_code=400, detail="Invalid role.")
        if role != user.role:
            user.role = role
            _log_action(db, admin.id, f"user_role:{user.email}:{role}")
    elif payload.is_admin is not None and payload.is_admin != user.is_admin:
        user.is_admin = payload.is_admin
        _log_action(db, admin.id, f"user_role:{user.email}:{'admin' if payload.is_admin else 'client'}")
    if payload.is_active is not None:
        user.is_active = payload.is_active
    db.add(user)
    db.commit()
    db.refresh(user)
    return AdminUser.model_validate(user)


@router.delete("/users/{user_id}", status_code=204)
def deactivate_user(
    request: Request,
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """Soft-disable a user account (read-only clients keep their history)."""
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot disable your own account.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    user.is_active = False
    db.add(user)
    db.commit()
    _log_action(db, admin.id, f"user_disable:{user.email}")
    return None


# ---------- Audit log browsing (Admin) ----------

@router.get("/audit-logs", response_model=AuditLogListResponse)
def list_audit_logs(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
    action: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    total = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    user_ids = {log.user_id for log in logs if log.user_id}
    users = {
        u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()
    } if user_ids else {}
    items = []
    for log in logs:
        u = users.get(log.user_id)
        items.append(
            AuditLogResponse(
                id=log.id,
                user_id=log.user_id,
                user_email=u.email if u else None,
                action=log.action,
                ip_address=log.ip_address,
                created_at=log.created_at,
            )
        )
    return AuditLogListResponse(items=items, total=total)