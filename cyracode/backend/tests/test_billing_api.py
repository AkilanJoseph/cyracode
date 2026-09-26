"""Public self-serve billing API tests (plans, checkout, lookups, lifecycle)."""
import uuid


def create_order(
    client,
    plan="growth",
    frequency="monthly",
    email="buyer@example.com",
    method="card",
    **extra,
):
    headers = {"X-Idempotency-Key": f"test-{uuid.uuid4()}"}
    headers.update(extra.pop("headers", {}))
    payload = {
        "email": email,
        "plan_code": plan,
        "billing_frequency": frequency,
        "payment_method": method,
    }
    payload.update(extra.pop("payload", {}))
    return client.post("/billing/orders", json=payload, headers=headers)


# ---------- Plans ----------

def test_public_plans_listing(client):
    resp = client.get("/billing/plans")
    assert resp.status_code == 200
    plans = resp.json()
    codes = [p["code"] for p in plans]
    assert codes == ["sandbox", "developer", "growth", "scale", "enterprise"]
    growth = next(p for p in plans if p["code"] == "growth")
    assert growth["featured"] is True
    assert growth["monthly_price"] == 99
    assert growth["annual_price_per_month"] == 79
    assert growth["annual_price_per_year"] == 948
    developer = next(p for p in plans if p["code"] == "developer")
    assert developer["monthly_price"] == 29
    assert developer["annual_price_per_month"] == (29 * 8 + 5) // 10
    enterprise = next(p for p in plans if p["code"] == "enterprise")
    assert enterprise["custom_price"] is True
    assert enterprise["monthly_price"] is None


def test_public_plans_need_no_auth(client):
    resp = client.get("/billing/plans")
    assert resp.status_code == 200


# ---------- Order creation ----------

def test_create_order_monthly(client):
    resp = create_order(client, plan="growth", frequency="monthly")
    assert resp.status_code == 201
    data = resp.json()
    assert data["order_no"].startswith("CYRA-")
    assert data["email"] == "buyer@example.com"
    assert data["plan_code"] == "growth"
    assert data["plan_name"] == "Growth"
    assert data["billing_frequency"] == "monthly"
    assert data["amount"] == 99
    assert data["tax_amount"] == 18
    assert data["total_amount"] == 117
    assert data["status"] == "paid"
    assert data["auto_renew"] is True
    assert data["payment_method"] == "card"
    assert data["currency"] == "USD"
    # The raw API key is returned exactly once.
    assert data["api_key"].startswith("cyra_")
    assert data["client_id"]


def test_create_order_annual(client):
    resp = create_order(client, plan="growth", frequency="annual")
    assert resp.status_code == 201
    data = resp.json()
    assert data["amount"] == 948
    assert data["tax_amount"] == 171
    assert data["total_amount"] == 1119


def test_create_order_normalizes_email(client):
    resp = create_order(client, email="  Buyer@Example.COM  ")
    assert resp.status_code == 201
    assert resp.json()["email"] == "buyer@example.com"


def test_create_order_developer_annual(client):
    resp = create_order(client, plan="developer", frequency="annual")
    assert resp.status_code == 201
    assert resp.json()["amount"] == ((29 * 8 + 5) // 10) * 12


# ---------- Validation ----------

def test_rejects_free_plan(client):
    resp = create_order(client, plan="sandbox")
    assert resp.status_code == 422
    assert "free" in resp.json()["detail"]


def test_rejects_enterprise_plan(client):
    resp = create_order(client, plan="enterprise")
    assert resp.status_code == 422
    assert "Enterprise" in resp.json()["detail"]


def test_rejects_unknown_plan(client):
    resp = create_order(client, plan="nope")
    assert resp.status_code == 422


def test_rejects_invalid_email(client):
    resp = client.post(
        "/billing/orders",
        json={"email": "not-an-email", "plan_code": "growth", "billing_frequency": "monthly"},
    )
    assert resp.status_code == 422


def test_rejects_invalid_frequency(client):
    resp = create_order(client, payload={"billing_frequency": "weekly"})
    assert resp.status_code == 422


# ---------- Lookups ----------

def test_list_orders_by_normalized_email(client):
    create_order(client, email="Buyer@Example.com", plan="developer")
    resp = client.get("/billing/orders", params={"email": "buyer@example.com"})
    assert resp.status_code == 200
    orders = resp.json()
    assert len(orders) == 1
    assert orders[0]["plan_code"] == "developer"
    # Raw keys are never exposed on lookups.
    assert "api_key" not in orders[0]


def test_list_orders_empty_for_unknown_email(client):
    create_order(client)
    resp = client.get("/billing/orders", params={"email": "nobody@example.com"})
    assert resp.status_code == 200
    assert resp.json() == []


def test_get_order_detail(client):
    created = create_order(client).json()
    resp = client.get(f"/billing/orders/{created['id']}")
    assert resp.status_code == 200
    assert resp.json()["order_no"] == created["order_no"]
    assert "api_key" not in resp.json()


def test_get_order_not_found(client):
    resp = client.get(f"/billing/orders/{uuid.uuid4()}")
    assert resp.status_code == 404


# ---------- Idempotency ----------

def test_idempotent_replay_returns_same_order(client):
    headers = {"X-Idempotency-Key": "checkout-attempt-1"}
    payload = {
        "email": "buyer@example.com",
        "plan_code": "growth",
        "billing_frequency": "monthly",
    }
    first = client.post("/billing/orders", json=payload, headers=headers)
    second = client.post("/billing/orders", json=payload, headers=headers)
    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["id"] == first.json()["id"]
    # Only the first creation returns the raw API key.
    assert first.json()["api_key"]
    assert second.json()["api_key"] is None

    resp = client.get("/billing/orders", params={"email": "buyer@example.com"})
    assert len(resp.json()) == 1


# ---------- Lifecycle ----------

def test_cancel_order(client):
    created = create_order(client).json()
    resp = client.post(f"/billing/orders/{created['id']}/cancel")
    assert resp.status_code == 200
    assert resp.json()["status"] == "cancelled"
    assert resp.json()["auto_renew"] is False

    again = client.post(f"/billing/orders/{created['id']}/cancel")
    assert again.status_code == 409


def test_auto_renew_toggle(client):
    created = create_order(client).json()
    off = client.patch(f"/billing/orders/{created['id']}/auto-renew", json={"auto_renew": False})
    assert off.status_code == 200
    assert off.json()["auto_renew"] is False
    on = client.patch(f"/billing/orders/{created['id']}/auto-renew", json={"auto_renew": True})
    assert on.status_code == 200
    assert on.json()["auto_renew"] is True


# ---------- Admin integration ----------

def test_provisioned_client_visible_to_admin(client, db):
    created = create_order(client).json()
    resp = client.get("/admin/clients", headers={"Authorization": f"Bearer {_admin_token(client, db)}"})
    assert resp.status_code == 200
    found = next((c for c in resp.json() if c["id"] == created["client_id"]), None)
    assert found is not None
    assert found["contact_email"] == "buyer@example.com"
    assert "cyracode.lookup" in found["permissions"]
    assert found["subscription_status"] == "active"
    assert found["plan_name"] == "Growth"
    assert found["monthly_cost"] == 99


def test_created_client_api_key_authenticates_lookup(client, db):
    created = create_order(client).json()
    assert created["api_key"].startswith("cyra_")
    # The provisioned key resolves against the lookup endpoint's auth.
    resp = client.get("/cyracode/Whatever/address", headers={"X-API-Key": created["api_key"]})
    assert resp.status_code == 404  # authenticated, but the code does not exist


def test_admin_dashboard_mrr_includes_customer_subscription(client, db):
    create_order(client)  # growth monthly → $99 MRR
    token = _admin_token(client, db)
    resp = client.get("/admin/dashboard", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["monthly_recurring_revenue"] == 99
    assert resp.json()["total_subscriptions"] == 1


def _admin_token(client, db):
    from tests.conftest import admin_auth_headers
    return admin_auth_headers(client, db)["Authorization"].split(" ")[1]